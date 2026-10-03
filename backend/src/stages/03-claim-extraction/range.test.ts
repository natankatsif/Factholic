import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockTranscriptionOutput } from "../02-transcription/mock.ts";
import type { TranscriptSegment } from "../02-transcription/types.ts";
import { findQuote, locateQuote, tokenize } from "./range.ts";

// 0_0 и 0_2 — без words (интерполяция), 0_1 — с пословными таймкодами
const [seg0, seg1, seg2] = mockTranscriptionOutput.segments;

describe("tokenize", () => {
  it("приводит к нижнему регистру, ё → е, режет по пунктуации", () => {
    assert.deepEqual(tokenize("В Украине сейчас идёт война, — ЁЛКА!"), [
      "в",
      "украине",
      "сейчас",
      "идет",
      "война",
      "елка",
    ]);
  });

  it("числа сохраняет, пустая строка → пустой массив", () => {
    assert.deepEqual(tokenize("8 млрд в 2022"), ["8", "млрд", "в", "2022"]);
    assert.deepEqual(tokenize(""), []);
    assert.deepEqual(tokenize(" — ... "), []);
  });
});

describe("locateQuote: сегмент с words", () => {
  it("полная цитата → границы первого и последнего слова", () => {
    assert.deepEqual(locateQuote("в Украине сейчас идёт война", [seg1]), { start: 1221.0, end: 1223.0 });
  });

  it("часть фразы → только её слова, а не весь сегмент", () => {
    assert.deepEqual(locateQuote("сейчас идёт война", [seg1]), { start: 1221.6, end: 1223.0 });
    assert.deepEqual(locateQuote("Украине сейчас", [seg1]), { start: 1221.1, end: 1222.0 });
  });

  it("другой падеж и ошибки окончаний (Украина/войны) всё равно находятся", () => {
    assert.deepEqual(locateQuote("в Украина сейчас идёт войны", [seg1]), { start: 1221.0, end: 1223.0 });
  });

  it("лишнее слово-паразит в распознавании (ошибка ASR) не ломает поиск", () => {
    const withFiller: TranscriptSegment = {
      id: "1_0",
      start: 10,
      end: 13,
      text: "В Украине э-э сейчас идёт война",
      words: [
        { text: "В", start: 10.0, end: 10.1 },
        { text: "Украине", start: 10.1, end: 10.6 },
        { text: "э-э", start: 10.6, end: 11.2 },
        { text: "сейчас", start: 11.2, end: 11.6 },
        { text: "идёт", start: 11.6, end: 12.0 },
        { text: "война", start: 12.0, end: 12.6 },
      ],
    };
    assert.deepEqual(locateQuote("в Украине сейчас идёт война", [withFiller]), { start: 10.0, end: 12.6 });
  });

  it("слово, пропущенное распознаванием, тоже допускается", () => {
    const missing: TranscriptSegment = {
      ...seg1,
      words: seg1.words!.filter((w) => w.text !== "сейчас"),
    };
    assert.deepEqual(locateQuote("в Украине сейчас идёт война", [missing]), { start: 1221.0, end: 1223.0 });
  });

  it("при нескольких вхождениях выбирает самое плотное совпадение", () => {
    // «идёт … война» в начале растянуто на 4 слова, «идёт война» в конце — подряд
    const repeated: TranscriptSegment = {
      id: "1_1",
      start: 0,
      end: 4,
      text: "идёт дождь, и война где-то, а тут идёт война",
      words: [
        { text: "идёт", start: 0.0, end: 0.4 },
        { text: "дождь,", start: 0.4, end: 0.9 },
        { text: "и", start: 0.9, end: 1.0 },
        { text: "война", start: 1.0, end: 1.5 },
        { text: "а", start: 2.0, end: 2.1 },
        { text: "тут", start: 2.1, end: 2.4 },
        { text: "идёт", start: 3.0, end: 3.4 },
        { text: "война", start: 3.4, end: 4.0 },
      ],
    };
    assert.deepEqual(locateQuote("идёт война", [repeated]), { start: 3.0, end: 4.0 });
  });

  it("слишком короткий отрезок растягивается до 0.5 с, чтобы карточка не мигнула", () => {
    const range = locateQuote("в", [seg1]);
    assert.equal(range.start, 1221.0);
    assert.equal(range.end, 1221.5);
  });
});

describe("locateQuote: сегмент без words", () => {
  it("интерполирует время пропорционально позиции слов в тексте", () => {
    // «и это, конечно, влияет на цены на всё.» — 38 символов на 6.4 с
    const range = locateQuote("влияет на цены", [seg2]);
    assert.deepEqual(range, { start: 1226.09, end: 1228.45 });
    assert.ok(range.start > seg2.start && range.end < seg2.end);
  });

  it("цитата с начала сегмента начинается с начала сегмента", () => {
    const range = locateQuote("Давайте немного о том", [seg0]);
    assert.equal(range.start, seg0.start);
    assert.ok(range.end < seg0.end);
  });
});

describe("locateQuote: запасные варианты", () => {
  it("перефраз (совпало меньше половины слов) → весь сегмент", () => {
    assert.deepEqual(locateQuote("инфляция ускорилась", [seg2]), { start: seg2.start, end: seg2.end });
  });

  it("пустая цитата или цитата из одной пунктуации → весь сегмент", () => {
    assert.deepEqual(locateQuote("", [seg1]), { start: seg1.start, end: seg1.end });
    assert.deepEqual(locateQuote(" — ", [seg1]), { start: seg1.start, end: seg1.end });
  });

  it("цитата через два сегмента: начало по words первого, конец интерполяцией во втором", () => {
    assert.deepEqual(locateQuote("Украине сейчас идёт война, и это, конечно, влияет", [seg1, seg2]), {
      start: 1221.1,
      end: 1227.11,
    });
  });

  it("перефраз через несколько сегментов → от начала первого до конца последнего", () => {
    assert.deepEqual(locateQuote("рост ВВП замедлился", [seg1, seg2]), { start: seg1.start, end: seg2.end });
  });
});

describe("findQuote", () => {
  it("возвращает тот же range, что locateQuote, и долю найденных слов цитаты", () => {
    const quote = "в Украине сейчас идёт война";
    assert.deepEqual(findQuote(quote, [seg1]), { range: locateQuote(quote, [seg1]), matched: 1 });
  });

  it("часть слов не нашлась → matched < 1, но range точный, пока нашлась хотя бы половина", () => {
    const { range, matched } = findQuote("в Украине вчера шла", [seg1]);
    assert.equal(matched, 0.5);
    assert.deepEqual(range, { start: 1221.0, end: 1221.6 });
  });

  it("перефраз → matched < 0.5 и весь отрезок", () => {
    const { range, matched } = findQuote("инфляция ускорилась", [seg2]);
    assert.equal(matched, 0);
    assert.deepEqual(range, { start: seg2.start, end: seg2.end });
  });

  it("пустая цитата → matched 0", () => {
    assert.equal(findQuote("", [seg1]).matched, 0);
  });

  it("цитата ищется по всем переданным сегментам", () => {
    const { range, matched } = findQuote("влияет на цены", [seg0, seg1, seg2]);
    assert.equal(matched, 1);
    assert.deepEqual(range, { start: 1226.09, end: 1228.45 });
  });
});
