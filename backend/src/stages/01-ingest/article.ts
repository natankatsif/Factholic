/**
 * Статья по ссылке: скачать HTML → вытащить основной текст (Readability, как «режим чтения» в Firefox)
 * → найти дату публикации в разметке страницы.
 */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ISODateString, LanguageCode } from "@news/contracts";

export interface Article {
  title: string;
  text: string;
  siteName?: string;
  language?: LanguageCode;
  publishedAt?: ISODateString;
}

const TIMEOUT_MS = 15_000;
/** Страницы, которые правятся годами: своей даты публикации у них нет (тот же список, что в этапе 04) */
const LIVING_DOC_HOST = /wiki|(^|\.)(fandom\.com|worldometers\.info|britannica\.com|dic\.academic\.ru)$/i;
/** Меньше — это не статья (страница-заглушка, капча, пустая лента) */
export const MIN_ARTICLE_CHARS = 300;

export async function fetchArticle(url: string, signal: AbortSignal): Promise<Article> {
  const res = await fetch(url, {
    // некоторые сайты отдают пустую страницу без «браузерного» User-Agent
    headers: { "user-agent": "Mozilla/5.0 (compatible; FactCheckBot/1.0)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!res.ok) throw new Error(`страница: HTTP ${res.status}`);
  const html = await res.text();
  const article = parseArticle(html);
  // Википедия и подобные «живые документы»: дата в разметке — создание статьи, а не публикация факта
  if (LIVING_DOC_HOST.test(new URL(res.url || url).hostname)) delete article.publishedAt;
  return article;
}

/** Отдельно от fetch — чтобы можно было проверить на сохранённом HTML */
export function parseArticle(html: string): Article {
  const { document } = parseHTML(html);
  const publishedAt = findPublishedAt(document);
  const lang = document.documentElement?.getAttribute("lang")?.slice(0, 2).toLowerCase() || undefined;

  // Readability портит переданный документ — даём ему копию
  const parsed = new Readability(parseHTML(html).document as unknown as Document).parse();
  const text = paragraphsOf(parsed?.content ?? "") || normalizeText(parsed?.textContent ?? "");
  return {
    // og:title — чистый заголовок без меток рубрик («Важно», «Видео»), которые Readability иногда приклеивает
    title:
      document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
      parsed?.title?.trim() ||
      document.querySelector("title")?.textContent?.trim() ||
      "",
    text,
    siteName: parsed?.siteName ?? undefined,
    language: lang,
    publishedAt,
  };
}

/**
 * Дата публикации — по убыванию надёжности:
 *  1. JSON-LD (schema.org NewsArticle.datePublished) — его ставят почти все новостные сайты ради Google
 *  2. meta-теги: article:published_time, pubdate, DC.date...
 *  3. <time datetime> внутри статьи
 *  4. dateModified из JSON-LD — запасной вариант, если даты публикации нет нигде
 */
type Doc = ReturnType<typeof parseHTML>["document"];

function findPublishedAt(document: Doc): ISODateString | undefined {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = script.textContent ?? "";
      const found = findInJsonLd(JSON.parse(raw));
      // опубликовано и изменено различаются больше чем на год — постоянно правящаяся страница, дате не верим
      const modified = toIso(raw.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1]);
      if (found && modified && Date.parse(modified) - Date.parse(found) > 365 * 86_400_000) return undefined;
      if (found) return found;
    } catch {
      // битый JSON-LD — не редкость, идём дальше
    }
  }

  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="article:published_time"]',
    'meta[itemprop="datePublished"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
    'meta[name="DC.date.issued"]',
    'meta[name="dcterms.created"]',
  ];
  for (const sel of metaSelectors) {
    const iso = toIso(document.querySelector(sel)?.getAttribute("content"));
    if (iso) return iso;
  }

  const time = document.querySelector("article time[datetime], time[itemprop=datePublished], time[datetime]");
  const fromTime = toIso(time?.getAttribute("datetime"));
  if (fromTime) return fromTime;

  // Последний шанс: dateModified из JSON-LD (так делает, например, point.md — datePublished у них нет).
  // Для новости обычно совпадает с публикацией; для старой правленой статьи будет позже — это допустимо.
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const m = (script.textContent ?? "").match(/"dateModified"\s*:\s*"([^"]+)"/);
    const iso = toIso(m?.[1]);
    if (iso) return iso;
  }
  return undefined;
}

function findInJsonLd(node: unknown): ISODateString | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findInJsonLd(item);
      if (found) return found;
    }
    return undefined;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const iso = toIso(typeof obj.datePublished === "string" ? obj.datePublished : undefined);
    if (iso) return iso;
    if (obj["@graph"]) return findInJsonLd(obj["@graph"]);
  }
  return undefined;
}

export function toIso(raw: string | null | undefined): ISODateString | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.trim());
  // 1995 — раньше массовых новостных сайтов: всё, что раньше, почти наверняка мусор в разметке
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1995 || d.getTime() > Date.now() + 86_400_000) {
    return undefined;
  }
  return d.toISOString();
}

/** HTML статьи от Readability → абзацы через пустую строку (заголовки, абзацы, пункты списков, цитаты) */
function paragraphsOf(contentHtml: string): string {
  if (!contentHtml) return "";
  const { document } = parseHTML(`<!doctype html><html><body>${contentHtml}</body></html>`);
  const blocks = [...document.querySelectorAll("h1,h2,h3,h4,p,li,blockquote")]
    // вложенные блоки (p внутри li/blockquote) не дублируем
    .filter((el) => !el.parentElement?.closest("li,blockquote"))
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 1);
  // заголовок часто повторяется (в шапке и в теле) — убираем точные дубли
  return [...new Set(blocks)].join("\n\n");
}

/** Схлопнуть пробелы внутри строк, сохранив абзацы (по ним режем текст на куски) */
export function normalizeText(text: string): string {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Длинный текст → куски не больше maxChars, режем по абзацам (а абзац-гигант — по предложениям).
 * Так этап 03 получает текст порциями, как куски видео, и тезисы приходят на фронт постепенно.
 * Первый кусок короче (firstChars): LLM разбирает ~1000 символов за ~11 с, ~2000 — за ~19 с (замер),
 * поэтому первые карточки появляются на экране заметно раньше.
 */
export function splitText(text: string, maxChars = 3000, firstChars = maxChars): string[] {
  const pieces = text.split(/\n\n+/).flatMap((p) => (p.length <= maxChars ? [p] : p.split(/(?<=[.!?…])\s+/)));
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const limit = chunks.length === 0 ? firstChars : maxChars;
    if (current && current.length + piece.length + 2 > limit) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Грубое определение языка без библиотек — для фокуса проекта хватает ru / ro / en:
 * кириллица → ru (uk отличаем по ї, є, і), румынские диакритики и частые слова → ro, иначе en.
 */
export function guessLanguage(text: string): LanguageCode {
  const sample = text.slice(0, 3000).toLowerCase();
  const cyr = (sample.match(/[а-яёіїєґ]/g) ?? []).length;
  const lat = (sample.match(/[a-zăâîșşțţ]/g) ?? []).length;
  if (cyr > lat) return /[їєґ]/.test(sample) ? "uk" : "ru";
  const roWords = sample.match(/\b(și|şi|este|sunt|care|pentru|într|din|lui|despre|acest|fost)\b/g) ?? [];
  if (/[ăâîșşțţ]/.test(sample) || roWords.length >= 3) return "ro";
  return "en";
}
