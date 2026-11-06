import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pipelineErrorText, PAGE_BLOCKED } from "../../messages.ts";
import { markdownToText } from "./article.ts";
import { isVideoMeta } from "./real.ts";

describe("текст статьи через поисковый сервис", () => {
  it("убирает разметку, но оставляет слова ссылок", () => {
    const { title, text } = markdownToText(
      "# Заголовок **статьи**\n\n![фото](a.jpg)\n\nДодон [потребовал](https://x.md/1) отзыва.\n\n- Второй пункт",
    );
    assert.equal(title, "Заголовок статьи");
    assert.match(text, /Додон потребовал отзыва\./);
    assert.match(text, /Второй пункт/);
    assert.doesNotMatch(text, /https|фото|\*\*/);
  });
});

describe("чистка текста сервиса", () => {
  it("оставляет абзацы после заголовка и выбрасывает меню и чужие заголовки", () => {
    const paragraph = "Первый абзац статьи с достаточно длинным текстом, чтобы считаться настоящим абзацем.";
    const markdown = [
      "Главная",
      "Экономика новостей: 361",
      "# Заголовок",
      paragraph.repeat(4),
      "Другая новость без точки в конце и с длинным заголовком для проверки",
      "Volvo с запасом хода до 810 км: приглашаем на дни открытых дверей;",
      paragraph.repeat(4),
    ].join("\n\n");
    const { text } = markdownToText(markdown);
    assert.equal(text, paragraph.repeat(4));
  });
});

describe("сообщение о блокировке", () => {
  it("есть на всех языках и даёт контакт", () => {
    for (const language of ["ru", "ro", "en"]) {
      assert.match(pipelineErrorText("VIDEO_UNAVAILABLE", PAGE_BLOCKED, language), /natankatsif@gmail\.com/);
    }
  });
});

describe("видео или статья", () => {
  const page = { platform: "generic", pageUrl: "https://www.jurnal.md/ru/news/1.html" };

  it("плеер на странице новости не делает её видео", () => {
    assert.equal(isVideoMeta({ extractor_key: "HTML5MediaEmbed", duration: undefined }, page), false);
    assert.equal(isVideoMeta({ extractor_key: "HTML5MediaEmbed", duration: 90 }, page), false);
    assert.equal(
      isVideoMeta(
        { extractor_key: "Youtube", duration: 90, webpage_url: "https://youtube.com/watch?v=1" },
        page,
      ),
      false,
    );
  });

  it("видеоплатформа остаётся видео", () => {
    assert.equal(isVideoMeta({ extractor_key: "Youtube" }, { ...page, platform: "youtube" }), true);
    const vimeo = { platform: "generic", pageUrl: "https://vimeo.com/1" };
    assert.equal(
      isVideoMeta({ extractor_key: "Vimeo", duration: 90, webpage_url: vimeo.pageUrl }, vimeo),
      true,
    );
  });
});
