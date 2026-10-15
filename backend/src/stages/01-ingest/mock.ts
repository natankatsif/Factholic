import type { ISODateString } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import type { CaptionsChunk, IngestInput, IngestOutput, MediaChunk } from "./types.ts";

export const mockIngestInput: Omit<IngestInput, "liveAudio"> = {
  jobId: "job_mock_01",
  request: {
    video: {
      pageUrl: "https://www.youtube.com/watch?v=13R5R5nTcsk",
      platform: "youtube",
      platformVideoId: "13R5R5nTcsk",
      title: "Новая система в аэропорту Кишинёва: электронные ворота для пассажиров без багажа",
      durationSec: 141,
    },
    mode: "remote",
    startFrom: 0,
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
  range: { start: 0, end: 30 },
  language: "ru",
  origin: "auto",
  cues: [
    { start: 0.5, end: 3.8, text: "Здравствуйте, в эфире новости Молдовы и обзор главных событий дня." },
    {
      start: 4.2,
      end: 11.6,
      text: "В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано.",
    },
    {
      start: 12.0,
      end: 17.0,
      text: "Вода залила проезжую часть, коммунальные службы работают в экстренном режиме.",
    },
  ],
};

// ===================== ДЕМО =====================

const DEMO_VIDEO_TITLE = "Новая система в аэропорту Кишинёва: электронные ворота для пассажиров без багажа";

/**
 * Дата публикации любого материала в демо: от неё этап 07 считает «сейчас» и «вчера», под неё подобраны даты
 * в моках 04–05.
 */
export const MOCK_PUBLISHED_AT: ISODateString = "2024-09-14T18:00:00Z";

/**
 * Демо-видео: время — от начала фрагмента, ingestMock сдвигает его на startFrom.
 * Мок этапа 03 находит здесь тезисы:
 * 1. «Албишоара затопило» (подтверждается примэрией и TV8, раздуто в пересказах)
 * 2. «в аэропорту электронные ворота» (подтверждается)
 * 3. «газ вырос на 30%» (опровергается: рост до 13%)
 * 4. «вода кипит при 100 °C везде» (опровергается).
 */
export const mockDemoCues: CaptionsChunk["cues"] = [
  { start: 0.5, end: 3.8, text: "Здравствуйте, в эфире новости Молдовы и обзор главных событий дня." },
  {
    start: 4.2,
    end: 11.6,
    text: "В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано.",
  },
  {
    start: 12.0,
    end: 17.0,
    text: "Вода залила проезжую часть, коммунальные службы работают в экстренном режиме.",
  },
  {
    start: 17.6,
    end: 24.5,
    text: "А в аэропорту Кишинёва пассажиры без багажа теперь могут пройти контроль через электронные ворота.",
  },
  { start: 25.0, end: 30.5, text: "С 1 октября цены на газ в Молдове выросли на 30%." },
  { start: 31.0, end: 37.6, text: "Кстати, вода кипит при ста градусах везде — хоть на море, хоть в горах." },
  { start: 38.2, end: 42.5, text: "Это школьная физика, тут спорить не о чем." },
  { start: 43.4, end: 49.0, text: "Ну а теперь — к подробностям каждого из этих событий." },
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
