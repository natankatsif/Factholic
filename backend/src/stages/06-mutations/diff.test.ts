import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import {
  compareNumbers,
  diffAttribution,
  diffCertainty,
  diffNumbers,
  diffPlaces,
  diffStructures,
  diffTime,
  parseNumber,
  type DiffSide,
  type StructureNumber,
} from "./diff.ts";
import { templateNote } from "./texts.ts";

// ---------- данные ----------

function structure(over: Partial<ClaimStructure> = {}): ClaimStructure {
  return {
    event: "снегопад",
    numbers: [],
    places: [],
    time: null,
    certainty: "asserted",
    certaintyMarkers: [],
    attributedTo: null,
    ...over,
  };
}

function num(value: string, about: string): StructureNumber {
  return { value, about };
}

function side(over: Partial<ClaimStructure> = {}, meta: Omit<DiffSide, "structure"> = {}): DiffSide {
  return { structure: structure(over), ...meta };
}

/** Явная дата: «14 января 2021 года» → 2021-01-14 */
const date = (d: string | null, text = "") => ({ time: { text, date: d, relative: false } });
/** Относительное время: «вчера»; date — если её посчитал этап 03 от даты публикации */
const rel = (text: string, d: string | null = null) => ({ time: { text, date: d, relative: true } });
const at = (publishedAt: string) => ({ publishedAt });

const time = (p: DiffSide, c: DiffSide, lang = "ru") => diffTime(p, c, lang);
const shiftedTime = (before: string, after: string) => [
  { field: "time", before, after, direction: "shifted" },
];

// ---------- числа ----------

describe("compareNumbers: порог 10% от числа родителя", () => {
  it("ровно 10% — то же самое; 10–50% — changed (расхождение); в 1,5 раза и больше — inflated / deflated", () => {
    assert.equal(compareNumbers(100, 100), "same");
    assert.equal(compareNumbers(100, 110), "same");
    assert.equal(compareNumbers(100, 111), "changed");
    assert.equal(compareNumbers(100, 149), "changed");
    assert.equal(compareNumbers(100, 150), "inflated");
    assert.equal(compareNumbers(100, 90), "same");
    assert.equal(compareNumbers(100, 89), "changed");
    assert.equal(compareNumbers(150, 100), "deflated");
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

describe("parseNumber: значение из строки", () => {
  const value = (s: string) => parseNumber(s)?.value ?? null;

  it("цифры с пробелами, запятыми и точками между разрядами; десятичная запятая и точка", () => {
    assert.equal(value("200"), 200);
    assert.equal(value("1 200"), 1200);
    assert.equal(value("1\u00a0200 000"), 1_200_000);
    assert.equal(value("1,200"), 1200);
    assert.equal(value("1.500.000"), 1_500_000);
    assert.equal(value("1,200.5"), 1200.5);
    assert.equal(value("3,5"), 3.5);
    assert.equal(value("2.5"), 2.5);
    assert.equal(value("до 10 сантиметров"), 10);
    assert.equal(value("-5"), -5);
    assert.equal(value("минус 5"), -5);
    assert.equal(value("COVID-19"), 19);
  });

  it("множители: тыс / млн / млрд, thousand / million / billion, mii / milioane / miliarde", () => {
    assert.equal(value("5 тыс."), 5000);
    assert.equal(value("50 тысяч"), 50_000);
    assert.equal(value("3,5 млн"), 3_500_000);
    assert.equal(value("2 миллиона"), 2_000_000);
    assert.equal(value("1,2 млрд"), 1_200_000_000);
    assert.equal(value("10 thousand"), 10_000);
    assert.equal(value("2.5 million"), 2_500_000);
    assert.equal(value("3 billion"), 3_000_000_000);
    assert.equal(value("10k"), 10_000);
    assert.equal(value("5 mii"), 5000);
    assert.equal(value("20 de mii"), 20_000);
    assert.equal(value("3 milioane"), 3_000_000);
    assert.equal(value("2 miliarde"), 2_000_000_000);
  });

  it("словами: «полмиллиона», «полтора миллиона», «две тысячи», «half a million», «o mie»", () => {
    assert.equal(value("полмиллиона"), 500_000);
    assert.equal(value("пол-миллиона"), 500_000);
    assert.equal(value("полтора миллиона"), 1_500_000);
    assert.equal(value("две тысячи"), 2000);
    assert.equal(value("около двухсот пятидесяти"), null);
    assert.equal(value("двести пятьдесят тысяч"), 250_000);
    assert.equal(value("тысяча"), 1000);
    assert.equal(value("half a million"), 500_000);
    assert.equal(value("a million"), 1_000_000);
    assert.equal(value("two hundred"), 200);
    assert.equal(value("jumătate de milion"), 500_000);
    assert.equal(value("o mie"), 1000);
    assert.equal(value("două sute"), 200);
  });

  it("единицы длины и массы переводятся в базовые: «полметра» = «50 см»", () => {
    assert.deepEqual(parseNumber("полметра"), { value: 0.5, dim: "length", base: 0.5 });
    assert.deepEqual(parseNumber("50 см"), { value: 50, dim: "length", base: 0.5 });
    assert.equal(parseNumber("2 km")?.base, 2000);
    assert.equal(parseNumber("5 тыс. тонн")?.base, 5_000_000);
  });

  it("неточное или не число → null", () => {
    for (const s of [
      "вдвое",
      "десятки тысяч",
      "тысячи",
      "hundreds of thousands",
      "sute de mii",
      "",
      "много",
    ]) {
      assert.equal(parseNumber(s), null, s);
    }
  });
});

describe("diffNumbers", () => {
  it("те же числа (в пределах 10%) → кандидатов нет", () => {
    assert.deepEqual(diffNumbers([num("600 тысяч", "человек")], [num("620 000", "человек")], "ru"), []);
    assert.deepEqual(diffNumbers([], [], "ru"), []);
  });

  it("годы в числах — не числа (время сравнивает diffTime)", () => {
    assert.deepEqual(
      diffNumbers([num("2014", "год начала конфликта")], [num("2022", "начало войны")], "ru"),
      [],
    );
    assert.deepEqual(diffNumbers([num("2014 год", "")], [num("2022 г.", "")], "ru"), []);
    assert.equal(diffNumbers([num("2000", "человек")], [num("5000", "человек")], "ru").length, 1);
  });

  it("выросло → inflated, уменьшилось → deflated; before / after — значение и что оно считает", () => {
    assert.deepEqual(diffNumbers([num("до 10 см", "высота снега")], [num("30 см", "высота снега")], "ru"), [
      {
        field: "numbers",
        before: "до 10 см высота снега",
        after: "30 см высота снега",
        direction: "inflated",
      },
    ]);
    assert.deepEqual(diffNumbers([num("50 тысяч", "участников")], [num("5 тысяч", "участников")], "ru"), [
      { field: "numbers", before: "50 тысяч участников", after: "5 тысяч участников", direction: "deflated" },
    ]);
    assert.deepEqual(diffNumbers([num("2", "пострадавших")], [num("200", "пострадавших")], "ru"), [
      { field: "numbers", before: "2 пострадавших", after: "200 пострадавших", direction: "inflated" },
    ]);
  });

  it("та же величина в другой записи или единицах → кандидатов нет", () => {
    assert.deepEqual(diffNumbers([num("полмиллиона", "жителей")], [num("500 тысяч", "жителей")], "ru"), []);
    assert.deepEqual(diffNumbers([num("полметра", "снега")], [num("50 см", "снега")], "ru"), []);
    assert.deepEqual(diffNumbers([num("3,5 млн", "леев")], [num("3.5 million", "леев")], "ru"), []);
    // единица только у одного — сравниваются сами числа
    assert.deepEqual(diffNumbers([num("10", "сантиметров снега")], [num("10 см", "снега")], "ru"), []);
  });

  it("about — без регистра, по основам слов, без служебных слов", () => {
    assert.deepEqual(diffNumbers([num("200", "Пострадавших")], [num("200", "пострадавшие")], "ru"), []);
    assert.deepEqual(diffNumbers([num("200", "пострадавших")], [num("200", "человек пострадали")], "ru"), []);
    assert.deepEqual(diffNumbers([num("3", "лёт")], [num("3", "лет")], "ru"), []);
    assert.deepEqual(diffNumbers([num("5", "injured")], [num("5", "injuries in the fire")], "ru"), []);
    assert.deepEqual(diffNumbers([num("5", "morți")], [num("5", "morților")], "ru"), []);
  });

  it("числа считают разное → пропало + появилось (removed / added)", () => {
    assert.deepEqual(diffNumbers([num("10", "погибших")], [num("10", "пострадавших")], "ru"), [
      { field: "numbers", before: "10 погибших", after: "—", direction: "removed" },
      { field: "numbers", before: "—", after: "10 пострадавших", direction: "added" },
    ]);
    // годы с цифрами — только целиком
    assert.equal(diffNumbers([num("5", "жертв 2022")], [num("5", "жертв 2023")], "ru").length, 2);
  });

  it("число появилось / пропало → added / removed, на месте отсутствующего — «—»", () => {
    assert.deepEqual(diffNumbers([], [num("30", "сантиметров снега")], "ru"), [
      { field: "numbers", before: "—", after: "30 сантиметров снега", direction: "added" },
    ]);
    assert.deepEqual(diffNumbers([num("30", "сантиметров снега")], [], "en"), [
      { field: "numbers", before: "30 сантиметров снега", after: "—", direction: "removed" },
    ]);
  });

  it("не разбирается → сравнение строк: то же написание — пусто, другое — changed", () => {
    assert.deepEqual(diffNumbers([num("Вдвое", "больше")], [num("вдвое", "больше")], "ru"), []);
    assert.deepEqual(diffNumbers([num("вдвое", "больше")], [num("втрое", "больше")], "ru"), [
      { field: "numbers", before: "вдвое больше", after: "втрое больше", direction: "changed" },
    ]);
    assert.deepEqual(diffNumbers([num("десятки", "домов")], [num("200", "домов")], "ru"), [
      { field: "numbers", before: "десятки домов", after: "200 домов", direction: "changed" },
    ]);
  });

  it("несколько чисел об одном: сначала совпадающие, остальные — по величине", () => {
    // 5 совпало с 5, остались 100 → 500
    assert.deepEqual(
      diffNumbers(
        [num("100", "человек"), num("5", "человек")],
        [num("5", "человек"), num("500", "человек")],
        "ru",
      ),
      [{ field: "numbers", before: "100 человек", after: "500 человек", direction: "inflated" }],
    );
    // совпадений нет: меньшее с меньшим, большее с большим
    assert.deepEqual(
      diffNumbers([num("100", "%"), num("10", "%")], [num("300", "%"), num("20", "%")], "ru"),
      [
        { field: "numbers", before: "10 %", after: "20 %", direction: "inflated" },
        { field: "numbers", before: "100 %", after: "300 %", direction: "inflated" },
      ],
    );
  });

  it("about пустой → только значение; пустой совпадает только с пустым; пустое значение пропускается", () => {
    assert.deepEqual(diffNumbers([num("10", "см"), num(" ", "домов")], [num("20", "")], "ru"), [
      { field: "numbers", before: "10 см", after: "—", direction: "removed" },
      { field: "numbers", before: "—", after: "20", direction: "added" },
    ]);
    assert.deepEqual(diffNumbers([num("10", "")], [num("30", " ")], "ru"), [
      { field: "numbers", before: "10", after: "30", direction: "inflated" },
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

  it("потомок оставил часть мест родителя → кандидатов нет", () => {
    assert.deepEqual(diffPlaces(["Украина", "Молдова"], ["Молдова"], "ru"), []);
  });

  it("к местам родителя добавилось место → added (подробность, не искажение)", () => {
    assert.deepEqual(diffPlaces(["Молдова"], ["Украина", "Молдова"], "ru"), [
      { field: "place", before: "Молдова", after: "Украина, Молдова", direction: "added" },
    ]);
  });

  it("место родителя заменено другим → changed", () => {
    assert.deepEqual(diffPlaces(["Молдова"], ["Украина"], "ru"), [
      { field: "place", before: "Молдова", after: "Украина", direction: "changed" },
    ]);
  });

  it("место появилось → added с «—»; пропало → не кандидат (просто не упомянуто)", () => {
    assert.deepEqual(diffPlaces([], ["Москва", "Советский Союз"], "ru"), [
      { field: "place", before: "—", after: "Москва, Советский Союз", direction: "added" },
    ]);
    assert.deepEqual(diffPlaces(["Кишинёв"], [], "ru"), []);
  });
});

// ---------- время ----------

describe("diffTime: явные даты", () => {
  it("та же дата или та же с разной точностью → кандидатов нет", () => {
    assert.deepEqual(time(side(date("2022-02-24")), side(date("2022-02-24"))), []);
    assert.deepEqual(time(side(date("2022")), side(date("2022-02-24"))), []);
    assert.deepEqual(time(side(date("2022-02-24T10:00:00Z")), side(date("2022-02"))), []);
  });

  it("другая дата → shifted, before / after — как сказано (text), без text — дата", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021 года")), side(date("2024-12-20", "20 декабря"))),
      shiftedTime("14 января 2021 года", "20 декабря"),
    );
    assert.deepEqual(time(side(date("2021")), side(date("2023"))), shiftedTime("2021", "2023"));
  });

  it("соседние дни — в пределах допуска (1 сутки), через день — уже изменение", () => {
    assert.deepEqual(time(side(date("2022-02-24")), side(date("2022-02-25"))), []);
    assert.equal(time(side(date("2022-02-24")), side(date("2022-02-26"))).length, 1);
  });

  it("дата не разбирается или её нет → как будто времени нет", () => {
    assert.deepEqual(time(side(date("2022-13", "в 13-м месяце")), side(date("2023-01-01"))), []);
    assert.deepEqual(time(side(date(null, "давно")), side(date("2023-01-01"))), []);
  });
});

describe("diffTime: относительное время с датой от этапа 03", () => {
  it("«сегодня» у родителя и «вчера» у перепечатки на следующий день → то же событие", () => {
    assert.deepEqual(time(side(rel("сегодня", "2026-10-02")), side(rel("вчера", "2026-10-02"))), []);
  });

  it("давнее событие подано как недавнее: relative у потомка при старой дате у родителя → shifted", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021 года")), side(rel("вчера", "2026-10-01"))),
      shiftedTime("14 января 2021 года", "вчера (1 октября 2026)"),
    );
  });

  it("явная дата и «вчера» в те же сутки → кандидатов нет", () => {
    assert.deepEqual(time(side(date("2026-10-01", "1 октября")), side(rel("вчера", "2026-10-01"))), []);
  });

  it("время словами, которых код не знает: допуск 7 дней («в четверг» → «третий день подряд» в субботу)", () => {
    assert.deepEqual(
      time(side(rel("в четверг", "2026-10-01")), side(rel("уже третий день подряд", "2026-10-03"))),
      [],
    );
    assert.deepEqual(time(side(date("2026-10-01")), side(rel("уже третий день подряд", "2026-10-03"))), []);
    assert.equal(time(side(date("2026-09-20")), side(rel("уже третий день подряд", "2026-10-03"))).length, 1);
  });

  it("относительное время с датой до месяца — без дня в подписи", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021")), side(rel("в прошлом месяце", "2026-09"))),
      shiftedTime("14 января 2021", "в прошлом месяце"),
    );
  });
});

describe("diffTime: относительное время без даты — по словам от даты публикации узла", () => {
  it("«сегодня» у родителя и «вчера» у перепечатки на следующий день → то же событие", () => {
    assert.deepEqual(
      time(side(rel("сегодня"), at("2026-10-02T08:00:00Z")), side(rel("вчера"), at("2026-10-03T07:00:00Z"))),
      [],
    );
  });

  it("старое событие стало вчерашним → shifted с датами", () => {
    assert.deepEqual(
      time(side(rel("сегодня"), at("2021-01-14T07:30:00Z")), side(rel("вчера"), at("2026-10-02T09:00:00Z"))),
      shiftedTime("сегодня (14 января 2021)", "вчера (1 октября 2026)"),
    );
  });

  it("допуск 1 сутки: «сегодня» 2 и 3 октября — одно событие, 2 и 4 — нет", () => {
    const parent = side(rel("сегодня"), at("2026-10-02T12:00:00Z"));
    assert.deepEqual(time(parent, side(rel("сегодня"), at("2026-10-03T12:00:00Z"))), []);
    assert.equal(time(parent, side(rel("сегодня"), at("2026-10-04T00:00:00Z"))).length, 1);
  });

  it("«на этой неделе» — последние 7 дней, без даты в подписи", () => {
    const parent = side(rel("сегодня"), at("2026-10-02T12:00:00Z"));
    assert.deepEqual(time(parent, side(rel("на этой неделе"), at("2026-10-08T12:00:00Z"))), []);
    assert.deepEqual(
      time(parent, side(rel("недавно, на этой неделе"), at("2026-10-12T12:00:00Z"))),
      shiftedTime("сегодня (2 октября 2026)", "недавно, на этой неделе"),
    );
  });

  it("несколько слов → самое «свежее»", () => {
    assert.deepEqual(
      time(
        side(rel("сегодня"), at("2026-10-02T12:00:00Z")),
        side(rel("недавно, а точнее вчера"), at("2026-10-03T12:00:00Z")),
      ),
      [],
    );
  });

  it("слова ro / en: «azi», «ieri», «acum», «yesterday», «now»; «acum 3 ani» и «позавчера» — не они", () => {
    const parent = side(rel("today"), at("2026-10-02T12:00:00Z"));
    for (const text of ["azi", "astăzi", "acum", "now", "сейчас", "только что"]) {
      assert.deepEqual(time(parent, side(rel(text), at("2026-10-02T20:00:00Z"))), [], text);
    }
    for (const text of ["ieri", "yesterday", "Вчера вечером"]) {
      assert.deepEqual(time(parent, side(rel(text), at("2026-10-03T08:00:00Z"))), [], text);
    }
    // не узнано — сутки не посчитать: сравнивать не с чем
    for (const text of ["acum 3 ani", "acum 30 de ani", "позавчера", "alaltăieri", "snow"]) {
      assert.deepEqual(time(parent, side(rel(text), at("2026-10-02T20:00:00Z"))), [], text);
    }
  });

  it("явная дата у родителя, «вчера» у потомка: сверяются сутки", () => {
    const parent = side(date("2021-01-14", "14 января"));
    assert.deepEqual(time(parent, side(rel("вчера"), at("2021-01-15T10:00:00Z"))), []);
    assert.deepEqual(
      time(parent, side(rel("вчера"), at("2026-10-02T09:00:00Z"))),
      shiftedTime("14 января", "вчера (1 октября 2026)"),
    );
  });

  it("подписи дат — на языке UI, само время — как сказано", () => {
    assert.deepEqual(
      time(
        side(rel("today"), at("2021-01-14T07:30:00Z")),
        side(rel("yesterday"), at("2026-10-02T09:00:00Z")),
        "en",
      ),
      shiftedTime("today (14 January 2021)", "yesterday (1 October 2026)"),
    );
    assert.deepEqual(
      time(side(rel("сьогодні", "2021-01-14")), side(rel("учора", "2026-10-01")), "uk"),
      shiftedTime("сьогодні (14 січня 2021)", "учора (1 жовтня 2026)"),
    );
  });
});

describe("diffTime: родитель о времени молчит — сверяется дата его публикации", () => {
  it("родитель вышел раньше, чем, по словам потомка, случилось событие → shifted «не позднее …»", () => {
    assert.deepEqual(
      time(side({}, at("2024-12-20T06:00:00Z")), side(rel("вчера"), at("2026-10-02T09:00:00Z"))),
      shiftedTime("не позднее 20 декабря 2024", "вчера (1 октября 2026)"),
    );
    assert.deepEqual(
      time(side({}, at("2021-06-01T00:00:00Z")), side(date("2024", "в 2024 году"))),
      shiftedTime("не позднее 1 июня 2021", "в 2024 году"),
    );
  });

  it("родитель вышел в пределах суток до события потомка или позже → кандидатов нет", () => {
    const child = side(rel("вчера"), at("2026-10-02T09:00:00Z")); // событие 1 октября
    assert.deepEqual(time(side({}, at("2026-09-30T23:00:00Z")), child), []);
    assert.deepEqual(time(side({}, at("2026-10-02T08:00:00Z")), child), []);
    assert.equal(time(side({}, at("2026-09-29T23:00:00Z")), child).length, 1);
  });
});

describe("diffTime: дат публикации не хватает", () => {
  it("у родителя явная дата, у потомка только «вчера» → shifted (старое событие стало вчерашним)", () => {
    assert.deepEqual(
      time(side(date("2021-01-14", "14 января 2021 года")), side(rel("вчера"))),
      shiftedTime("14 января 2021 года", "вчера"),
    );
  });

  it("у родителя дата за несколько дней до публикации потомка, у потомка время без даты → кандидатов нет", () => {
    assert.deepEqual(
      time(
        side(date("2026-10-01", "в четверг")),
        side(rel("третий день подряд"), at("2026-10-03T10:00:00Z")),
      ),
      [],
    );
    assert.equal(
      time(side(date("2021-01-14")), side(rel("третий день подряд"), at("2026-10-03T10:00:00Z"))).length,
      1,
    );
  });

  it("относительное без дат, пропавшее или появившееся без дат время → кандидатов нет", () => {
    assert.deepEqual(time(side(rel("сегодня")), side(rel("вчера"))), []);
    assert.deepEqual(time(side(rel("сегодня")), side()), []);
    assert.deepEqual(time(side(), side(rel("вчера"))), []);
    assert.deepEqual(time(side(date("2021-01-14")), side()), []);
    assert.deepEqual(time(side(), side()), []);
  });
});

// ---------- уверенность и атрибуция ----------

describe("diffCertainty: hedged < reported = asserted", () => {
  it("рост — inflated, падение — deflated, без изменений — пусто", () => {
    assert.deepEqual(diffCertainty("hedged", "asserted", "ru"), [
      { field: "certainty", before: "предположительно", after: "как факт", direction: "inflated" },
    ]);
    assert.deepEqual(diffCertainty("asserted", "hedged", "en"), [
      { field: "certainty", before: "as fact", after: "possibly", direction: "deflated" },
    ]);
    assert.deepEqual(diffCertainty("hedged", "hedged", "ru"), []);
  });

  it("«по данным мэрии» ↔ как факт — не кандидат; «возможно» → «по данным» — inflated; обратно — deflated", () => {
    assert.deepEqual(diffCertainty("reported", "asserted", "ru"), []);
    assert.deepEqual(diffCertainty("asserted", "reported", "ru"), []);
    assert.equal(diffCertainty("hedged", "reported", "ru")[0].direction, "inflated");
    assert.deepEqual(diffCertainty("reported", "hedged", "en"), [
      { field: "certainty", before: "citing a source", after: "possibly", direction: "deflated" },
    ]);
  });
});

describe("diffAttribution", () => {
  const attr = (attributedTo: string | null, meta: Omit<DiffSide, "structure"> = {}) =>
    side({ attributedTo }, meta);

  it("то же самое без регистра и знаков → пусто", () => {
    assert.deepEqual(diffAttribution(attr(null), attr(null)), []);
    assert.deepEqual(diffAttribution(attr("ВОЗ"), attr(" воз ")), []);
    assert.deepEqual(diffAttribution(attr("Reuters"), attr("REUTERS.")), []);
    assert.deepEqual(diffAttribution(attr(" "), attr(null)), []);
  });

  it("ссылку добавили или убрали → пусто (по фрагменту не понять), заменили → changed", () => {
    assert.deepEqual(diffAttribution(attr(null), attr("ВОЗ")), []);
    assert.deepEqual(diffAttribution(attr("мэр Виталий Кличко"), attr(null)), []);
    assert.deepEqual(diffAttribution(attr("ВОЗ"), attr("Минздрав")), [
      { field: "attribution", before: "ВОЗ", after: "Минздрав", direction: "changed" },
    ]);
  });

  it("то же имя короче или длиннее → пусто, другой человек или ведомство → changed", () => {
    assert.deepEqual(diffAttribution(attr("мэр Киева Виталий Кличко"), attr("Кличко")), []);
    assert.deepEqual(diffAttribution(attr("Кличко"), attr("мэр Виталий Кличко")), []);
    assert.equal(diffAttribution(attr("мэрия Кишинёва"), attr("мэрия Бельц")).length, 1);
    assert.equal(diffAttribution(attr("мэр Виталий Кличко"), attr("Петр Пантелеев")).length, 1);
  });

  it("потомок ссылается на самого родителя (издатель, аббревиатура, домен) → пусто", () => {
    const dw = { publisher: "Deutsche Welle", domain: "dw.com" };
    assert.deepEqual(diffAttribution(attr("Reuters", dw), attr("DW")), []);
    assert.deepEqual(diffAttribution(attr("ВОЗ", dw), attr("Deutsche Welle")), []);
    assert.deepEqual(
      diffAttribution(attr("ВОЗ", { publisher: "Reuters", domain: "www.reuters.com" }), attr("Reuters UK")),
      [],
    );
    assert.deepEqual(
      diffAttribution(
        attr("ВОЗ", { publisher: "Управление ООН по правам человека", domain: "ohchr.org" }),
        attr("ООН"),
      ),
      [],
    );
    assert.deepEqual(
      diffAttribution(attr("ВОЗ", { publisher: "Point.md", domain: "point.md" }), attr("Point")),
      [],
    );
  });

  it("ссылка на кого-то кроме родителя → changed", () => {
    const dw = { publisher: "Deutsche Welle", domain: "dw.com" };
    assert.equal(diffAttribution(attr("ВОЗ", dw), attr("Reuters")).length, 1);
    // короткое имя совпадает только целиком, а не как часть другого
    assert.equal(diffAttribution(attr("ВОЗ", dw), attr("D")).length, 1);
  });
});

// ---------- всё вместе ----------

describe("diffStructures", () => {
  it("одинаковые структуры → кандидатов нет (event кодом не сравнивается)", () => {
    const s = { numbers: [num("10 см", "снега")], places: ["Кишинёв"], ...rel("сегодня") };
    assert.deepEqual(
      diffStructures(
        side(s, at("2026-10-02T08:00:00Z")),
        side({ ...s, event: "сильный снегопад" }, at("2026-10-02T18:00:00Z")),
        "ru",
      ),
      [],
    );
  });

  it("всё изменилось → по порядку полей: числа, место, время, уверенность, атрибуция", () => {
    const parent = side(
      {
        numbers: [num("10 см", "снега")],
        places: ["Кишинёв"],
        ...date("2021-01-14"),
        certainty: "hedged",
        certaintyMarkers: ["возможно"],
        attributedTo: "мэрия Кишинёва",
      },
      at("2021-01-14T07:30:00Z"),
    );
    const child = side(
      { numbers: [num("50 см", "снега")], places: ["Бельцы"], ...rel("вчера"), attributedTo: "ВОЗ" },
      at("2026-10-02T09:00:00Z"),
    );
    assert.deepEqual(
      diffStructures(parent, child, "ru").map((c) => [c.field, c.direction]),
      [
        ["numbers", "inflated"],
        ["place", "changed"],
        ["time", "shifted"],
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

  it("новые направления: added / removed у чисел, shifted у времени", () => {
    assert.equal(
      templateNote({ field: "numbers", direction: "added", before: "—", after: "200 пострадавших" }, "ru"),
      "Появилось число: «—» → «200 пострадавших».",
    );
    assert.equal(
      templateNote({ field: "numbers", direction: "removed", before: "2 пострадавших", after: "—" }, "en"),
      "A number disappeared: «2 пострадавших» → «—».",
    );
    assert.equal(
      templateNote({ field: "time", direction: "shifted", before: "2021", after: "вчера" }, "ru"),
      "Событие сдвинуто во времени: «2021» → «вчера».",
    );
  });
});

describe("diffNumbers: множитель в about", () => {
  it("«2 365,6» + «тысяч жителей» → 2 365 600, рост на 2,4% — не мутация", () => {
    assert.deepEqual(
      diffNumbers(
        [{ value: "2 365,6", about: "тысяч жителей" }],
        [{ value: "2.423.287", about: "жителей" }],
        "ru",
      ),
      [],
    );
  });
});

describe("parseNumber: составные числа", () => {
  it("«2 млн 401 тысячу» = 2 401 000", () => {
    assert.equal(parseNumber("2 млн 401 тысячу жителей")?.value, 2_401_000);
  });
});
