import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Claim } from "../03-claim-extraction/types.ts";
import {
  claimCountry,
  mentionsAnchor,
  postsToCandidates,
  verifiedAnchors,
  type AnchorPage,
} from "./anchors.ts";
import { debunkQueries } from "./copies.ts";
import { namesClaim } from "./same-event.ts";

const page: AnchorPage = {
  id: "p1",
  title: "Ce presupune programul",
  excerpt: "Programul „Moldova Pregătită” pornește de la un principiu simplu.",
  text: "Programul „Moldova Pregătită” pornește de la un principiu simplu. Drona a căzut lângă Lopatna.",
  language: "ro",
};
const claimWith = (fields: Partial<Claim>) =>
  ({ normalized: "", quote: "", entities: [], ...fields }) as unknown as Claim;

describe("зацепки", () => {
  it("принимает только то, что дословно есть на странице", () => {
    const raw = [
      { term: "Moldova Pregătită", pageId: "p1" },
      { term: "Operațiunea Scut", pageId: "p1" },
    ];
    assert.deepEqual(verifiedAnchors(raw, [page], "Statul cere rezerve", new Set()), [
      { term: "Moldova Pregătită", language: "ro" },
    ]);
  });

  it("не берёт слова самого утверждения, чужие id и уже опробованное", () => {
    const raw = [
      { term: "Lopatna", pageId: "p1" },
      { term: "principiu", pageId: "p9" },
      { term: "Moldova Pregătită", pageId: "p1" },
    ];
    assert.deepEqual(verifiedAnchors(raw, [page], "Drona din Lopatna", new Set(["moldova pregatita"])), []);
  });

  it("сравнивает без диакритики и регистра", () => {
    assert.ok(mentionsAnchor("programul MOLDOVA PREGATITA", "Moldova Pregătită"));
  });

  it("оставляет только посты с самой зацепкой", () => {
    const post = (title: string) => ({
      date_gmt: "2026-10-09T12:24:18",
      link: "https://newsmaker.md/a",
      title: { rendered: title },
      content: { rendered: "<p>Текст</p>" },
    });
    const found = postsToCandidates([post("Moldova este pregătită"), post("Lopatna: дрон")], {
      term: "Lopatna",
      language: "ru",
    });
    assert.deepEqual(
      found.map((c) => [c.title, c.publishedAt]),
      [["Lopatna: дрон", "2026-10-09T12:24:18Z"]],
    );
  });
});

describe("страна из утверждения", () => {
  it("берёт страну из текста и мест", () => {
    assert.equal(claimCountry(claimWith({ normalized: "Власти Молдовы просят запасы" })), "moldova");
    assert.equal(
      claimCountry(claimWith({ structure: { places: ["Кишинёв"] } as unknown as Claim["structure"] })),
      "moldova",
    );
  });

  it("не привязывает к Молдове, если страна не названа", () => {
    assert.equal(claimCountry(claimWith({ normalized: "Государство просит запасы на 72 часа" })), undefined);
  });
});

describe("запросы на разборы", () => {
  it("берёт по одному на язык", () => {
    const q = (language: string, intent: "refute" | "confirm", text: string) => ({
      text,
      language,
      intent,
      freshness: "any" as const,
    });
    const picked = debunkQueries([q("ro", "refute", "a"), q("ro", "refute", "b"), q("ru", "confirm", "c")]);
    assert.deepEqual(
      picked.map((x) => x.text),
      ["a"],
    );
  });
});

describe("страховка фильтра", () => {
  const claim = claimWith({
    normalized: "Republica Moldova renunță la neutralitate prin ajutorul Norvegiei",
  });

  it("оставляет разбор, заголовок которого повторяет утверждение", () => {
    const title = "DEZINFORMARE: Moldova renunță la neutralitate în schimbul sprijinului Norvegiei";
    assert.ok(namesClaim(claim, { title, excerpt: "" }));
  });

  it("не спасает похожую новость о другой стране", () => {
    const rezerve = claimWith({ normalized: "Guvernul Republicii Moldova cere rezerve hrană pentru 72 ore" });
    const title = "Guvernul britanic cere rezerve de hrană pentru 72 de ore";
    assert.equal(namesClaim(rezerve, { title, excerpt: "Marea Britanie" }), false);
  });
});
