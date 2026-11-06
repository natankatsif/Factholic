/**
 * Копия статьи для встроенного окна: сайты обычно запрещают показывать себя в чужом фрейме.
 * Отдаём страницу сами, без её скриптов, форм и фреймов. CSS и картинки грузятся с оригинала через <base>.
 * Наш скрипт обводит утверждения и сообщает родителю о клике. Подход взят из проекта spott (api/preview.py).
 */
import { randomBytes } from "node:crypto";
import { parseHTML } from "linkedom";
import { PAGE_VIEW_SCRIPT, PAGE_VIEW_STYLE } from "./page-view-script.ts";

const TIMEOUT_MS = 15_000;
const MAX_HTML_CHARS = 5_000_000;
const CACHE_MS = 60 * 60 * 1000;
/** Вместо статьи сайт показал проверку посетителя: такую страницу показывать нечего */
const CHALLENGE_PAGE = /<title>\s*(just a moment|attention required)/i;

const DROP = [
  "script",
  "noscript",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "portal",
  "base",
  "meta[http-equiv]",
  "link[rel=preload]",
  "link[rel=modulepreload]",
  "link[rel=prefetch]",
  "link[rel=dns-prefetch]",
  "link[rel=preconnect]",
  "link[rel=manifest]",
].join(",");
const URL_ATTRS = new Set(["href", "src", "action", "xlink:href", "data", "poster", "background", "srcset"]);
const BAD_URL = /^\s*(javascript|vbscript|data:text\/html)/i;

export interface PageView {
  html: string;
  csp: string;
}

/** Страница без всего, что выполняется. Вёрстка остаётся */
export function sanitizePage(pageHtml: string, pageUrl: string, nonce: string): string {
  const { document } = parseHTML(pageHtml);
  for (const node of document.querySelectorAll(DROP)) node.remove();
  for (const node of document.querySelectorAll("*")) {
    for (const { name, value } of [...node.attributes]) {
      const low = name.toLowerCase();
      const bad = low.startsWith("on") || low === "srcdoc" || low === "ping" || low === "formaction";
      if (bad || (URL_ATTRS.has(low) && BAD_URL.test(value))) node.removeAttribute(name);
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "a") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    } else if (tag === "form") {
      node.removeAttribute("action");
      node.removeAttribute("method");
    } else if (tag === "img") {
      // картинки «по мере прокрутки» подставляют скрипты сайта, а их здесь нет
      const lazy = node.getAttribute("data-src") ?? node.getAttribute("data-lazy-src");
      if (lazy && !BAD_URL.test(lazy)) node.setAttribute("src", lazy);
      node.removeAttribute("loading");
    }
  }
  const head = document.querySelector("head");
  const base = document.createElement("base");
  base.setAttribute("href", pageUrl);
  head?.prepend(base);
  // окно получает страницу как текст, заголовки ответа до него не доходят
  const rules = document.createElement("meta");
  rules.setAttribute("http-equiv", "Content-Security-Policy");
  rules.setAttribute("content", policy(nonce));
  head?.prepend(rules);
  const style = document.createElement("style");
  style.textContent = PAGE_VIEW_STYLE;
  head?.append(style);
  const script = document.createElement("script");
  script.setAttribute("nonce", nonce);
  script.textContent = PAGE_VIEW_SCRIPT;
  document.querySelector("body")?.append(script);
  return `<!doctype html>${document.documentElement?.outerHTML ?? ""}`;
}

function policy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src * 'unsafe-inline'",
    "img-src * data:",
    "font-src * data:",
    "media-src *",
    "base-uri http: https:",
    "form-action 'none'",
  ].join("; ");
}

/** Страницу показать не вышло: родитель вернётся к обычному тексту */
export function failedPageView(): PageView {
  const nonce = randomBytes(16).toString("base64");
  return {
    html: `<!doctype html><script nonce="${nonce}">parent.postMessage({type:"fh:failed"},"*")</script>`,
    csp: policy(nonce),
  };
}

const cache = new Map<string, { at: number; html: string }>();

async function download(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.html;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; FactCheckBot/1.0)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`страница: HTTP ${res.status}`);
  if (!res.headers.get("content-type")?.includes("html")) throw new Error("страница: не HTML");
  const html = (await res.text()).slice(0, MAX_HTML_CHARS);
  if (CHALLENGE_PAGE.test(html.slice(0, 2_000))) throw new Error("страница: сайт показал проверку");
  cache.set(url, { at: Date.now(), html });
  return html;
}

const IMAGE_TAGS = [
  'meta[property="og:image"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  'meta[property="twitter:image:src"]',
  'meta[name="twitter:image:src"]',
].join(",");

/** Картинка, которую сайт сам выбрал для превью. Логотипы из вёрстки не берём */
export function imageOfPage(pageHtml: string, pageUrl: string): string | undefined {
  const { document } = parseHTML(pageHtml);
  const tag = document.querySelector(IMAGE_TAGS);
  const value =
    tag?.getAttribute("content") ?? document.querySelector('link[rel="image_src"]')?.getAttribute("href");
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), pageUrl);
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const images = new Map<string, { at: number; image?: string }>();

/** Материал удалили: следующий запрос снова идёт на сайт */
export function forgetPage(url: string): void {
  cache.delete(url);
  images.delete(url);
}

/** Превью страницы. Сайт закрыт — просто нет картинки, и запрос не повторяем каждый раз */
export async function loadPageImage(url: string): Promise<string | undefined> {
  if (!/^https?:\/\//i.test(url)) return undefined;
  const hit = images.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.image;
  const image = await download(url)
    .then((html) => imageOfPage(html, url))
    .catch(() => undefined);
  images.set(url, { at: Date.now(), image });
  return image;
}

export async function loadPageView(url: string): Promise<PageView> {
  if (!/^https?:\/\//i.test(url)) return failedPageView();
  try {
    const nonce = randomBytes(16).toString("base64");
    return { html: sanitizePage(await download(url), url, nonce), csp: policy(nonce) };
  } catch (err) {
    console.error("страница статьи не загрузилась", url, String(err));
    return failedPageView();
  }
}
