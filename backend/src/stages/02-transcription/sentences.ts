/**
 * Субтитры → слова → предложения (TranscriptSegment).
 *
 * Зачем через слова: этапу 03 нужны пословные таймкоды, чтобы указать точный range тезиса
 * (20:21–20:23, а не весь 30-секундный кусок).
 *   - автосубтитры YouTube: одна cue = одно слово, время точное;
 *   - ручные субтитры: одна cue = строка, время слов внутри строки оцениваем пропорционально длине слова.
 */
import type { Seconds } from "@news/contracts";
import type { CaptionsChunk } from "../01-ingest/types.ts";
import type { TranscriptSegment, TranscriptWord } from "./types.ts";

/** Пауза больше этой — точно конец фразы (для автосубтитров без пунктуации) */
const PAUSE_SEC = 0.8;
/** Предложение не длиннее — иначе тезис на этапе 03 будет слишком размытым */
const MAX_SENTENCE_SEC = 15;
const SENTENCE_END = /[.!?…]["»”)]*$/;

/** Пометки субтитров, а не речь: (Laughter), [Music], [Аплодисменты], ♪ */
const NON_SPEECH = /\([^)]*\)|\[[^\]]*\]|♪+/g;

/** cues → слова с абсолютным временем */
export function cuesToWords(cues: CaptionsChunk["cues"]): TranscriptWord[] {
  return cues.flatMap((cue) => {
    const tokens = cue.text.replace(NON_SPEECH, " ").split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return tokens.map((text) => ({ text, start: cue.start, end: cue.end }));

    // Строка из нескольких слов: делим её время между словами по количеству букв
    const total = tokens.reduce((n, t) => n + t.length, 0);
    const span = cue.end - cue.start;
    let t = cue.start;
    return tokens.map((text) => {
      const start = t;
      t += (span * text.length) / total;
      return { text, start: round(start), end: round(t) };
    });
  });
}

/**
 * Склеивает слова в предложения. Конец предложения:
 *   - слово заканчивается на . ! ? …
 *   - или пауза перед следующим словом > PAUSE_SEC
 *   - или предложение стало длиннее MAX_SENTENCE_SEC
 */
export function wordsToSegments(words: TranscriptWord[], seq: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];

  const flush = () => {
    if (!current.length) return;
    segments.push({
      id: `${seq}_${segments.length}`,
      start: current[0]!.start,
      end: current.at(-1)!.end,
      text: capitalize(current.map((w) => w.text).join(" ")),
      words: current,
    });
    current = [];
  };

  words.forEach((w, i) => {
    current.push(w);
    const next = words[i + 1];
    const pause = next ? next.start - w.end : Infinity;
    const tooLong = w.end - current[0]!.start >= MAX_SENTENCE_SEC;
    if (SENTENCE_END.test(w.text) || pause > PAUSE_SEC || tooLong) flush();
  });
  flush();
  return segments;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round(t: Seconds): Seconds {
  return Math.round(t * 1000) / 1000;
}

/**
 * Текст статьи → предложения. Таймкодов нет (start = end = 0), слов тоже: этап 03 для текста
 * берёт range как есть. Абзац не склеиваем с соседним — это разные мысли.
 */
export function textToSegments(text: string, seq: number): TranscriptSegment[] {
  const sentences = text
    .split(/\n\n+/)
    // точка + пробел + заглавная/кавычка/цифра — конец предложения; «т. е.» и «г. Кишинёв» почти не ломает
    .flatMap((p) => p.split(/(?<=[.!?…])\s+(?=[«"„(A-ZА-ЯЁĂÂÎȘŞȚŢ0-9])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return sentences.map((s, i) => ({ id: `${seq}_${i}`, start: 0, end: 0, text: s }));
}
