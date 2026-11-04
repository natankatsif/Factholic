/**
 * Локальное чтение страниц: тот же адрес, который нашёл поисковик, открываем сами.
 * Поисковик находит адреса, а ссылки из текста статьи и дату публикации надёжнее брать из самой страницы.
 * Не открылась — остаётся то, что дал поисковик. Запросов к поисковику и кредитов это не тратит.
 */
import type { StageContext } from "../../pipeline/context.ts";

const PAGE_TIMEOUT_MS = 8_000;
const MAX_HTML_CHARS = 1_500_000;
/** Сколько страниц одной проверки открываем одновременно: адреса обычно на разных сайтах */
const PAGE_PARALLEL = 6;
const MAX_CACHED_PAGES = 500;

/** Без входа такие страницы отдают экран авторизации, а не публикацию */
const CLOSED_HOST =
  /(^|\.)(facebook\.com|x\.com|twitter\.com|t\.me|instagram\.com|tiktok\.com|linkedin\.com|youtube\.com)$/i;

const cache = new Map<string, Promise<string | null>>();

function closed(url: string): boolean {
  try {
    return CLOSED_HOST.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

async function load(url: string, ctx: StageContext): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; FactCheckBot/1.0)", accept: "text/html" },
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "text/html").includes("html")) return null;
    return (await res.text()).slice(0, MAX_HTML_CHARS);
  } catch {
    return null;
  }
}

/** HTML страницы; null — закрыта или не открылась. Одна страница за процесс скачивается один раз */
export function openPage(url: string, ctx: StageContext): Promise<string | null> {
  if (closed(url)) return Promise.resolve(null);
  const known = cache.get(url);
  if (known) return known;
  if (cache.size >= MAX_CACHED_PAGES) cache.clear();
  const page = load(url, ctx);
  cache.set(url, page);
  return page;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
};

function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
}

/**
 * HTML → markdown, понятный остальному коду этапа: ссылки вида [текст](url), абзацы через пустую строку.
 * Меню, подвал и боковые колонки выбрасываем: их ссылки ничего не говорят о том, кто у кого взял.
 */
export function htmlToMarkdown(html: string): string {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html;
  return unescapeHtml(
    article
      .replace(/<(script|style|noscript|svg|nav|aside|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<a\b[^>]*href=["'](https?:[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_, url: string, text: string) => {
          const label = text.replace(/<[^>]+>/g, " ").trim();
          return `[${label}](${url})`;
        },
      )
      .replace(/<\/(p|div|li|h[1-6]|blockquote|section|tr)>|<br\s*\/?>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*(\n\s*)+/g, "\n\n")
    .trim();
}

/** Выполнить для всех элементов, не больше PAGE_PARALLEL одновременно */
export async function forEachPage<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(PAGE_PARALLEL, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
    }),
  );
}
