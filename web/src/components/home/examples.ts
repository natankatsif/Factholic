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

/**
 * Заготовки в подсказке у иконки поля: зависят от выбранной плашки «Попробуй с» (null — текст).
 * Статьи — новости point.md (бэкенд читает их текст и дату, проверено 2026-10-04).
 * Видео — настоящие публичные ролики молдавских и румынских редакций (проверены yt-dlp, 2026-10-04);
 * пропадёт ролик — замени здесь. Для TikTok, Facebook и X заготовок пока нет — подсказка объясняет, где взять ссылку.
 */
export const INPUT_EXAMPLES: Record<PlatformId | "text", InputExample[]> = {
  text: [
    {
      label: "Вчера Кишинёв завалило снегом — полметра за ночь, школы закрыты.",
      value: "Вчера Кишинёв завалило снегом — полметра за ночь, школы закрыты.",
    },
    {
      label: "С 1 октября цены на газ в Молдове выросли на 30%.",
      value: "С 1 октября цены на газ в Молдове выросли на 30%.",
    },
    {
      label: "Мэрия Кишинёва закрыла пять школ на ремонт.",
      value: "Мэрия Кишинёва закрыла пять школ на ремонт.",
    },
    { label: "Война в Украине началась в 2023 году.", value: "Война в Украине началась в 2023 году." },
  ],
  youtube: [
    {
      label: "Новая система в аэропорту Кишинёва",
      meta: "TV8 · 2:21",
      value: "https://www.youtube.com/watch?v=13R5R5nTcsk",
    },
    {
      label: "Майя Санду: Молдова не будет медлить с просьбой о поддержке",
      meta: "Euronews Romania · 2:39",
      value: "https://www.youtube.com/watch?v=SRBdjcwd2kg",
    },
    {
      label: "Республика Молдова — следующая цель Путина?",
      meta: "Observator News · 3:22",
      value: "https://www.youtube.com/watch?v=6cSjoliLTRQ",
    },
  ],
  shorts: [
    {
      label: "Путин отменил указ о суверенитете Молдовы",
      meta: "Știrile ProTV · 0:18",
      value: "https://www.youtube.com/shorts/y8R3mO0fEvk",
    },
    {
      label: "В Кишинёве прошла многотысячная акция протеста",
      meta: "Euronews по-русски · 0:36",
      value: "https://www.youtube.com/shorts/-zIZmU01sIM",
    },
    {
      label: "Молдова и Украина: переговоры о вступлении в ЕС",
      meta: "B1 · 1:00",
      value: "https://www.youtube.com/shorts/oVoSIJJsAYc",
    },
  ],
  link: [
    {
      label: "Пожилые люди составляют больше четверти населения Молдовы",
      meta: "point.md · 4 окт.",
      value:
        "https://point.md/ru/novosti/obschestvo/pozhilye-liudi-sostavliaiut-bol-she-chetverti-naseleniia-moldovy/",
    },
    {
      label: "Экспорт IT-услуг из Молдовы сократился на 10%",
      meta: "point.md · 3 окт.",
      value:
        "https://point.md/ru/novosti/ekonomika/eksport-uslug-sviazannykh-s-programmnymi-obespecheniiami-iz-moldovy-sokratilsia-na-10/",
    },
    {
      label: "Оборот творческой индустрии Молдовы достиг 5,6 млрд леев",
      meta: "point.md · 3 окт.",
      value:
        "https://point.md/ru/novosti/ekonomika/oborot-tvorcheskoi-industrii-moldovy-dostig-5-6-mlrd-leev/",
    },
    {
      label: "В Молдове обнаружили фрагменты дронов S8000 Banderol",
      meta: "point.md · 3 окт.",
      value: "https://point.md/ru/novosti/obschestvo/v-moldove-obnaruzhili-fragmenty-dronov-s8000-banderol/",
    },
  ],
  tiktok: [],
  facebook: [],
  x: [],
};

/** Где взять ссылку, когда заготовок нет */
export const LINK_HINT: Partial<Record<PlatformId, string>> = {
  tiktok: "В TikTok: «Поделиться» → «Копировать ссылку» и вставь сюда",
  facebook: "В Facebook: «…» у поста → «Копировать ссылку» и вставь сюда",
  x: "В X: «Поделиться» под постом → «Копировать ссылку» и вставь сюда",
};
