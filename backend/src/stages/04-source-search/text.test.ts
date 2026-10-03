import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanText,
  coverage,
  detectLanguage,
  hits,
  keywordStems,
  pickExcerpt,
  pickSnippet,
  proseShare,
  stemSet,
  tokenize,
} from "./text.ts";

describe("tokenize", () => {
  it("нижний регистр, ё → е, только буквы и цифры", () => {
    assert.deepEqual(tokenize("Идёт ВОЙНА — 2022!"), ["идет", "война", "2022"]);
  });
});

describe("keywordStems", () => {
  it("основы по 5 букв; числа, короткие слова и стоп-слова отброшены", () => {
    assert.deepEqual(keywordStems("Население Земли превысило 8 млрд человек в 2022 году. Это the"), [
      "насел",
      "земли",
      "превы",
      "млрд",
      "челов",
      "году",
    ]);
  });

  it("слова из запросов-проверок (fact check, миф, опровержение…) не считаются ключевыми", () => {
    assert.deepEqual(keywordStems("Ukraine war fact check", "debunk hoax fake myth"), ["ukrai", "war"]);
    assert.deepEqual(keywordStems("война в Украине: миф или правда? Проверка, опровержение, ложь, фейк"), [
      "война",
      "украи",
    ]);
  });

  it("разные падежи дают одну основу, несколько текстов объединяются без дублей", () => {
    assert.deepEqual(keywordStems("Украина", "в Украине", "Украину"), ["украи"]);
  });

  it("пустой ввод → пустой список", () => {
    assert.deepEqual(keywordStems(), []);
    assert.deepEqual(keywordStems("и в на", "the and"), []);
  });
});

describe("stemSet / hits", () => {
  it("stemSet — основы всех слов текста, hits — сколько ключевых слов среди них", () => {
    const present = stemSet("Война в Украине идёт");
    assert.deepEqual([...present], ["война", "в", "украи", "идет"]);
    assert.equal(hits(present, ["украи", "война", "борщ"]), 2);
    assert.equal(hits(present, []), 0);
  });
});

describe("coverage", () => {
  const stems = keywordStems("население Украины в 2022 году");

  it("доля ключевых слов, встретившихся в тексте (с точностью до окончания)", () => {
    assert.deepEqual(stems, ["насел", "украи", "году"]);
    assert.equal(coverage("Население на Украине сократилось", stems), 2 / 3);
    assert.equal(coverage("Население Украины в 2022 году", stems), 1);
    assert.equal(coverage("Рецепт борща", stems), 0);
  });

  it("одни и те же числа на странице не добавляют совпадений", () => {
    assert.equal(coverage("2022 2022 2022", stems), 0);
  });

  it("без ключевых слов → 0", () => {
    assert.equal(coverage("любой текст", []), 0);
  });
});

describe("pickExcerpt", () => {
  const stems = keywordStems("Население Земли превысило 8 млрд человек");
  const page = [
    "Главная | Новости | Контакты",
    "Погода в регионе на выходные обещает быть солнечной и тёплой, без осадков.",
    "По оценке ООН, население Земли превысило 8 млрд человек 15 ноября 2022 года.",
    "Подписывайтесь на рассылку, чтобы получать новости первыми каждый день.",
    "Рост численности человек замедляется: по прогнозам, население Земли достигнет пика в 2080-х.",
  ].join("\n\n");

  it("берёт релевантные абзацы в исходном порядке, меню и нерелевантное отбрасывает", () => {
    const excerpt = pickExcerpt(page, stems);
    assert.equal(
      excerpt,
      "По оценке ООН, население Земли превысило 8 млрд человек 15 ноября 2022 года. … " +
        "Рост численности человек замедляется: по прогнозам, население Земли достигнет пика в 2080-х.",
    );
  });

  it("не превышает maxChars", () => {
    const long = Array.from(
      { length: 50 },
      (_, i) => `Абзац ${i}: население Земли превысило 8 млрд человек, сообщает статистика.`,
    ).join("\n");
    const excerpt = pickExcerpt(long, stems, 500);
    assert.ok(excerpt.length <= 500, `длина ${excerpt.length}`);
    assert.ok(excerpt.length > 300);
  });

  it("длинный абзац режется по предложениям, а не берётся целиком", () => {
    const filler = "Это предложение о погоде и никак не связано с темой статьи вообще. ".repeat(20);
    const paragraph = `${filler}Население Земли превысило 8 млрд человек. ${filler}`;
    const excerpt = pickExcerpt(paragraph, stems);
    assert.ok(excerpt.includes("Население Земли превысило 8 млрд человек."));
    assert.ok(excerpt.length < paragraph.length / 2);
  });

  it("ничего не совпало → начало текста со схлопнутыми пробелами", () => {
    const excerpt = pickExcerpt("Совсем   другой\n\nтекст про  погоду.", stems);
    assert.equal(excerpt, "Совсем другой текст про погоду.");
  });

  it("обрезка по границе слова с многоточием", () => {
    const excerpt = pickExcerpt("слово ".repeat(100), ["нет"], 50);
    assert.ok(excerpt.length <= 50);
    assert.ok(excerpt.endsWith("слово…"));
  });
});

describe("pickSnippet", () => {
  const stems = keywordStems("Население Земли превысило 8 млрд человек");

  it("самое релевантное предложение excerpt'а", () => {
    const excerpt =
      "Доклад опубликован в понедельник утром. По оценке ООН, население Земли превысило 8 млрд человек. " +
      "Авторы доклада благодарят коллег.";
    assert.equal(pickSnippet(excerpt, stems), "По оценке ООН, население Земли превысило 8 млрд человек.");
  });

  it("куски excerpt'а, склеенные через « … », считаются отдельными предложениями", () => {
    const excerpt = "Какой-то вводный абзац без точки в конце … Население Земли превысило 8 млрд человек";
    assert.equal(pickSnippet(excerpt, stems), "Население Земли превысило 8 млрд человек");
  });

  it("не длиннее maxChars", () => {
    const sentence = `Население Земли превысило 8 млрд человек, ${"и это очень длинное продолжение ".repeat(20)}.`;
    const snippet = pickSnippet(sentence, stems);
    assert.ok(snippet.length <= 280);
    assert.ok(snippet.endsWith("…"));
  });

  it("нет предложений длиной от 20 символов → сам excerpt", () => {
    assert.equal(pickSnippet("Коротко.", stems), "Коротко.");
  });
});

describe("detectLanguage", () => {
  it("кириллица при латинском fallback → ru", () => {
    assert.equal(detectLanguage("Боевые действия продолжаются на нескольких направлениях", "en"), "ru");
  });

  it("украинские буквы → uk", () => {
    assert.equal(
      detectLanguage("Бойові дії тривають на кількох напрямках, повідомляють військові", "ru"),
      "uk",
    );
  });

  it("латиница при кириллическом fallback → en", () => {
    assert.equal(detectLanguage("Fighting continued along the front line overnight", "ru"), "en");
  });

  it("латиница при латинском fallback → fallback (немецкий не превращается в en)", () => {
    assert.equal(detectLanguage("Die Kämpfe an der Frontlinie gingen weiter", "de"), "de");
  });

  it("кириллица при кириллическом fallback → fallback (болгарский остаётся bg)", () => {
    assert.equal(detectLanguage("Боевете продължават по няколко направления", "bg"), "bg");
  });

  it("нет букв → fallback", () => {
    assert.equal(detectLanguage("2022 — 8 000 000 000", "fr"), "fr");
    assert.equal(detectLanguage("", "ru"), "ru");
  });

  it("белорусский текст при fallback be остаётся be (а не uk)", () => {
    assert.equal(detectLanguage("Беларусь — краіна ва Усходняй Еўропе, сталіца — горад Мінск.", "be"), "be");
  });

  it("ў → be при любом fallback", () => {
    assert.equal(detectLanguage("Беларусь — краіна ва Усходняй Еўропе, сталіца — горад Мінск.", "ru"), "be");
  });

  it("одно украинское название в русском тексте не делает его украинским", () => {
    assert.equal(
      detectLanguage("Президент выступил в Верховной Раде. На табличке было написано «Україна».", "en"),
      "ru",
    );
  });

  it("латиница с ≥ 3 служебными словами языка → этот язык, даже при другом fallback", () => {
    assert.equal(
      detectLanguage("Die Lage ist nicht klar, und die Regierung schweigt mit Absicht.", "ru"),
      "de",
    );
    assert.equal(
      detectLanguage("The war in Ukraine is the largest conflict in Europe and the toll is rising.", "de"),
      "en",
    );
  });
});

describe("мусор со страниц: меню, заголовки, невидимые символы", () => {
  const stems = keywordStems("Война в Украине продолжается");
  const menu =
    "Live Все публикации Лучшее с YouTube Эксклюзив ТСН Украина Политика Война Гламур Проспорт Леди Здоровье";
  const article =
    "Боевые действия в Украине продолжаются на нескольких направлениях, сообщают военные обеих сторон.";

  it("меню сайта не попадает в excerpt, даже если в нём много ключевых слов", () => {
    const excerpt = pickExcerpt(`${menu}\n\n${article}`, stems);
    assert.ok(!excerpt.includes("Гламур"), excerpt);
    assert.ok(excerpt.includes("Боевые действия"));
  });

  it("в snippet — законченное предложение, а не заголовок", () => {
    const headline = "Украина и война: главное за сутки о продолжении боевых действий";
    assert.equal(pickSnippet(`${headline} … ${article}`, stems), article);
  });

  it("proseShare: статья ≈ 1, список заголовков = 0", () => {
    assert.equal(proseShare(article), 1);
    assert.equal(
      proseShare("Украина и Южная Корея: скандал с пленными … Война в Украине: главное за сутки"),
      0,
    );
  });

  it("cleanText убирает невидимые символы, которые вставляет Reuters", () => {
    assert.equal(cleanText("the \u200bUkrainian capital \u2060of Kyiv"), "the Ukrainian capital of Kyiv");
  });

  it("знаки ударения не разрывают слова и убираются из цитаты", () => {
    assert.deepEqual(tokenize("Гражда\u0301нская война\u0301"), ["гражданская", "война"]);
    assert.equal(cleanText("Гражда\u0301нская война\u0301"), "Гражданская война");
  });
});
