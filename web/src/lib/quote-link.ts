/**
 * Ссылка на страницу с выделенной цитатой: браузер сам находит текст и прокручивает к нему (#:~:text=).
 * Подход взят из проекта spott (core/links.py). Текста на странице нет — страница просто откроется.
 * Открывать надо в новой вкладке с rel="noopener": иначе браузер цитату не выделит.
 */

/** Столько слов браузер ищет целиком; длинную цитату задаём началом и концом */
const WHOLE_QUOTE_WORDS = 10;
const EDGE_WORDS = 5;

/** В адресе фрагмента запятая и дефис — служебные */
const encode = (text: string) => encodeURIComponent(text).replace(/-/g, "%2D");

/** Заголовок страницы приходит с именем сайта, кавычки и многоточия на странице могут отличаться */
export function quoteWords(quote: string): string[] {
  const clean = quote
    .split(/\s+\|\s+/)[0]!
    .replace(/^[«"“„]+|[»"”]+$/g, "")
    .replace(/(\.{3}|…)\s*$/g, "")
    .trim();
  return clean.split(/\s+/).filter(Boolean);
}

export function quoteLink(url: string, quote: string): string {
  if (!url) return "";
  const words = quoteWords(quote);
  if (words.length === 0) return url;
  const directive =
    words.length <= WHOLE_QUOTE_WORDS
      ? encode(words.join(" "))
      : `${encode(words.slice(0, EDGE_WORDS).join(" "))},${encode(words.slice(-EDGE_WORDS).join(" "))}`;
  return `${url}${url.includes("#") ? "" : "#"}:~:text=${directive}`;
}
