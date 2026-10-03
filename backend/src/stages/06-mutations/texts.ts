/**
 * Тексты, которые этап 06 пишет сам, без LLM: подписи для before / after (уверенность,
 * «без ссылки на источник», даты) и шаблонные note — когда LLM не ответила или пропустила кандидата.
 * Время в before / after — как сказано в публикации (time.text), его не переводим.
 * Языки UI, которых нет в списке, получают английский.
 */
import type { LanguageCode } from "@news/contracts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import type { ClaimMutation, MutationField } from "./types.ts";

type Direction = ClaimMutation["direction"];

interface Texts {
  /** На месте детали, которой у узла нет: число пропало / появилось */
  absent: string;
  certainty: Record<ClaimStructure["certainty"], string>;
  /** attributedTo: null — утверждение подано от себя */
  noAttribution: string;
  /** Родитель о времени молчит — событие было не позже его публикации */
  notLaterThan: (date: string) => string;
  /** Месяцы для «20 декабря 2024» */
  months: string[];
  /** Начало шаблонного note; changed — для направлений, которых нет в записи */
  notes: Record<MutationField, Partial<Record<Direction, string>> & { changed: string }>;
}

const TEXTS: Record<string, Texts> = {
  ru: {
    absent: "—",
    certainty: { asserted: "как факт", reported: "со ссылкой на источник", hedged: "предположительно" },
    noAttribution: "без ссылки на источник",
    notLaterThan: (date) => `не позднее ${date}`,
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
    notes: {
      numbers: {
        inflated: "Число выросло",
        deflated: "Число уменьшилось",
        added: "Появилось число",
        removed: "Пропало число",
        changed: "Число изменилось",
      },
      place: { changed: "Изменилось место" },
      time: { shifted: "Событие сдвинуто во времени", changed: "Изменилось время события" },
      certainty: {
        inflated: "Подано увереннее",
        deflated: "Подано осторожнее",
        changed: "Изменилась уверенность",
      },
      attribution: { changed: "Изменилось, на кого ссылаются" },
    },
  },
  uk: {
    absent: "—",
    certainty: { asserted: "як факт", reported: "з посиланням на джерело", hedged: "імовірно" },
    noAttribution: "без посилання на джерело",
    notLaterThan: (date) => `не пізніше ${date}`,
    months: [
      "січня",
      "лютого",
      "березня",
      "квітня",
      "травня",
      "червня",
      "липня",
      "серпня",
      "вересня",
      "жовтня",
      "листопада",
      "грудня",
    ],
    notes: {
      numbers: {
        inflated: "Число зросло",
        deflated: "Число зменшилося",
        added: "З’явилося число",
        removed: "Зникло число",
        changed: "Число змінилося",
      },
      place: { changed: "Змінилося місце" },
      time: { shifted: "Подію зсунуто в часі", changed: "Змінився час події" },
      certainty: {
        inflated: "Подано впевненіше",
        deflated: "Подано обережніше",
        changed: "Змінилася впевненість",
      },
      attribution: { changed: "Змінилося, на кого посилаються" },
    },
  },
  en: {
    absent: "—",
    certainty: { asserted: "as fact", reported: "citing a source", hedged: "possibly" },
    noAttribution: "no attribution",
    notLaterThan: (date) => `no later than ${date}`,
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
    notes: {
      numbers: {
        inflated: "The number grew",
        deflated: "The number shrank",
        added: "A number appeared",
        removed: "A number disappeared",
        changed: "The number changed",
      },
      place: { changed: "The place changed" },
      time: { shifted: "The event was shifted in time", changed: "The time of the event changed" },
      certainty: {
        inflated: "Presented with more certainty",
        deflated: "Presented with less certainty",
        changed: "The certainty changed",
      },
      attribution: { changed: "The attributed source changed" },
    },
  },
};

export function textsFor(uiLanguage: LanguageCode): Texts {
  return TEXTS[uiLanguage] ?? TEXTS.en;
}

/** «20 декабря 2024» / «20 December 2024» — по номеру суток UTC от 1970-01-01 */
export function formatDay(day: number, uiLanguage: LanguageCode): string {
  const d = new Date(day * 86_400_000);
  return `${d.getUTCDate()} ${textsFor(uiLanguage).months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Шаблонный note: «Число выросло: «до 10 см» → «30 см».» */
export function templateNote(
  m: Pick<ClaimMutation, "field" | "direction" | "before" | "after">,
  uiLanguage: LanguageCode,
): string {
  const notes = textsFor(uiLanguage).notes[m.field];
  return `${notes[m.direction] ?? notes.changed}: «${m.before}» → «${m.after}».`;
}
