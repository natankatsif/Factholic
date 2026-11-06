import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { failedPageView, imageOfPage, sanitizePage } from "./page-view.ts";

const PAGE = `<html><head><script src="x.js"></script><meta http-equiv="refresh" content="0;url=/x">
<base href="/other"></head><body onload="go()">
<iframe src="https://ads.example"></iframe>
<a href="javascript:alert(1)" onclick="go()">плохая</a>
<a href="/news">новость</a>
<form action="/send" method="post"><input></form>
<img data-src="/photo.jpg" loading="lazy">
<p>Текст статьи</p></body></html>`;

describe("копия статьи", () => {
  const html = sanitizePage(PAGE, "https://site.md/a", "abc");

  it("убирает всё, что выполняется", () => {
    assert.doesNotMatch(html, /x\.js|iframe|refresh|onload|onclick|javascript:|\/other/);
    assert.doesNotMatch(html, /action=|method=/);
  });

  it("оставляет текст, ссылки и картинки оригинала", () => {
    assert.match(html, /<base href="https:\/\/site\.md\/a"/);
    assert.match(html, /Текст статьи/);
    assert.match(html, /src="\/photo\.jpg"/);
    assert.match(html, /href="\/news"[^>]*target="_blank"|target="_blank"[^>]*href="\/news"/);
  });

  it("правила безопасности стоят в самой странице", () => {
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /default-src/);
  });

  it("запускает только наш скрипт", () => {
    assert.equal(html.match(/<script/g)?.length, 1);
    assert.match(html, /<script nonce="abc">/);
  });

  it("сообщает родителю, если страницу показать нельзя", () => {
    const failed = failedPageView();
    assert.match(failed.html, /fh:failed/);
    assert.match(failed.csp, /script-src 'nonce-/);
  });
});

describe("превью страницы", () => {
  const page = "https://site.md/news/1.html";

  it("берёт картинку, выбранную сайтом, и делает адрес полным", () => {
    const html = '<head><meta property="og:image" content="/img/a.png"></head>';
    assert.equal(imageOfPage(html, page), "https://site.md/img/a.png");
  });

  it("понимает разметку Twitter и не берёт логотипы из вёрстки", () => {
    const twitter = '<head><meta property="twitter:image:src" content="https://cdn.md/b.png"></head>';
    assert.equal(imageOfPage(twitter, page), "https://cdn.md/b.png");
    assert.equal(imageOfPage('<body><img src="/logo.svg"></body>', page), undefined);
  });

  it("не отдаёт адрес, который браузер мог бы выполнить", () => {
    const html = '<head><meta property="og:image" content="javascript:alert(1)"></head>';
    assert.equal(imageOfPage(html, page), undefined);
  });
});
