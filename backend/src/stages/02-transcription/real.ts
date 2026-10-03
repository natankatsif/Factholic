import { config } from "../../config.ts";
import { PipelineError, type Stage } from "../../pipeline/context.ts";
import type { AudioChunk } from "../01-ingest/types.ts";
import { toLanguageCode, whisperTranscribe } from "./openai.ts";
import { cuesToWords, textToSegments, wordsToSegments } from "./sentences.ts";
import type { TranscriptSegment, TranscriptionInput, TranscriptionOutput, TranscriptWord } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_TRANSCRIPTION=real)
 *  captions → ASR не вызываем: cues → слова → предложения
 *  text     → статья / вставленный текст: просто режем на предложения (таймкодов нет, 0–0)
 *  audio    → ASR (сейчас поддержан ASR_PROVIDER=openai, модель whisper-1) с пословными таймкодами,
 *             все времена сдвигаем на chunk.range.start (время куска → время видео)
 */
export const transcribeReal: Stage<TranscriptionInput, TranscriptionOutput> = async (input, ctx) => {
  const { chunk } = input;
  const base = { jobId: chunk.jobId, seq: chunk.seq, range: chunk.range };

  if (chunk.kind === "captions") {
    return {
      ...base,
      language: chunk.language,
      origin: "captions",
      segments: wordsToSegments(cuesToWords(chunk.cues), chunk.seq),
    };
  }

  if (chunk.kind === "text") {
    return {
      ...base,
      language: chunk.language ?? input.languageHint ?? "und",
      origin: "text",
      segments: textToSegments(chunk.text, chunk.seq),
    };
  }

  const segments = await transcribeAudio(chunk, input.languageHint, ctx.signal);
  return { ...base, ...segments, origin: "asr" };
};

/** Фрагменты, где Whisper почти уверен, что речи нет (он любит "галлюцинировать" текст на тишине) */
const NO_SPEECH_THRESHOLD = 0.8;

async function transcribeAudio(
  chunk: AudioChunk,
  languageHint: string | undefined,
  signal: AbortSignal,
): Promise<Pick<TranscriptionOutput, "language" | "segments">> {
  const { provider, apiKey } = config.providers.asr;
  if (provider !== "openai") {
    throw new PipelineError(
      "INTERNAL",
      `ASR_PROVIDER="${provider}" не поддержан, сейчас есть только "openai"`,
    );
  }
  if (!apiKey) throw new PipelineError("INTERNAL", "ASR_API_KEY пустой — впиши ключ OpenAI в корневой .env");

  const res = await whisperTranscribe(chunk, apiKey, languageHint, signal);

  // ⚠️ Главное место этапа: Whisper считает время от начала КУСКА, а нам нужно от начала ВИДЕО
  const offset = chunk.range.start;
  const abs = (t: number) => Math.round((offset + t) * 1000) / 1000;

  const words: TranscriptWord[] = (res.words ?? []).map((w) => ({
    text: w.word.trim(),
    start: abs(w.start),
    end: abs(w.end),
  }));

  // Сегменты Whisper — это куски между паузами, а не предложения. Слова раскладываем по ним по времени.
  const raw: TranscriptSegment[] = (res.segments ?? [])
    .filter((s) => s.no_speech_prob < NO_SPEECH_THRESHOLD && s.text.trim())
    .map((s) => ({
      id: "",
      start: abs(s.start),
      end: abs(s.end),
      text: s.text.trim(),
      // avg_logprob — средний логарифм вероятности токенов; exp() даёт грубую уверенность 0..1
      confidence: Math.round(Math.exp(s.avg_logprob) * 100) / 100,
      words: [],
    }));

  // Каждое слово — ровно в один сегмент: в последний, который начался не позже слова
  for (const w of words) {
    const seg = [...raw].reverse().find((s) => s.start <= w.start + 0.05) ?? raw[0];
    seg?.words!.push(w);
  }

  return {
    language: toLanguageCode(res.language, languageHint ?? "und"),
    segments: mergeIntoSentences(raw).map((s, i) => ({ ...s, id: `${chunk.seq}_${i}` })),
  };
}

const SENTENCE_END = /[.!?…]["»”)]*$/;
/** Не склеиваем через паузу длиннее — это уже точно разные фразы */
const MAX_MERGE_GAP_SEC = 1.5;
/** И не делаем предложение длиннее — тезис должен иметь узкий таймкод */
const MAX_SENTENCE_SEC = 20;

/**
 * Whisper режет по паузам: "By show of hands, how many of you" | "all have been asked a question before?"
 * Склеиваем фрагменты, пока фраза не закончится на . ! ? — чтобы тезис на этапе 03 не оказался разрезан.
 */
function mergeIntoSentences(segments: TranscriptSegment[]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const s of segments) {
    const prev = out.at(-1);
    const canMerge =
      prev &&
      !SENTENCE_END.test(prev.text) &&
      s.start - prev.end <= MAX_MERGE_GAP_SEC &&
      s.end - prev.start <= MAX_SENTENCE_SEC;
    if (!canMerge) {
      out.push({ ...s, words: [...(s.words ?? [])] });
      continue;
    }
    prev.end = s.end;
    prev.text = `${prev.text} ${s.text}`;
    prev.words!.push(...(s.words ?? []));
    // уверенность склеенной фразы — по самому неуверенному куску
    prev.confidence = Math.min(prev.confidence ?? 1, s.confidence ?? 1);
  }
  return out;
}
