import type { Stage } from "../../pipeline/context.ts";
import { mockTranscriptionOutput } from "../02-transcription/mock.ts";
import type { TranscriptSegment } from "../02-transcription/types.ts";
import { findQuote } from "./range.ts";
import type { Claim, ClaimExtractionInput, ClaimExtractionOutput } from "./types.ts";

export const mockClaimExtractionInput: ClaimExtractionInput = {
  jobId: "job_mock_01",
  video: {
    pageUrl: "https://www.youtube.com/watch?v=MOCK123",
    platform: "youtube",
    title: "Большое интервью: экономика, наука и мировые события",
    durationSec: 1860,
    language: "ru",
  },
  segments: mockTranscriptionOutput.segments,
  context: [],
  previousClaims: [{ id: "clm_04", normalized: "В следующем году инфляция снизится вдвое." }],
  language: "ru",
};

export const mockClaim: Claim = {
  id: "clm_05",
  jobId: "job_mock_01",
  range: { start: 1221.0, end: 1223.0 },
  quote: "в Украине сейчас идёт война",
  normalized: "На территории Украины идёт война.",
  category: "event",
  checkworthiness: 0.82,
  language: "ru",
  entities: ["Украина"],
  segmentIds: ["0_1"],
  speaker: "SPEAKER_1",
  structure: {
    event: "война в Украине",
    numbers: [],
    places: ["Украина"],
    time: { text: "сейчас", date: null, relative: true },
    certainty: "asserted",
    certaintyMarkers: [],
    attributedTo: null,
  },
};

export const mockClaimExtractionOutput: ClaimExtractionOutput = {
  // "и это влияет на цены на всё" — слишком размыто, не извлечено
  claims: [mockClaim],
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

/** Что у тезиса не зависит от того, где он прозвучал (range, quote, segmentIds берутся из текста) */
export type MockClaimTemplate = Pick<
  Claim,
  "id" | "normalized" | "category" | "checkworthiness" | "entities" | "structure"
>;

/**
 * Тезисы демо: примеры «Попробуй готовый текст» (web/src/components/home/examples.ts) и демо-интервью
 * из мока этапа 01. Моки 04–08 отдают по их id свои источники, дерево, мутации и стороны.
 */
export const mockDemoClaims = {
  /** Верно: сходятся ООН, Reuters, DW */
  warNow: mockClaim,
  /** Неверно: источники называют 24 февраля 2022 года, флаг «Искажение» */
  war2023: {
    id: "clm_war2023_01",
    normalized: "Война в Украине началась в 2023 году.",
    category: "historical",
    checkworthiness: 0.9,
    entities: ["Украина"],
    structure: {
      event: "начало войны в Украине",
      numbers: [],
      places: ["Украина"],
      time: { text: "в 2023 году", date: "2023", relative: false },
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Верно: подтверждает первоисточник — ООН */
  population: {
    id: "clm_people_01",
    normalized: "Население Земли превысило 8 млрд человек в ноябре 2022 года.",
    category: "statistic",
    checkworthiness: 0.85,
    entities: ["ООН"],
    structure: {
      event: "население Земли превысило 8 млрд человек",
      numbers: [{ value: "8 млрд", about: "население Земли" }],
      places: ["Земля"],
      time: { text: "в ноябре 2022 года", date: "2022-11", relative: false },
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Фейк: снегопад января 2021 года (10 см) подан как вчерашний и раздут до полметра */
  snow: {
    id: "clm_snow_01",
    normalized: "Накануне выхода видео в Кишинёве за одну ночь выпало полметра снега.",
    category: "event",
    checkworthiness: 0.92,
    entities: ["Кишинёв"],
    structure: {
      event: "снегопад в Кишинёве",
      numbers: [{ value: "полметра", about: "снега за ночь" }],
      places: ["Кишинёв"],
      time: { text: "вчера", date: null, relative: true },
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Неверно: на высоте вода кипит при более низкой температуре */
  water: {
    id: "clm_water_01",
    normalized: "Вода кипит при 100 °C на любой высоте над уровнем моря.",
    category: "scientific",
    checkworthiness: 0.8,
    entities: [],
    structure: {
      event: "температура кипения воды",
      numbers: [{ value: "100 °C", about: "температура кипения воды" }],
      places: ["на уровне моря", "в горах"],
      time: null,
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Сходится: мэрия и телеканал независимо; по дороге одна перепечатка потеряла ссылку на мэрию */
  flood: {
    id: "clm_flood_01",
    normalized: "В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение по ней парализовано.",
    category: "event",
    checkworthiness: 0.8,
    entities: ["Кишинёв", "улица Албишоара"],
    structure: {
      event: "подтопление улицы Албишоара после ливня",
      numbers: [],
      places: ["Кишинёв", "улица Албишоара"],
      time: null,
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Раздуто: министерство объявило рост тарифа на 13%, Telegram-канал написал 30% */
  gas: {
    id: "clm_gas_01",
    normalized: "С 1 октября 2026 года цены на газ в Молдове выросли на 30%.",
    category: "statistic",
    checkworthiness: 0.9,
    entities: ["Молдова"],
    structure: {
      event: "рост цен на газ",
      numbers: [{ value: "30%", about: "рост цен на газ" }],
      places: ["Молдова"],
      time: { text: "с 1 октября", date: "2026-10-01", relative: false },
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
  /** Недостаточно информации: один портал пересказывает посты родителей, мэрия молчит */
  schools: {
    id: "clm_schools_01",
    normalized: "Мэрия Кишинёва закрыла пять школ на ремонт.",
    category: "event",
    checkworthiness: 0.8,
    entities: ["Мэрия Кишинёва"],
    structure: {
      event: "закрытие школ на ремонт",
      numbers: [{ value: "5", about: "школ" }],
      places: ["Кишинёв"],
      time: null,
      certainty: "asserted",
      certaintyMarkers: [],
      attributedTo: null,
    },
  },
} satisfies Record<string, MockClaimTemplate>;

/**
 * Как узнать демо-тезис в предложении: совпавший кусок — quote (дословно из текста).
 * Порядок важен: «война началась в 2023 году» проверяется раньше «идёт война».
 */
export const MOCK_CLAIM_SCENARIOS: Array<{ pattern: RegExp; claim: MockClaimTemplate }> = [
  { pattern: /войн\p{L}* в Украине началась в 2023(?: году)?/iu, claim: mockDemoClaims.war2023 },
  {
    pattern: /в Украине (?:сейчас )?ид[её]т война|война в Украине (?:сейчас )?(?:ид[её]т|продолжается)/iu,
    claim: mockDemoClaims.warNow,
  },
  {
    pattern:
      /населени\p{L}* (?:Земли|планеты|мира)[^.!?]*?(?:8|восемь|восьми) (?:млрд|миллиард\p{L}*)(?: человек)?/iu,
    claim: mockDemoClaims.population,
  },
  { pattern: /вчера Кишин[её]в завалило снегом[^.!?]*/iu, claim: mockDemoClaims.snow },
  { pattern: /вода кипит при (?:ста|100) градус\p{L}*[^.!?]*/iu, claim: mockDemoClaims.water },
  { pattern: /[^.!?]*Албишоар[^.!?]*/iu, claim: mockDemoClaims.flood },
  { pattern: /[^.!?]*цен\p{L}* на газ[^.!?]*/iu, claim: mockDemoClaims.gas },
  { pattern: /[^.!?]*закрыл\p{L}* (?:пять|5) школ[^.!?]*/iu, claim: mockDemoClaims.schools },
];

/** Незнакомый текст: сколько первых предложений взять тезисами (источников у них в моке нет) */
const MAX_UNKNOWN_CLAIMS = 3;
const MIN_UNKNOWN_WORDS = 4;

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_CLAIM_EXTRACTION=mock) =====================

/**
 * Узнаёт в сегментах демо-тезисы (MOCK_CLAIM_SCENARIOS). Ни одного и раньше ничего не нашли — первые предложения
 * текста становятся тезисами без источников: так видно, что пайплайн работает и на своём тексте.
 */
export const extractClaimsMock: Stage<ClaimExtractionInput, ClaimExtractionOutput> = async (input) => {
  const known = new Set(input.previousClaims.map((c) => c.id));
  const claims: Claim[] = [];
  for (const segment of input.segments) {
    for (const { pattern, claim } of MOCK_CLAIM_SCENARIOS) {
      if (known.has(claim.id)) continue;
      const quote = segment.text.match(pattern)?.[0].trim();
      if (!quote) continue;
      known.add(claim.id);
      claims.push(toClaim(claim, quote, segment, input));
    }
  }

  if (!claims.length && !input.previousClaims.length) {
    const sentences = input.segments
      .filter((s) => s.text.split(/\s+/).length >= MIN_UNKNOWN_WORDS)
      .slice(0, MAX_UNKNOWN_CLAIMS);
    for (const s of sentences) {
      const quote = s.text.replace(/[.!?…]+$/, "");
      const template: MockClaimTemplate = {
        id: `clm_text_${s.id}`,
        normalized: s.text,
        category: "other",
        checkworthiness: 0.8,
        entities: [],
        structure: {
          event: quote,
          numbers: [],
          places: [],
          time: null,
          certainty: "asserted",
          certaintyMarkers: [],
          attributedTo: null,
        },
      };
      claims.push(toClaim(template, quote, s, input));
    }
  }
  return { claims };
};

function toClaim(
  template: MockClaimTemplate,
  quote: string,
  segment: TranscriptSegment,
  input: ClaimExtractionInput,
): Claim {
  return {
    id: template.id,
    jobId: input.jobId,
    // у текста таймкодов нет (0–0) — как в real, range берём как есть
    range: segment.words?.length
      ? findQuote(quote, [segment]).range
      : { start: segment.start, end: segment.end },
    quote,
    normalized: template.normalized,
    category: template.category,
    checkworthiness: template.checkworthiness,
    language: input.language,
    entities: template.entities,
    segmentIds: [segment.id],
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    structure: template.structure,
  };
}
