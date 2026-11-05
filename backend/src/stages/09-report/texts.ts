/**
 * Тексты, которые этап 09 пишет сам: флаги, итог, подписи дерева, даты. Цитаты и названия изданий не переводим.
 * Языки UI, которых нет в списке, получают английский (как в этапах 06 и 08).
 */
import type { LanguageCode } from "@news/contracts";

export interface ReportTexts {
  /** Месяцы для «20 декабря 2024» */
  months: string[];
  /** Дробная часть числа: 3,5 / 3.5 */
  decimalSeparator: string;
  flags: {
    oldContent: string;
    oldContentDetail: (date: string) => string;
    exaggerated: string;
    numbersDiffer: string;
    numberNotFromRoot: string;
    /** По этой подписи код отличает серьёзное искажение от мягких флагов */
    distortion: string;
    moreCertain: string;
    attributionRemoved: string;
    sourceReplaced: string;
  };
  keyFinding: {
    insufficient: string;
    /** Вместо деталей из этапа 04: он пишет их только по-русски */
    insufficientDetail: string;
    yearsOld: (years: string) => string;
    monthsOld: (months: number) => string;
    daysOld: (days: number) => string;
    presentedAsRecent: string;
    laterDateClaimed: string;
  };
  consensus: {
    refutedByRoot: (authority: string) => string;
    sourcesObject: string;
    exaggeratedAndOld: string;
    oldContent: string;
    exaggerated: string;
    insufficient: (detail: string) => string;
    confirmedByRoot: (authority: string) => string;
    positionsAgree: string;
    split: string;
    fewSources: string;
  };
  node: {
    media: string;
    official: string;
    channel: string;
    debunk: string;
    earliest: string;
    sourceNotFound: string;
    dateUnknown: string;
    citedBy: (count: number) => string;
    watchFragment: string;
    openSource: string;
    /** Издание без названия */
    source: string;
  };
  change: { numbers: string; place: string; time: string; certainty: string; attribution: string };
  edge: { changed: string; unchanged: string; probable: string; cites: string };
  path: { original: string; chainStart: string; retelling: string };
  silenceYears: (years: string) => string;
}

const TEXTS: Record<string, ReportTexts> = {
  ru: {
    months: [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ],
    decimalSeparator: ",",
    flags: {
      oldContent: "Старый контент",
      oldContentDetail: (date) => `самая ранняя из найденных публикаций от ${date}`,
      exaggerated: "Раздуто",
      numbersDiffer: "Расхождение в цифрах",
      numberNotFromRoot: "Цифра не из первоисточника",
      distortion: "Искажение",
      moreCertain: "Подано увереннее",
      attributionRemoved: "Убрана ссылка на источник",
      sourceReplaced: "Подменён источник",
    },
    keyFinding: {
      insufficient: "Недостаточно информации",
      insufficientDetail: "найденные публикации не подтверждают ключевые детали",
      yearsOld: (years) => `Событию ${years} года`,
      monthsOld: (months) => `Событию ${months} месяцев`,
      daysOld: (days) => `Событию ${days} дней`,
      presentedAsRecent: "в видео подано как недавнее",
      laterDateClaimed: "а в видео указана более поздняя дата",
    },
    consensus: {
      refutedByRoot: (authority) => `опровергает первоисточник: ${authority}`,
      sourcesObject: "источники возражают",
      exaggeratedAndOld: "раздуто • старое",
      oldContent: "старый контент",
      exaggerated: "раздуто",
      insufficient: (detail) => `недостаточно информации: ${detail}`,
      confirmedByRoot: (authority) => `подтверждает первоисточник: ${authority}`,
      positionsAgree: "позиции совпадают",
      split: "мнения расходятся",
      fewSources: "мало источников",
    },
    node: {
      media: "СМИ",
      official: "официальный",
      channel: "паблик",
      debunk: "разбор",
      earliest: "самая ранняя из найденных",
      sourceNotFound: "источник не найден",
      dateUnknown: "дата неизвестна",
      citedBy: (count) => `На этот источник ссылаются публикации: ${count}`,
      watchFragment: "Смотреть фрагмент ↗",
      openSource: "Открыть источник ↗",
      source: "Источник",
    },
    change: {
      numbers: "Цифры",
      place: "Место",
      time: "Время",
      certainty: "Уверенность",
      attribution: "Источник",
    },
    edge: {
      changed: "пересказ с изменениями",
      unchanged: "пересказ без изменений",
      probable: "вероятно взят отсюда",
      cites: "ссылается на этот источник",
    },
    path: { original: "оригинал", chainStart: "начало цепочки", retelling: "пересказ" },
    silenceYears: (years) => `${years} года тишины`,
  },
  ro: {
    months: [
      "ianuarie",
      "februarie",
      "martie",
      "aprilie",
      "mai",
      "iunie",
      "iulie",
      "august",
      "septembrie",
      "octombrie",
      "noiembrie",
      "decembrie",
    ],
    decimalSeparator: ",",
    flags: {
      oldContent: "Conținut vechi",
      oldContentDetail: (date) => `cea mai veche publicație găsită este din ${date}`,
      exaggerated: "Exagerat",
      numbersDiffer: "Cifre diferite",
      numberNotFromRoot: "Cifră care nu vine din sursa primară",
      distortion: "Denaturare",
      moreCertain: "Prezentat cu mai multă siguranță",
      attributionRemoved: "Trimiterea la sursă a fost eliminată",
      sourceReplaced: "Sursa a fost înlocuită",
    },
    keyFinding: {
      insufficient: "Informații insuficiente",
      insufficientDetail: "publicațiile găsite nu confirmă detaliile-cheie",
      yearsOld: (years) => `Evenimentul are ${years} ani`,
      monthsOld: (months) => `Evenimentul are ${roCount(months, "lună", "luni")}`,
      daysOld: (days) => `Evenimentul are ${roCount(days, "zi", "zile")}`,
      presentedAsRecent: "în video este prezentat ca recent",
      laterDateClaimed: "iar în video apare o dată mai târzie",
    },
    consensus: {
      refutedByRoot: (authority) => `infirmat de sursa primară: ${authority}`,
      sourcesObject: "sursele contrazic",
      exaggeratedAndOld: "exagerat • vechi",
      oldContent: "conținut vechi",
      exaggerated: "exagerat",
      insufficient: (detail) => `informații insuficiente: ${detail}`,
      confirmedByRoot: (authority) => `confirmat de sursa primară: ${authority}`,
      positionsAgree: "pozițiile coincid",
      split: "pozițiile diferă",
      fewSources: "puține surse",
    },
    node: {
      media: "presă",
      official: "oficial",
      channel: "canal",
      debunk: "analiză",
      earliest: "cea mai veche dintre cele găsite",
      sourceNotFound: "sursă negăsită",
      dateUnknown: "dată necunoscută",
      citedBy: (count) => `Publicații care trimit la această sursă: ${count}`,
      watchFragment: "Vezi fragmentul ↗",
      openSource: "Deschide sursa ↗",
      source: "Sursă",
    },
    change: {
      numbers: "Cifre",
      place: "Loc",
      time: "Timp",
      certainty: "Siguranță",
      attribution: "Sursă",
    },
    edge: {
      changed: "repovestire cu modificări",
      unchanged: "repovestire fără modificări",
      probable: "probabil preluat de aici",
      cites: "trimite la această sursă",
    },
    path: { original: "original", chainStart: "începutul lanțului", retelling: "repovestire" },
    silenceYears: (years) => `${years} ani de tăcere`,
  },
  en: {
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    decimalSeparator: ".",
    flags: {
      oldContent: "Old content",
      oldContentDetail: (date) => `the earliest publication found is dated ${date}`,
      exaggerated: "Exaggerated",
      numbersDiffer: "Numbers differ",
      numberNotFromRoot: "Number not from the primary source",
      distortion: "Distortion",
      moreCertain: "Presented with more certainty",
      attributionRemoved: "Source attribution removed",
      sourceReplaced: "Source replaced",
    },
    keyFinding: {
      insufficient: "Not enough information",
      insufficientDetail: "the publications found do not confirm the key details",
      yearsOld: (years) => `The event is ${years} years old`,
      monthsOld: (months) => `The event is ${months} ${months === 1 ? "month" : "months"} old`,
      daysOld: (days) => `The event is ${days} ${days === 1 ? "day" : "days"} old`,
      presentedAsRecent: "the video presents it as recent",
      laterDateClaimed: "while the video gives a later date",
    },
    consensus: {
      refutedByRoot: (authority) => `refuted by the primary source: ${authority}`,
      sourcesObject: "sources object",
      exaggeratedAndOld: "exaggerated • old",
      oldContent: "old content",
      exaggerated: "exaggerated",
      insufficient: (detail) => `not enough information: ${detail}`,
      confirmedByRoot: (authority) => `confirmed by the primary source: ${authority}`,
      positionsAgree: "positions agree",
      split: "positions differ",
      fewSources: "few sources",
    },
    node: {
      media: "media",
      official: "official",
      channel: "channel",
      debunk: "fact-check",
      earliest: "earliest found",
      sourceNotFound: "source not found",
      dateUnknown: "date unknown",
      citedBy: (count) => `Publications citing this source: ${count}`,
      watchFragment: "Watch the fragment ↗",
      openSource: "Open source ↗",
      source: "Source",
    },
    change: {
      numbers: "Numbers",
      place: "Place",
      time: "Time",
      certainty: "Certainty",
      attribution: "Source",
    },
    edge: {
      changed: "retold with changes",
      unchanged: "retold without changes",
      probable: "probably taken from here",
      cites: "cites this source",
    },
    path: { original: "original", chainStart: "start of the chain", retelling: "retelling" },
    silenceYears: (years) => `${years} years of silence`,
  },
};

/** «1 lună», «5 luni», «20 de luni»: с 20 по-румынски нужен предлог */
function roCount(count: number, one: string, other: string): string {
  if (count === 1) return `1 ${one}`;
  const rest = count % 100;
  return rest === 0 || rest >= 20 ? `${count} de ${other}` : `${count} ${other}`;
}

export function textsFor(uiLanguage: LanguageCode): ReportTexts {
  return TEXTS[uiLanguage] ?? TEXTS.en;
}
