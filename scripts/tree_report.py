#!/usr/bin/env python3
"""Отчёт о деревьях: запускает настоящий пайплайн проекта и рисует результат.

Прогон ПЛАТНЫЙ (OpenAI и Tavily). Кейсы лежат в backend/src/pipeline/eval/cases.ts.

    python3 scripts/tree_report.py --cases migrants-300k,transnistria-mines --label goal1
    python3 scripts/tree_report.py --from-run tree-v5        уже готовый прогон, бесплатно

Для каждого утверждения строит схему дерева. Каждую публикацию без связи открывает и показывает причину:
разбор, закрытая страница, найденная, но не построенная связь, или никакого следа на странице нет.

Результат: tmp/eval/trees/<label>.html и .json. Нужен только стандартный Python.
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVAL = ROOT / "tmp" / "eval"
USER_AGENT = "Mozilla/5.0 (compatible; FactCheckBot/1.0)"
CLOSED_HOSTS = ("facebook.com", "x.com", "twitter.com", "t.me", "instagram.com", "threads.com", "linkedin.com")
#: Столько общего текста уже нельзя считать совпадением
SHARED_TEXT_SHARE = 0.1
NODE_WIDTH, NODE_HEIGHT, GAP_X, GAP_Y = 190, 54, 24, 58

REASONS = {
    "debunk": "Разбор: связь «кто у кого взял» не нужна",
    "closed": "Страница закрыта или не открылась",
    "link": "Есть ссылка на другую публикацию, дерево её не построило",
    "mention": "Упоминает другое издание, связь не построена",
    "text": "Есть общий текст, связь не построена",
    "none": "На странице нет следа заимствования",
}


def run_pipeline(cases: str, label: str) -> None:
    env = {
        **os.environ,
        "STAGES_DEFAULT": "real",
        "STAGE_INGEST": "real",
        "STAGE_TRANSCRIPTION": "real",
        "STAGE_CLAIM_EXTRACTION": "real",
        "STAGE_SOURCE_SEARCH": "real",
        "STAGE_PROVENANCE": "real",
        "STAGE_MUTATIONS": "real",
        "STAGE_STANCES": "real",
        "TRACE_SEARCH": "on",
        "SEARCH_MAX_PARALLEL": "4",
        "CHECK_MAX_PARALLEL": "2",
    }
    command = ["npm", "run", "eval:pipeline", "-w", "backend", "--", "--label", label, "--only", cases, "--parallel", "2"]
    with open(EVAL / f"{label}.log", "w") as log:
        subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)


def host(url: str | None) -> str:
    return (urllib.parse.urlparse(url or "").hostname or "").removeprefix("www.")


def clean_url(url: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", url).split("#")[0].split("?")[0].rstrip("/").lower()


def fetch(url: str) -> str | None:
    if not url or any(host(url) == h or host(url).endswith("." + h) for h in CLOSED_HOSTS):
        return None
    try:
        request = urllib.request.Request(url, headers={"user-agent": USER_AGENT, "accept": "text/html"})
        with urllib.request.urlopen(request, timeout=12) as response:
            return response.read(1_500_000).decode("utf-8", "ignore")
    except Exception:
        return None


def page_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|nav|footer|aside|header)\b.*?</\1>", " ", page)
    return html.unescape(re.sub(r"<[^>]+>", " ", page))


def shingles(text: str, size: int = 5) -> set[str]:
    words = re.findall(r"[^\W\d_]{2,}|\d+", text.lower())
    return {" ".join(words[i : i + size]) for i in range(len(words) - size + 1)}


def diagnose(node: dict, others: list[dict], pages: dict[str, str | None]) -> tuple[str, str]:
    """Почему у публикации нет связи. Возвращает код причины и подробность."""
    if node.get("categoryLabel") == "разбор":
        return "debunk", ""
    page = pages.get(node["id"])
    if not page:
        return "closed", ""
    text = page_text(page)
    own = host(node["url"])
    sites = [o for o in others if o.get("url") and host(o["url"]) != own]
    # только точный адрес публикации: ссылка на сайт целиком бывает кнопкой «поделиться» или меню
    hrefs = {clean_url(h) for h in re.findall(r'href=["\'](https?:[^"\']+)', page)}
    for other in sites:
        if clean_url(other["url"]) in hrefs:
            return "link", host(other["url"])
    mine = shingles(text)
    best, best_share = "", 0.0
    for other in sites:
        theirs = pages.get(other["id"])
        if not theirs:
            continue
        words = shingles(page_text(theirs))
        small = min(len(mine), len(words))
        share = len(mine & words) / small if small >= 40 else 0
        if share > best_share:
            best, best_share = host(other["url"]), share
    if best_share >= SHARED_TEXT_SHARE:
        return "text", f"{best}, {round(best_share * 100)}%"
    lower = text.lower()
    for other in sites:
        site = host(other["url"])
        name = other.get("name", "")
        # точное название: слово из адреса (moldova, point, parlament) встречается в любом тексте
        named = len(name) >= 6 and name[0].isupper() and "." not in name and name in text
        if site not in CLOSED_HOSTS and (site in lower or named):
            return "mention", site
    return "none", ""


def layout(nodes: list[dict], edges: list[dict]) -> dict[str, tuple[int, int]]:
    children, incoming = defaultdict(list), Counter()
    for edge in edges:
        children[edge["fromNodeId"]].append(edge["toNodeId"])
        incoming[edge["toNodeId"]] += 1
    linked = {e["fromNodeId"] for e in edges} | {e["toNodeId"] for e in edges}
    levels: dict[str, int] = {}
    stack = [(n["id"], 0) for n in nodes if n["id"] in linked and not incoming[n["id"]]]
    while stack:
        node, level = stack.pop()
        if levels.get(node, -1) >= level or level > 12:
            continue
        levels[node] = level
        stack.extend((child, level + 1) for child in children[node])
    rows = defaultdict(list)
    for node, level in levels.items():
        rows[level].append(node)
    positions = {}
    width = max((len(r) for r in rows.values()), default=1)
    for level, row in rows.items():
        offset = (width - len(row)) * (NODE_WIDTH + GAP_X) / 2
        for index, node in enumerate(sorted(row)):
            positions[node] = (int(offset + index * (NODE_WIDTH + GAP_X)) + 10, level * (NODE_HEIGHT + GAP_Y) + 10)
    return positions


def short(text: str, limit: int = 26) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def tree_svg(nodes: list[dict], edges: list[dict]) -> str:
    positions = layout(nodes, edges)
    if not positions:
        return '<p class="empty">Связей нет.</p>'
    by_id = {n["id"]: n for n in nodes}
    width = max(x for x, _ in positions.values()) + NODE_WIDTH + 10
    height = max(y for _, y in positions.values()) + NODE_HEIGHT + 10
    parts = [
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="Дерево публикаций">',
        '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
        '<path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>',
    ]
    names = {"direct": "ссылка", "likely_derived": "вероятно", "distorted": "с изменениями"}
    for edge in edges:
        if edge["fromNodeId"] not in positions or edge["toNodeId"] not in positions:
            continue
        x1, y1 = positions[edge["fromNodeId"]]
        x2, y2 = positions[edge["toNodeId"]]
        x1, y1, x2 = x1 + NODE_WIDTH // 2, y1 + NODE_HEIGHT, x2 + NODE_WIDTH // 2
        dash = "" if edge["relationType"] == "direct" else ' stroke-dasharray="5 4"'
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2 - 2}" class="edge"{dash} marker-end="url(#a)"/>')
        label = names.get(edge["relationType"], "")
        parts.append(f'<text x="{(x1 + x2) // 2 + 6}" y="{(y1 + y2) // 2}" class="small">{label}</text>')
    for node_id, (x, y) in positions.items():
        node = by_id[node_id]
        kind = (
            "target" if node.get("role") == "target"
            else "root" if node.get("isPrimary")
            else "hidden" if not node.get("url")
            else "debunk" if node.get("categoryLabel") == "разбор"
            else "plain"
        )
        title = "Проверяемый текст" if kind == "target" else node["name"] if kind == "hidden" else host(node.get("url"))
        date = (node.get("isoDate") or "")[:10] or "дата неизвестна"
        parts.append(f'<rect x="{x}" y="{y}" width="{NODE_WIDTH}" height="{NODE_HEIGHT}" rx="8" class="node {kind}"/>')
        center = x + NODE_WIDTH // 2
        parts.append(f'<text x="{center}" y="{y + 22}" class="title">{html.escape(short(title))}</text>')
        parts.append(f'<text x="{center}" y="{y + 41}" class="small mid">{"" if kind == "target" else date}</text>')
    parts.append("</svg>")
    return "".join(parts)


def analyze(report_item: dict) -> dict | None:
    provenance = report_item.get("provenance")
    if not provenance:
        return None
    nodes, edges = provenance["nodes"], provenance["edges"]
    publications = [n for n in nodes if n.get("role") != "target" and n.get("url")]
    linked = {e["fromNodeId"] for e in edges} | {e["toNodeId"] for e in edges}
    with ThreadPoolExecutor(8) as pool:
        pages = dict(zip([n["id"] for n in publications], pool.map(lambda n: fetch(n["url"]), publications)))
    isolated = []
    for node in publications:
        if node["id"] in linked:
            continue
        code, detail = diagnose(node, [o for o in publications if o is not node], pages)
        isolated.append({"node": node, "reason": code, "detail": detail})
    return {
        "claim": report_item["claim"],
        "consensus": report_item.get("consensus"),
        "summary": report_item.get("consensusSummary"),
        "sides": report_item.get("sides"),
        "flags": [f["label"] for f in report_item.get("flags", [])],
        "publications": len(publications),
        "linked": sum(1 for n in publications if n["id"] in linked),
        "isolated": isolated,
        "svg": tree_svg(nodes, edges),
    }


STYLE = """
:root{--bg:#fff;--fg:#1f1f1c;--muted:#66655f;--line:#d6d4cb;--card:#f6f5f0;--root:#d7f0e7;--target:#fae9c9;--debunk:#f9dfe8;--hidden:#ecebe4}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1a;--fg:#ecebe4;--muted:#a9a79e;--line:#45443f;--card:#272724;--root:#17473a;--target:#59400f;--debunk:#5a2438;--hidden:#33322e}}
body{margin:0 auto;max-width:1080px;padding:24px 16px;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}
h1{font-size:26px}h2{font-size:19px;margin-top:40px}h3{font-size:16px;margin:20px 0 6px}
.meta,.empty{color:var(--muted)}.tree{overflow-x:auto;background:var(--card);border-radius:12px;padding:12px}
svg{min-width:320px;max-width:100%;height:auto;display:block;margin:auto}
.node{fill:var(--bg);stroke:var(--line)}.root{fill:var(--root)}.target{fill:var(--target)}.debunk{fill:var(--debunk)}.hidden{fill:var(--hidden);stroke-dasharray:4 3}
.edge{stroke:var(--muted);stroke-width:1.3;fill:none}.title{fill:var(--fg);font-size:13px;font-weight:600;text-anchor:middle}.small{fill:var(--muted);font-size:11px}.mid{text-anchor:middle}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
a{color:inherit}.wrap{overflow-x:auto}
"""


def render(label: str, cases: list[dict]) -> str:
    totals = Counter(i["reason"] for c in cases for claim in c["claims"] for i in claim["isolated"])
    publications = sum(claim["publications"] for c in cases for claim in c["claims"])
    linked = sum(claim["linked"] for c in cases for claim in c["claims"])
    rows = "".join(f"<tr><td>{REASONS[code]}</td><td>{count}</td></tr>" for code, count in totals.most_common())
    body = [
        f"<h1>Деревья: {html.escape(label)}</h1>",
        f'<p class="meta">Публикаций: {publications}. Со связью: {linked}. Без связи: {publications - linked}.</p>',
        f"<h2>Почему нет связи</h2><div class=wrap><table><tr><th>Причина</th><th>Публикаций</th></tr>{rows}</table></div>",
    ]
    for case in cases:
        body.append(f"<h2>{html.escape(case['id'])}</h2>")
        for claim in case["claims"]:
            sides = claim["sides"] or {}
            flags = ", ".join(claim["flags"]) or "нет"
            body.append(f"<h3>{html.escape(claim['claim'])}</h3>")
            body.append(
                f'<p class="meta">Итог: {html.escape(str(claim["summary"] or claim["consensus"]))}. '
                f'За {sides.get("for", 0)}, против {sides.get("against", 0)}, частично {sides.get("mixed", 0)}. '
                f"Флаги: {html.escape(flags)}.</p>"
            )
            body.append(f'<div class="tree">{claim["svg"]}</div>')
            if claim["isolated"]:
                lines = []
                for item in claim["isolated"]:
                    node = item["node"]
                    url = html.escape(node["url"], quote=True)
                    extra = f": {html.escape(item['detail'])}" if item["detail"] else ""
                    lines.append(
                        f'<tr><td>{(node.get("isoDate") or "—")[:10]}</td>'
                        f'<td><a href="{url}">{html.escape(host(node["url"]))}</a></td>'
                        f"<td>{REASONS[item['reason']]}{extra}</td></tr>"
                    )
                body.append(
                    "<div class=wrap><table><tr><th>Дата</th><th>Сайт</th><th>Почему без связи</th></tr>"
                    + "".join(lines)
                    + "</table></div>"
                )
    return (
        '<!doctype html><html lang="ru"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>Деревья публикаций</title><style>{STYLE}</style><body>{''.join(body)}</body></html>"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cases", help="id кейсов через запятую, прогон платный")
    parser.add_argument("--label", default="trees")
    parser.add_argument("--from-run", help="готовый прогон из tmp/eval, бесплатно")
    args = parser.parse_args()
    if bool(args.cases) == bool(args.from_run):
        parser.error("нужен ровно один параметр: --cases или --from-run")

    label = args.from_run or args.label
    if args.cases:
        run_pipeline(args.cases, label)
    cases = []
    for path in sorted((EVAL / label).glob("*.json")):
        if path.name == "scores.json":
            continue
        data = json.loads(path.read_text())
        claims = [a for a in map(analyze, data["report"]) if a]
        cases.append({"id": path.stem, "claims": claims})

    out = EVAL / "trees"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{label}.html").write_text(render(label, cases))
    plain = [
        {**c, "claims": [{k: v for k, v in claim.items() if k != "svg"} for claim in c["claims"]]} for c in cases
    ]
    (out / f"{label}.json").write_text(json.dumps(plain, ensure_ascii=False, indent=1))

    totals = Counter(i["reason"] for c in cases for claim in c["claims"] for i in claim["isolated"])
    for case in cases:
        for claim in case["claims"]:
            print(f"{case['id']}: {claim['linked']} из {claim['publications']} со связью, итог {claim['consensus']}")
    for code, count in totals.most_common():
        print(f"{count:3}  {REASONS[code]}")
    print(out / f"{label}.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
