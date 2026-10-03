/**
 * Хватает ли найденного, чтобы подтвердить или опровергнуть утверждение? Чистый код, без LLM:
 * решение «искать ли дальше» должно быть предсказуемым, а LLM только придумывает, ЧТО искать.
 *
 * Жёсткие пробелы (unconfirmed) — без них вывод сделать нельзя → итог «Недостаточно информации»:
 *   - независимых сайтов по теме меньше MIN_INDEPENDENT_HARD;
 *   - число из утверждения («200 пострадавших») не называет ни один источник.
 * Мягкие пробелы (gaps) — повод для ещё одного раунда, но не приговор:
 *   - независимых сайтов меньше MIN_INDEPENDENT;
 *   - для статистики / науки / истории нет официального, научного или фактчекингового источника.
 */
import type { SourceType } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import { claimNumbers } from "./copies.ts";
import { registrableDomain, type Enriched } from "./select.ts";
import { hits, keywordStems, stemSet } from "./text.ts";

/** Сколько независимых сайтов достаточно, чтобы не искать дальше */
export const MIN_INDEPENDENT = 3;
/** Меньше — вывод делать не из чего */
export const MIN_INDEPENDENT_HARD = 2;
/** Страница «по теме» для подсчёта независимых — заметная доля ключевых слов утверждения */
const ON_TOPIC_MATCH = 0.4;

const AUTHORITATIVE: SourceType[] = ["government", "international_org", "academic", "fact_checker"];
const NEEDS_AUTHORITY = new Set(["statistic", "scientific", "historical"]);

export interface Sufficiency {
  sufficient: boolean;
  unconfirmed: string[];
  gaps: string[];
}

export function assessSufficiency(claim: Claim, relevant: Enriched[]): Sufficiency {
  const unconfirmed: string[] = [];
  const gaps: string[] = [];

  const onTopic = relevant.filter((e) => e.match >= ON_TOPIC_MATCH);
  const sites = new Set(onTopic.map((e) => registrableDomain(e.domain)));
  if (sites.size < MIN_INDEPENDENT_HARD) {
    unconfirmed.push(
      sites.size === 0 ? "не найдено ни одного источника по теме" : "найден только один независимый источник",
    );
  } else if (sites.size < MIN_INDEPENDENT) {
    gaps.push(`независимых источников только ${sites.size}`);
  }

  if (NEEDS_AUTHORITY.has(claim.category) && !relevant.some((e) => AUTHORITATIVE.includes(e.info.type))) {
    gaps.push("нет официального, научного или фактчекингового источника");
  }

  // число подтверждено, если хоть одна страница называет его (в любом написании: 2,5 / 2.5) РЯДОМ с тем,
  // что оно считает: «200 пострадавших», а не «200 метров от рынка» на той же странице
  const texts = relevant.map((e) => normalizeNumbers(`${e.candidate.title} ${e.excerpt}`));
  for (const n of claimNumbers(claim)) {
    const about = claim.structure?.numbers.find((x) => normalizeNumbers(x.value).includes(n))?.about ?? "";
    const aboutStems = keywordStems(about);
    if (!texts.some((t) => mentionsNumber(t, n, aboutStems))) {
      unconfirmed.push(`ни один источник не называет число ${n}${about ? ` (${about})` : ""}`);
    }
  }

  return { sufficient: unconfirmed.length === 0 && gaps.length === 0, unconfirmed, gaps };
}

/** Сколько символов вокруг числа смотреть, чтобы найти, что оно считает */
const NUMBER_CONTEXT_CHARS = 60;

/** Число есть в тексте, и рядом с ним (± NUMBER_CONTEXT_CHARS) — хотя бы одно слово из about (если about задан) */
export function mentionsNumber(text: string, n: string, aboutStems: string[]): boolean {
  const re = new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d]|\\.\\d)`, "g");
  for (const m of text.matchAll(re)) {
    if (!aboutStems.length) return true;
    const from = Math.max(0, m.index - NUMBER_CONTEXT_CHARS);
    const window = text.slice(from, m.index + m[0].length + NUMBER_CONTEXT_CHARS);
    if (hits(stemSet(window), aboutStems) > 0) return true;
  }
  return false;
}

/** «2,5» → «2.5», «1 200» → «1200», чтобы числа сравнивались в одном написании */
function normalizeNumbers(text: string): string {
  // \s в JS включает и неразрывные пробелы (1 200, 1 200)
  return text.replace(/(\d)\s(?=\d{3}\b)/g, "$1").replace(/(\d),(\d)/g, "$1.$2");
}
