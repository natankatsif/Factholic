/**
 * Точный таймкод тезиса: ищем слова цитаты среди пословных таймкодов сегментов.
 * Если у сегмента нет words (субтитры без разметки), раскладываем его время по словам пропорционально символам.
 */
import type { TimeRange } from "@news/contracts";
import type { TranscriptSegment } from "../02-transcription/types.ts";

interface TimedToken {
  norm: string;
  start: number;
  end: number;
}

/** Минимальная длина отрезка, чтобы карточка не мигнула на долю секунды */
const MIN_DURATION_SEC = 0.5;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Совпадение с точностью до окончания: «Украине» ~ «Украина», «войны» ~ «война» */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  return n >= 4 && a.slice(0, Math.max(4, n - 2)) === b.slice(0, Math.max(4, n - 2));
}

function timedTokens(segment: TranscriptSegment): TimedToken[] {
  if (segment.words?.length) {
    return segment.words.flatMap((w) =>
      tokenize(w.text).map((norm) => ({ norm, start: w.start, end: w.end })),
    );
  }
  // нет пословной разметки — интерполируем по позиции слова в тексте
  const text = segment.text;
  const duration = segment.end - segment.start;
  const tokens: TimedToken[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const from = m.index / text.length;
    const to = (m.index + m[0].length) / text.length;
    for (const norm of tokenize(m[0])) {
      tokens.push({ norm, start: segment.start + from * duration, end: segment.start + to * duration });
    }
  }
  return tokens;
}

/**
 * Жадно сопоставляет токены цитаты с токенами текста, начиная с позиции `from`.
 * Пропуски и лишние слова (ошибки ASR) допускаются, но окно поиска ограничено длиной цитаты.
 */
function matchFrom(tokens: TimedToken[], quote: string[], from: number) {
  const limit = Math.min(tokens.length, from + quote.length * 2 + 2);
  let cursor = from;
  let count = 0;
  let first = -1;
  let last = -1;
  for (const q of quote) {
    for (let k = cursor; k < limit; k++) {
      if (similar(tokens[k].norm, q)) {
        if (first < 0) first = k;
        last = k;
        count++;
        cursor = k + 1;
        break;
      }
    }
  }
  return { count, first, last };
}

/** Отрезок, где произносится `quote`, внутри `segments` (отсортированы по времени). */
export function locateQuote(quote: string, segments: TranscriptSegment[]): TimeRange {
  return findQuote(quote, segments).range;
}

/**
 * То же, плюс `matched` — доля слов цитаты, найденных в речи (0..1).
 * Меньше половины — цитаты в этих сегментах нет (перефраз, выдумка или кусок из контекста), range = весь отрезок.
 */
export function findQuote(
  quote: string,
  segments: TranscriptSegment[],
): { range: TimeRange; matched: number } {
  const whole: TimeRange = {
    start: Math.min(...segments.map((s) => s.start)),
    end: Math.max(...segments.map((s) => s.end)),
  };
  const q = tokenize(quote);
  const tokens = segments.flatMap(timedTokens);
  if (!q.length || !tokens.length) return { range: whole, matched: 0 };

  let best = { count: 0, first: -1, last: -1 };
  for (let i = 0; i < tokens.length; i++) {
    const m = matchFrom(tokens, q, i);
    // больше совпавших слов, при равенстве — более плотное совпадение
    const better =
      m.count > best.count ||
      (m.count === best.count && m.count > 0 && m.last - m.first < best.last - best.first);
    if (better) best = m;
  }

  const matched = best.count / q.length;
  // совпало меньше половины слов — точного места нет, честнее отдать весь отрезок
  if (best.count < Math.ceil(q.length / 2)) return { range: whole, matched };

  const start = tokens[best.first].start;
  const end = Math.max(tokens[best.last].end, start + MIN_DURATION_SEC);
  return { range: { start: round(start), end: round(end) }, matched };
}

function round(sec: number): number {
  return Math.round(sec * 100) / 100;
}
