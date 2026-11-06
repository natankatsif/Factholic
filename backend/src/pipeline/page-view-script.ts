/**
 * Что выполняется внутри копии статьи. Ищет цитаты в тексте страницы и обводит их.
 * Сообщения с родителем:
 *   → fh:ready, fh:found { ids }, fh:select { id }
 *   ← fh:claims { claims: [{ id, quote, bg, line, dashed, checking }], selected, scroll }
 */
export const PAGE_VIEW_STYLE = `
mark[data-fh]{color:inherit;cursor:pointer;border-radius:5px;padding:1px 2px;-webkit-box-decoration-break:clone;
box-decoration-break:clone;border-bottom:2px solid var(--fh-line);background:var(--fh-bg);transition:box-shadow .15s}
mark[data-fh][data-dashed]{border-bottom-style:dashed}
mark[data-fh][data-selected]{box-shadow:0 0 0 2px var(--fh-line)}
mark[data-fh][data-checking]{animation:fh-pulse 1.6s ease-in-out infinite}
@keyframes fh-pulse{50%{background:#EEE8E6}}
html{scroll-padding-top:80px}
`;

export const PAGE_VIEW_SCRIPT = `(() => {
  "use strict";
  const CHAR_MAP = {
    "ş": "ș", "Ş": "Ș", "ţ": "ț", "Ţ": "Ț", "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"', "«": '"', "»": '"',
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  };
  const INVISIBLE = /[\\u00AD\\u200B\\u200C\\u200D\\u2060\\uFEFF]/;
  function normChar(ch) {
    if (INVISIBLE.test(ch)) return "";
    let out = "";
    for (const c of ch.normalize("NFKC")) out += CHAR_MAP[c] || c;
    return /\\s/.test(out) ? " " : out.toLowerCase();
  }
  function normalize(s) {
    let out = "";
    for (const ch of s) {
      const c = normChar(ch);
      if (c === " " && (out === "" || out.endsWith(" "))) continue;
      out += c;
    }
    return out.trim();
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "SVG", "TEXTAREA", "SELECT", "OPTION", "NAV", "FOOTER"]);
  const BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIGCAPTION|FIGURE|FORM|H[1-6]|HEADER|HR|LI|MAIN|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;
  function blockOf(node) {
    for (let el = node.parentElement; el; el = el.parentElement) if (BLOCK.test(el.tagName)) return el;
    return null;
  }
  function pageText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        for (let el = n.parentElement; el; el = el.parentElement) {
          if (SKIP.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        }
        return n.parentElement && n.parentElement.getClientRects().length
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    let text = "";
    const map = [];
    let lastBlock = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = blockOf(node);
      if (block !== lastBlock && text && !text.endsWith(" ")) {
        text += " ";
        map.push(map[map.length - 1]);
      }
      lastBlock = block;
      let i = 0;
      for (const ch of node.nodeValue) {
        const c = normChar(ch);
        const offset = i;
        i += ch.length;
        if (!c || (c === " " && (text === "" || text.endsWith(" ")))) continue;
        for (const piece of c) {
          text += piece;
          map.push([node, offset]);
        }
      }
    }
    return { text, map };
  }

  /** Точная цитата, иначе самый длинный кусок от 5 слов, иначе начало */
  function find(index, quote) {
    const q = normalize(quote);
    if (!q) return null;
    let at = index.text.indexOf(q);
    if (at >= 0) return { start: at, end: at + q.length };
    const words = q.split(" ");
    for (let len = words.length - 1; len >= 5; len--) {
      for (let s = 0; s + len <= words.length; s++) {
        const part = words.slice(s, s + len).join(" ");
        at = index.text.indexOf(part);
        if (at >= 0) return { start: at, end: at + part.length };
      }
    }
    return null;
  }

  function clear() {
    const parents = new Set();
    document.querySelectorAll("mark[data-fh]").forEach((mark) => {
      parents.add(mark.parentNode);
      mark.replaceWith(...mark.childNodes);
    });
    parents.forEach((parent) => parent.normalize());
  }

  function wrap(index, match, claim, selected) {
    const [startNode, startOffset] = index.map[match.start];
    const [endNode, endLast] = index.map[match.end - 1];
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, Math.min(endLast + 1, endNode.nodeValue.length));
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n)) nodes.push(n);
    let first = null;
    for (const n of nodes) {
      const from = n === startNode ? startOffset : 0;
      const to = n === endNode ? Math.min(endLast + 1, n.nodeValue.length) : n.nodeValue.length;
      if (to <= from || !n.nodeValue.slice(from, to).trim()) continue;
      const piece = from > 0 ? n.splitText(from) : n;
      if (to - from < piece.nodeValue.length) piece.splitText(to - from);
      const mark = document.createElement("mark");
      mark.dataset.fh = claim.id;
      mark.style.setProperty("--fh-bg", claim.bg);
      mark.style.setProperty("--fh-line", claim.line);
      if (claim.dashed) mark.dataset.dashed = "";
      if (claim.checking) mark.dataset.checking = "";
      if (claim.id === selected) mark.dataset.selected = "";
      piece.replaceWith(mark);
      mark.appendChild(piece);
      first = first || mark;
    }
    return first;
  }

  function render(message) {
    clear();
    const index = pageText(document.body);
    const found = message.claims
      .map((claim) => ({ claim, match: find(index, claim.quote) }))
      .filter((item) => item.match)
      .sort((a, b) => b.match.start - a.match.start);
    // с конца: разрезанный текст не сдвигает то, что стоит раньше
    let limit = Infinity;
    const ids = [];
    let target = null;
    for (const { claim, match } of found) {
      if (match.end > limit) continue;
      limit = match.start;
      const first = wrap(index, match, claim, message.selected);
      if (!first) continue;
      ids.push(claim.id);
      if (claim.id === message.selected) target = first;
    }
    if (message.scroll && target) target.scrollIntoView({ block: "center" });
    parent.postMessage({ type: "fh:found", ids }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== parent || !event.data || event.data.type !== "fh:claims") return;
    render(event.data);
  });
  document.addEventListener("click", (event) => {
    const mark = event.target.closest && event.target.closest("mark[data-fh]");
    if (!mark) return;
    event.preventDefault();
    event.stopPropagation();
    parent.postMessage({ type: "fh:select", id: mark.dataset.fh }, "*");
  }, true);
  parent.postMessage({ type: "fh:ready" }, "*");
})();`;
