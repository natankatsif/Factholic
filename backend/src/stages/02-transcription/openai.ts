/**
 * OpenAI Whisper (модель whisper-1) — распознавание звука с пословными таймкодами.
 * Документация: POST https://api.openai.com/v1/audio/transcriptions
 *
 * Важно: whisper-1 — единственная модель OpenAI, которая отдаёт время каждого слова
 * (response_format=verbose_json + timestamp_granularities). Новые gpt-4o-transcribe так не умеют.
 */
import type { LanguageCode } from "@news/contracts";
import { PipelineError } from "../../pipeline/context.ts";
import type { AudioChunk } from "../01-ingest/types.ts";

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

/** Ответ verbose_json. Время — в секундах ОТ НАЧАЛА ФАЙЛА (то есть от начала куска, не видео!) */
export interface WhisperResponse {
  /** Внимание: полное название ("english", "russian"), а не код "en" */
  language: string;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
  segments?: Array<{ start: number; end: number; text: string; avg_logprob: number; no_speech_prob: number }>;
}

export async function whisperTranscribe(
  chunk: AudioChunk,
  apiKey: string,
  languageHint: LanguageCode | undefined,
  signal: AbortSignal,
): Promise<WhisperResponse> {
  const form = new FormData();
  // Расширение файла важно: по нему OpenAI понимает формат (wav, webm...)
  form.append("file", new Blob([new Uint8Array(chunk.data)]), `chunk_${chunk.seq}.${chunk.format}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  // Подсказка языка улучшает качество и скорость (особенно для смешанной RU/RO речи)
  if (languageHint) form.append("language", languageHint);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok) {
    const body = await res.text();
    const cause = new Error(`OpenAI Whisper: HTTP ${res.status} ${body.slice(0, 300)}`);
    // 429 — превышен лимит запросов ИЛИ закончились деньги на счёте (insufficient_quota)
    if (res.status === 429) {
      const noMoney = body.includes("insufficient_quota");
      throw new PipelineError(
        noMoney ? "INTERNAL" : "RATE_LIMITED",
        noMoney
          ? "На счёте OpenAI закончились деньги"
          : "Сервис распознавания речи перегружен, попробуй через минуту",
        { cause },
      );
    }
    if (res.status === 401)
      throw new PipelineError("INTERNAL", "Неверный ключ OpenAI (ASR_API_KEY)", { cause });
    throw new PipelineError("TRANSCRIPTION_FAILED", "Не удалось распознать речь в видео", { cause });
  }
  return (await res.json()) as WhisperResponse;
}

/** "english" → "en". Whisper возвращает названия, а в проекте везде коды ISO 639-1. */
const LANGUAGE_CODES: Record<string, LanguageCode> = {
  english: "en",
  russian: "ru",
  romanian: "ro",
  moldavian: "ro",
  moldovan: "ro",
  ukrainian: "uk",
  german: "de",
  french: "fr",
  spanish: "es",
  italian: "it",
  turkish: "tr",
  polish: "pl",
};

export function toLanguageCode(name: string, fallback: LanguageCode): LanguageCode {
  const key = name.toLowerCase();
  if (key.length === 2) return key;
  return LANGUAGE_CODES[key] ?? fallback;
}
