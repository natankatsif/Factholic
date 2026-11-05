import { LOCALE_TAGS } from "../../i18n/locale";
import type { SiteDictionary } from "../../i18n/site";
import type { PlatformId } from "./SupportedPlatforms";

/** Заготовка для поля ввода: что показать в подсказке и что подставить */
export interface InputExample {
  /** Подпись в подсказке */
  label: string;
  /** Откуда: «TV8 · 2:21» — для видео */
  meta?: string;
  /** Что подставить в поле */
  value: string;
}

/** «point.md · 4 окт.» — дата на языке интерфейса */
function dated(outlet: string, iso: string, t: SiteDictionary): string {
  const date = new Date(iso).toLocaleDateString(LOCALE_TAGS[t.locale], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${outlet} · ${date}`;
}

/**
 * Заготовки в подсказке у иконки поля: зависят от выбранной плашки «Попробуй с» (null — текст).
 * Статьи — новости point.md (бэкенд читает их текст и дату, проверено 2026-10-04): это заголовки публикаций, их не переводим.
 * Видео — настоящие публичные ролики молдавских и румынских редакций (проверены yt-dlp, 2026-10-04): подписи к ним наши,
 * лежат в словаре в том же порядке. Пропадёт ролик — замени здесь и там.
 * Для TikTok, Facebook и X заготовок пока нет — подсказка объясняет, где взять ссылку.
 */
export function inputExamples(t: SiteDictionary): Record<PlatformId | "text", InputExample[]> {
  const { textExamples, youtubeExamples, shortsExamples } = t.input;
  return {
    text: textExamples.map((text) => ({ label: text, value: text })),
    youtube: [
      {
        label: youtubeExamples[0]!,
        meta: "TV8 · 2:21",
        value: "https://www.youtube.com/watch?v=13R5R5nTcsk",
      },
      {
        label: youtubeExamples[1]!,
        meta: "Euronews Romania · 2:39",
        value: "https://www.youtube.com/watch?v=SRBdjcwd2kg",
      },
      {
        label: youtubeExamples[2]!,
        meta: "Observator News · 3:22",
        value: "https://www.youtube.com/watch?v=6cSjoliLTRQ",
      },
    ],
    shorts: [
      {
        label: shortsExamples[0]!,
        meta: "Știrile ProTV · 0:18",
        value: "https://www.youtube.com/shorts/y8R3mO0fEvk",
      },
      {
        label: shortsExamples[1]!,
        meta: "Euronews по-русски · 0:36",
        value: "https://www.youtube.com/shorts/-zIZmU01sIM",
      },
      {
        label: shortsExamples[2]!,
        meta: "B1 · 1:00",
        value: "https://www.youtube.com/shorts/oVoSIJJsAYc",
      },
    ],
    link: [
      {
        label: "Пожилые люди составляют больше четверти населения Молдовы",
        meta: dated("point.md", "2026-10-04", t),
        value:
          "https://point.md/ru/novosti/obschestvo/pozhilye-liudi-sostavliaiut-bol-she-chetverti-naseleniia-moldovy/",
      },
      {
        label: "Экспорт IT-услуг из Молдовы сократился на 10%",
        meta: dated("point.md", "2026-10-03", t),
        value:
          "https://point.md/ru/novosti/ekonomika/eksport-uslug-sviazannykh-s-programmnymi-obespecheniiami-iz-moldovy-sokratilsia-na-10/",
      },
      {
        label: "Оборот творческой индустрии Молдовы достиг 5,6 млрд леев",
        meta: dated("point.md", "2026-10-03", t),
        value:
          "https://point.md/ru/novosti/ekonomika/oborot-tvorcheskoi-industrii-moldovy-dostig-5-6-mlrd-leev/",
      },
      {
        label: "В Молдове обнаружили фрагменты дронов S8000 Banderol",
        meta: dated("point.md", "2026-10-03", t),
        value:
          "https://point.md/ru/novosti/obschestvo/v-moldove-obnaruzhili-fragmenty-dronov-s8000-banderol/",
      },
    ],
    tiktok: [],
    facebook: [],
    x: [],
  };
}
