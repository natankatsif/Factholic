import type { ISODateString } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import type { CaptionsChunk, IngestInput, IngestOutput, MediaChunk } from "./types.ts";

export const mockIngestInput: Omit<IngestInput, "liveAudio"> = {
  jobId: "job_mock_01",
  request: {
    video: {
      pageUrl: "https://www.youtube.com/watch?v=MOCK123",
      platform: "youtube",
      platformVideoId: "MOCK123",
      title: "Большое интервью: экономика, наука и мировые события",
      durationSec: 1860,
    },
    mode: "remote",
    startFrom: 1200,
    languageHint: "ru",
    uiLanguage: "ru",
  },
  chunkSec: 30,
};

/** Пример куска на выходе (здесь — субтитры, т.е. ASR будет пропущен) */
export const mockCaptionsChunk: CaptionsChunk = {
  kind: "captions",
  jobId: "job_mock_01",
  seq: 0,
  range: { start: 1200, end: 1230 },
  language: "ru",
  origin: "auto",
  cues: [
    { start: 1215.2, end: 1220.9, text: "давайте немного о том что происходит в мире" },
    { start: 1221.0, end: 1223.0, text: "в Украине сейчас идёт война" },
    { start: 1223.4, end: 1229.8, text: "и это конечно влияет на цены на всё" },
  ],
};

// ===================== ДЕМО =====================

const DEMO_VIDEO_TITLE = "Большое интервью: экономика, наука и мировые события";

/**
 * Дата публикации любого материала в демо: от неё этап 07 считает «сейчас» и «вчера», под неё подобраны даты
 * в моках 04–05. От сегодняшней даты «сейчас идёт война» (корень — Reuters, 2 октября) стало бы старым контентом.
 */
export const MOCK_PUBLISHED_AT: ISODateString = "2026-10-02T09:00:00Z";

/**
 * Демо-интервью для любой ссылки; время — от начала фрагмента, ingestMock сдвигает его на startFrom.
 * Мок этапа 03 находит здесь четыре тезиса: война идёт сейчас и 8 млрд человек (подтверждаются),
 * «вчера полметра снега» (фейк: снегопад 2021 года, раздуто), «вода кипит при 100 °C везде» (опровергается).
 */
export const mockDemoCues: CaptionsChunk["cues"] = [
  { start: 0.5, end: 3.8, text: "Давайте немного о том, что происходит в мире." },
  { start: 4.2, end: 9.6, text: "В Украине сейчас идёт война, и это, конечно, влияет на цены на всё." },
  { start: 10.4, end: 16.9, text: "Население Земли в ноябре 2022 года превысило 8 миллиардов человек." },
  { start: 17.6, end: 23.8, text: "А у нас вчера Кишинёв завалило снегом — полметра за одну ночь!" },
  { start: 24.4, end: 27.2, text: "Город встал в пробках." },
  { start: 31.0, end: 37.6, text: "Кстати, вода кипит при ста градусах везде — хоть на море, хоть в горах." },
  { start: 38.2, end: 42.5, text: "Это школьная физика, тут спорить не о чем." },
  { start: 43.4, end: 49.0, text: "Ну а теперь — к экономике и к тому, что нас ждёт этой зимой." },
];

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_INGEST=mock) =====================

/**
 * Вставленный текст — как в real: один кусок без таймкодов, тезисы в нём узнаёт мок этапа 03.
 * Ссылка (видео, статья, картинка) — демо-интервью кусками по chunkSec с позиции startFrom.
 */
export const ingestMock: Stage<IngestInput, IngestOutput> = async (input) => {
  const { request, jobId, chunkSec } = input;
  const { video } = request;
  const base = {
    pageUrl: video.pageUrl,
    platform: video.platform,
    platformVideoId: video.platformVideoId,
    publishedAt: MOCK_PUBLISHED_AT,
  };

  const text = request.text?.trim();
  if (text) {
    const language = request.languageHint ?? "ru";
    return {
      video: { ...base, title: video.title ?? firstSentence(text), durationSec: 0, language },
      chunks: (async function* (): AsyncIterable<MediaChunk> {
        yield { kind: "text", jobId, seq: 0, range: { start: 0, end: 0 }, language, origin: "pasted", text };
      })(),
    };
  }

  const from = request.startFrom;
  const end = Math.max(...mockDemoCues.map((c) => c.end));
  async function* chunks(): AsyncIterable<MediaChunk> {
    for (let seq = 0; seq * chunkSec < end; seq++) {
      const start = seq * chunkSec;
      const cues = mockDemoCues
        .filter((c) => c.start >= start && c.start < start + chunkSec)
        .map((c) => ({ ...c, start: from + c.start, end: from + c.end }));
      const range = { start: from + start, end: from + start + chunkSec };
      yield { kind: "captions", jobId, seq, range, language: "ru", origin: "manual", cues };
    }
  }
  return {
    video: {
      ...base,
      title: video.title ?? DEMO_VIDEO_TITLE,
      durationSec: video.durationSec ?? 0,
      language: "ru",
    },
    chunks: chunks(),
  };
};

/** Заголовок для вставленного текста: первое предложение, длинное — по слову */
function firstSentence(text: string, max = 100): string {
  const line = text.split("\n")[0]!.trim();
  const sentence = line.match(/^.+?[.!?…](?=\s|$)/)?.[0] ?? line;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
