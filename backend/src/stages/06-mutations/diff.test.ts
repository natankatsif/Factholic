import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClaimNumber, ClaimStructure, TimeMarker } from "../03-claim-extraction/types.ts";
import {
  compareNumbers,
  diffAttribution,
  diffCertainty,
  diffNumbers,
  diffPlaces,
  diffStructures,
  diffTime,
  type DiffSide,
} from "./diff.ts";
import { templateNote } from "./texts.ts";

// ---------- данные ----------

function structure(over: Partial<ClaimStructure> = {}): ClaimStructure {
  return {
    numbers: [],
    places: [],
    eventTime: null,
    timeMarkers: [],
    certainty: "asserted",
    attributedTo: null,
    ...over,
  };
}

function num(value: number, unit: string, raw = `${value} ${unit}`): ClaimNumber {
  return { value, unit, approximate: false, raw };
}

function side(over: Partial<ClaimStructure> = {}, meta: Omit<DiffSide, "structure"> = {}): DiffSide {
  return { structure: structure(over), ...meta };
}

const date = (d: string, raw = "") => ({ eventTime: { raw, date: d } });
const markers = (...m: TimeMarker[]) => ({ timeMarkers: m });
const at = (publishedAt: string) => ({ publishedAt });

const time = (p: DiffSide, c: DiffSide, lang = "ru") => diffTime(p, c, lang);
const changedTime = (before: string, after: string) => [
  { field: "time", before, after, direction: "changed" },
];

// ---------- числа ----------

describe("compareNumbers: порог 10% от числа родителя", () => {
  it("ровно 10% — то же самое, больше — inflated / deflated", () => {
    assert.equal(compareNumbers(100, 100), "same");
    assert.equal(compareNumbers(100, 110), "same");
    assert.equal(compareNumbers(100, 111), "inflated");
    assert.equal(compareNumbers(100, 90), "same");
    assert.equal(compareNumbers(100, 89), "deflated");
    // плавающая точка: 0.33 / 0.3 − 1 = 0.10000000000000009
    assert.equal(compareNumbers(0.3, 0.33), "same");
    assert.equal(compareNumbers(5000, 50000), "inflated");
  });

  it("ноль: появилось значение — inflated, стало нулём — deflated", () => {
    assert.equal(compareNumbers(0, 5), "inflated");
    assert.equal(compareNumbers(5, 0), "deflated");
    assert.equal(compareNumbers(0, 0), "same");
  });

  it("смена знака — changed; отрицательные сравниваются по модулю", () => {
    assert.equal(compareNumbers(2, -2), "changed");
    assert.equal(compareNumbers(-10, -20), "inflated");
    assert.equal(compareNumbers(-10, -5), "deflated");
  });
});

describe("diffNumbers", () => {
  it("те же числа (в пределах 10%) → кандидатов нет", () => {
    assert.deepEqual(diffNumbers([num(600000, "человек")], [num(620000, "человек")], "ru"), []);
    assert.deepEqual(diffNumbers([], [], "ru"), []);
  });

  it("выросло → inflated, уменьшилось → deflated; before / after — как сказано (raw)", () => {
    assert.deepEqual(
      diffNumbers([num(10, "см", "до 10 сантиметров")], [num(30, "см", "30 сантиметров")], "ru"),
      [{ field: "numbers", before: "до 10 сантиметров", after: "30 сантиметров", direction: "inflated" }],
    );
    assert.deepEqual(
      diffNumbers([num(50000, "человек", "50 тысяч")], [num(5000, "человек", "5 тысяч")], "ru"),
      [{ field: "numbers", before: "50 тысяч", after: "5 тысяч", direction: "deflated" }],
    );
  });

  it("единицы сравниваются отдельно: другое число в другой единице — пропало + появилось (changed)", () => {
    assert.deepEqual(diffNumbers([num(10, "см")], [num(10, "человек")], "ru"), [
      { field: "numbers", before: "10 см", after: "—", direction: "changed" },
      { field: "numbers", before: "—", after: "10 человек", direction: "changed" },
    ]);
  });

  it("единица — без регистра, пробелов, ё/е и точки на конце", () => {
    assert.deepEqual(diffNumbers([num(10, "См")], [num(10, " см ")], "ru"), []);
    assert.deepEqual(diffNumbers([num(5, "тыс.")], [num(5, "тыс")], "ru"), []);
    assert.deepEqual(diffNumbers([num(5, "Тонн")], [num(5, "тонн")], "ru"), []);
    assert.deepEqual(diffNumbers([num(3, "лёт")], [num(3, "лет")], "ru"), []);
  });

  it("число появилось / пропало → changed, на месте отсутствующего — «—»", () => {
    assert.deepEqual(diffNumbers([], [num(30, "см", "30 сантиметров")], "ru"), [
      { field: "numbers", before: "—", after: "30 сантиметров", direction: "changed" },
    ]);
    assert.deepEqual(diffNumbers([num(30, "см", "30 сантиметров")], [], "en"), [
      { field: "numbers", before: "30 сантиметров", after: "—", direction: "changed" },
    ]);
  });

  it("несколько чисел одной единицы: сначала совпадающие, остальные — по величине", () => {
    // 5 совпало с 5, остались 100 → 500
    assert.deepEqual(
      diffNumbers([num(100, "человек"), num(5, "человек")], [num(5, "человек"), num(500, "человек")], "ru"),
      [{ field: "numbers", before: "100 человек", after: "500 человек", direction: "inflated" }],
    );
    // совпадений нет: меньшее с меньшим, большее с большим
    assert.deepEqual(diffNumbers([num(100, "%"), num(10, "%")], [num(300, "%"), num(20, "%")], "ru"), [
      { field: "numbers", before: "10 %", after: "20 %", direction: "inflated" },
      { field: "numbers", before: "100 %", after: "300 %", direction: "inflated" },
    ]);
  });

  it("raw пустой → значение и единица", () => {
    assert.deepEqual(diffNumbers([num(10, "см", " ")], [num(20, "", "")], "ru"), [
      { field: "numbers", before: "10 см", after: "—", direction: "changed" },
      { field: "numbers", before: "—", after: "20", direction: "changed" },
    ]);
  });
});

// ---------- места ----------

describe("diffPlaces: множества без регистра", () => {
  it("те же места в другом порядке, регистре, с ё/е и повторами → кандидатов нет", () => {
    assert.deepEqual(diffPlaces(["Кишинёв", "Молдова"], ["молдова", "КИШИНЕВ", "Молдова"], "ru"), []);
    assert.deepEqual(diffPlaces([], [" "], "ru"), []);
  });

  it("другие места → один кандидат со списками целиком", () => {
    assert.deepEqual(diffPlaces(["Кишинёв", "Молдова"], ["Бельцы", "Молдова"], "ru"), [
      { field: "place", before: "Кишинёв, Молдова", after: "Бельцы, Молдова", direction: "changed" },
    ]);
  });

  it("«Кишинёв» и «столица Молдовы» для кода — разные места (решает LLM)", () => {
    assert.equal(diffPlaces(["Кишинёв"], ["столица Молдовы"], "ru").length, 1);
  });

  it("место появилось / пропало → «—»", () => {
    assert.deepEqual(diffPlaces([], ["Кишинёв"], "ru"), [
      { field: "place", before: "—", after: "Кишинёв", direction: "changed" },
    ]);
    assert.deepEqual(diffPlaces(["Кишинёв"], [], "ru"), [
      { field: "place", before: "Кишинёв", after: "—", direction: "changed" },
    ]);
  });
});

// ---------- время ----------

describe("diffTime: явные даты", () => {
  it("та же дата или та же с разной точностью → кандидатов нет", () => {
    assert.deepEqual(time(side(date("2022-02-24")), side(date("2022-02-24"))), []);
    assert.deepEqual(time(side(date("2022")), side(date("2022-02-24"))), []);
    assert.deepEqual(time(side(date("2022-02-24T10:00:00Z")), side(date("2022-02"))), []);
  });

  it("другая дата → changed, before / after — как сказано (raw), без raw — дата", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021 года")), side(date("2024-12-20", "20 декабря"))),
      changedTime("14 января 2021 года", "20 декабря"),
    );
    assert.deepEqual(time(side(date("2021")), side(date("2023"))), changedTime("2021", "2023"));
  });

  it("соседние дни — в пределах допуска (1 сутки), через день — уже изменение", () => {
    assert.deepEqual(time(side(date("2022-02-24")), side(date("2022-02-25"))), []);
    assert.equal(time(side(date("2022-02-24")), side(date("2022-02-26"))).length, 1);
  });

  it("дата не разбирается → как будто её нет", () => {
    assert.deepEqual(time(side(date("2022-13", "в 13-м месяце")), side(date("2023-01-01"))), []);
  });
});

describe("diffTime: маркеры — от даты публикации узла", () => {
  it("«сегодня» у родителя и «вчера» у перепечатки на следующий день → то же событие", () => {
    assert.deepEqual(
      time(
        side(markers("today"), at("2026-10-02T08:00:00Z")),
        side(markers("yesterday"), at("2026-10-03T07:00:00Z")),
      ),
      [],
    );
  });

  it("старое событие стало вчерашним → changed с датами", () => {
    assert.deepEqual(
      time(
        side(markers("today"), at("2021-01-14T07:30:00Z")),
        side(markers("yesterday"), at("2026-10-02T09:00:00Z")),
      ),
      changedTime("сегодня (14 января 2021)", "вчера (1 октября 2026)"),
    );
  });

  it("допуск 1 сутки: «сегодня» 2 и 3 октября — одно событие, 2 и 4 — нет", () => {
    const parent = side(markers("today"), at("2026-10-02T12:00:00Z"));
    assert.deepEqual(time(parent, side(markers("today"), at("2026-10-03T12:00:00Z"))), []);
    assert.equal(time(parent, side(markers("today"), at("2026-10-04T00:00:00Z"))).length, 1);
  });

  it("«на этой неделе» — последние 7 дней, без даты в подписи", () => {
    const parent = side(markers("today"), at("2026-10-02T12:00:00Z"));
    assert.deepEqual(time(parent, side(markers("this_week"), at("2026-10-08T12:00:00Z"))), []);
    assert.deepEqual(
      time(parent, side(markers("recently", "this_week"), at("2026-10-12T12:00:00Z"))),
      changedTime("сегодня (2 октября 2026)", "на этой неделе"),
    );
  });

  it("несколько маркеров → самый «свежий»", () => {
    assert.deepEqual(
      time(
        side(markers("today"), at("2026-10-02T12:00:00Z")),
        side(markers("recently", "yesterday"), at("2026-10-03T12:00:00Z")),
      ),
      [],
    );
  });

  it("явная дата у родителя, «вчера» у потомка: сверяются сутки", () => {
    const parent = side(date("2021-01-14", "14 января"));
    assert.deepEqual(time(parent, side(markers("yesterday"), at("2021-01-15T10:00:00Z"))), []);
    assert.deepEqual(
      time(parent, side(markers("yesterday"), at("2026-10-02T09:00:00Z"))),
      changedTime("14 января", "вчера (1 октября 2026)"),
    );
  });

  it("подписи — на языке UI", () => {
    assert.deepEqual(
      time(
        side(markers("today"), at("2021-01-14T07:30:00Z")),
        side(markers("yesterday"), at("2026-10-02T09:00:00Z")),
        "en",
      ),
      changedTime("today (14 January 2021)", "yesterday (1 October 2026)"),
    );
    assert.deepEqual(
      time(
        side(markers("today"), at("2021-01-14T07:30:00Z")),
        side(markers("yesterday"), at("2026-10-02T09:00:00Z")),
        "uk",
      ),
      changedTime("сьогодні (14 січня 2021)", "учора (1 жовтня 2026)"),
    );
  });
});

describe("diffTime: родитель о времени молчит — сверяется дата его публикации", () => {
  it("родитель вышел раньше, чем, по словам потомка, случилось событие → changed «не позднее …»", () => {
    assert.deepEqual(
      time(side({}, at("2024-12-20T06:00:00Z")), side(markers("yesterday"), at("2026-10-02T09:00:00Z"))),
      changedTime("не позднее 20 декабря 2024", "вчера (1 октября 2026)"),
    );
    assert.deepEqual(
      time(side({}, at("2021-06-01T00:00:00Z")), side(date("2024", "в 2024 году"))),
      changedTime("не позднее 1 июня 2021", "в 2024 году"),
    );
  });

  it("родитель вышел в пределах суток до события потомка или позже → кандидатов нет", () => {
    const child = side(markers("yesterday"), at("2026-10-02T09:00:00Z")); // событие 1 октября
    assert.deepEqual(time(side({}, at("2026-09-30T23:00:00Z")), child), []);
    assert.deepEqual(time(side({}, at("2026-10-02T08:00:00Z")), child), []);
    assert.equal(time(side({}, at("2026-09-29T23:00:00Z")), child).length, 1);
  });
});

describe("diffTime: дат публикации не хватает", () => {
  it("у родителя явная дата, у потомка только «вчера» → changed (старое событие стало вчерашним)", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021 года")), side(markers("yesterday"))),
      changedTime("14 января 2021 года", "вчера"),
    );
  });

  it("маркеры без дат, пропавшее или появившееся без дат время → кандидатов нет", () => {
    assert.deepEqual(time(side(markers("today")), side(markers("yesterday"))), []);
    assert.deepEqual(time(side(markers("today")), side()), []);
    assert.deepEqual(time(side(), side(markers("yesterday"))), []);
    assert.deepEqual(time(side(date("2021-01-14")), side()), []);
    assert.deepEqual(time(side(), side()), []);
  });
});

// ---------- уверенность и атрибуция ----------

describe("diffCertainty", () => {
  it("hedged → asserted — inflated, обратно — deflated, без изменений — пусто", () => {
    assert.deepEqual(diffCertainty("hedged", "asserted", "ru"), [
      { field: "certainty", before: "предположительно", after: "как факт", direction: "inflated" },
    ]);
    assert.deepEqual(diffCertainty("asserted", "hedged", "en"), [
      { field: "certainty", before: "as fact", after: "possibly", direction: "deflated" },
    ]);
    assert.deepEqual(diffCertainty("hedged", "hedged", "ru"), []);
  });
});

describe("diffAttribution", () => {
  const attr = (attributedTo: string | null, meta: Omit<DiffSide, "structure"> = {}) =>
    side({ attributedTo }, meta);

  it("то же самое без регистра и знаков → пусто", () => {
    assert.deepEqual(diffAttribution(attr(null), attr(null), "ru"), []);
    assert.deepEqual(diffAttribution(attr("ВОЗ"), attr(" воз "), "ru"), []);
    assert.deepEqual(diffAttribution(attr("Reuters"), attr("REUTERS."), "ru"), []);
    assert.deepEqual(diffAttribution(attr(" "), attr(null), "ru"), []);
  });

  it("ссылку добавили, убрали или заменили → changed", () => {
    assert.deepEqual(diffAttribution(attr(null), attr("ВОЗ"), "ru"), [
      { field: "attribution", before: "без ссылки на источник", after: "ВОЗ", direction: "changed" },
    ]);
    assert.deepEqual(diffAttribution(attr("ВОЗ"), attr(null), "en"), [
      { field: "attribution", before: "ВОЗ", after: "no attribution", direction: "changed" },
    ]);
    assert.deepEqual(diffAttribution(attr("ВОЗ"), attr("Минздрав"), "ru"), [
      { field: "attribution", before: "ВОЗ", after: "Минздрав", direction: "changed" },
    ]);
  });

  it("потомок ссылается на самого родителя (издатель, аббревиатура, домен) → пусто", () => {
    const dw = { publisher: "Deutsche Welle", domain: "dw.com" };
    assert.deepEqual(diffAttribution(attr("Reuters", dw), attr("DW"), "ru"), []);
    assert.deepEqual(diffAttribution(attr(null, dw), attr("Deutsche Welle"), "ru"), []);
    assert.deepEqual(
      diffAttribution(
        attr(null, { publisher: "Reuters", domain: "www.reuters.com" }),
        attr("Reuters UK"),
        "ru",
      ),
      [],
    );
    assert.deepEqual(
      diffAttribution(
        attr(null, { publisher: "Управление ООН по правам человека", domain: "ohchr.org" }),
        attr("ООН"),
        "ru",
      ),
      [],
    );
    assert.deepEqual(
      diffAttribution(attr(null, { publisher: "Point.md", domain: "point.md" }), attr("Point"), "ru"),
      [],
    );
  });

  it("ссылка на кого-то кроме родителя → changed", () => {
    const dw = { publisher: "Deutsche Welle", domain: "dw.com" };
    assert.equal(diffAttribution(attr(null, dw), attr("Reuters"), "ru").length, 1);
    // короткое имя совпадает только целиком, а не как часть другого
    assert.equal(diffAttribution(attr(null, dw), attr("D"), "ru").length, 1);
  });
});

// ---------- всё вместе ----------

describe("diffStructures", () => {
  it("одинаковые структуры → кандидатов нет", () => {
    const s = { numbers: [num(10, "см")], places: ["Кишинёв"], ...markers("today") };
    assert.deepEqual(
      diffStructures(side(s, at("2026-10-02T08:00:00Z")), side(s, at("2026-10-02T18:00:00Z")), "ru"),
      [],
    );
  });

  it("всё изменилось → по порядку полей: числа, место, время, уверенность, атрибуция", () => {
    const parent = side(
      { numbers: [num(10, "см")], places: ["Кишинёв"], ...date("2021-01-14"), certainty: "hedged" },
      at("2021-01-14T07:30:00Z"),
    );
    const child = side(
      { numbers: [num(50, "см")], places: ["Бельцы"], ...markers("yesterday"), attributedTo: "ВОЗ" },
      at("2026-10-02T09:00:00Z"),
    );
    assert.deepEqual(
      diffStructures(parent, child, "ru").map((c) => [c.field, c.direction]),
      [
        ["numbers", "inflated"],
        ["place", "changed"],
        ["time", "changed"],
        ["certainty", "inflated"],
        ["attribution", "changed"],
      ],
    );
  });
});

describe("templateNote", () => {
  const m = { field: "numbers", direction: "inflated", before: "10 см", after: "50 см" } as const;

  it("по полю и направлению, на языке UI; неизвестный язык → английский", () => {
    assert.equal(templateNote(m, "ru"), "Число выросло: «10 см» → «50 см».");
    assert.equal(templateNote(m, "uk"), "Число зросло: «10 см» → «50 см».");
    assert.equal(templateNote(m, "ro"), "The number grew: «10 см» → «50 см».");
    assert.equal(
      templateNote({ field: "time", direction: "changed", before: "2021", after: "вчера" }, "ru"),
      "Изменилось время события: «2021» → «вчера».",
    );
  });
});
