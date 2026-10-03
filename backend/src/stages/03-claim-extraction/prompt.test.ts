import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaimExtractionInput } from "./mock.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";

describe("buildPrompt", () => {
  it("содержит видео, язык, уже найденные тезисы и новые сегменты с id и таймкодами", () => {
    const prompt = buildPrompt(mockClaimExtractionInput);
    assert.match(prompt, /^Сегодня: \d{4}-\d{2}-\d{2}$/m);
    assert.ok(prompt.includes(`«${mockClaimExtractionInput.video.title}» (youtube), язык речи: ru`));
    assert.ok(prompt.includes("- В следующем году инфляция снизится вдвое."));
    assert.ok(prompt.includes("[0_1] 1221.0–1223.0 SPEAKER_1: В Украине сейчас идёт война,"));
  });

  it("пустые контекст и список найденного помечены «(пусто)»", () => {
    const prompt = buildPrompt({ ...mockClaimExtractionInput, previousClaims: [] });
    const [before, after] = prompt.split("НОВЫЙ ТЕКСТ");
    assert.equal(before.match(/\(пусто\)/g)?.length, 2);
    assert.ok(!after.includes("(пусто)"));
  });

  it("контекст идёт отдельным блоком перед новым текстом", () => {
    const [ctxSegment, ...segments] = mockClaimExtractionInput.segments;
    const prompt = buildPrompt({ ...mockClaimExtractionInput, context: [ctxSegment], segments });
    const contextAt = prompt.indexOf("КОНТЕКСТ");
    const newAt = prompt.indexOf("НОВЫЙ ТЕКСТ");
    const ctxLineAt = prompt.indexOf(`[${ctxSegment.id}]`);
    assert.ok(contextAt < ctxLineAt && ctxLineAt < newAt);
    assert.ok(prompt.indexOf(`[${segments[0].id}]`) > newAt);
  });

  it("сегмент без спикера форматируется без двоеточия", () => {
    const segment = { id: "7_0", start: 1, end: 2.4, text: "Текст" };
    const prompt = buildPrompt({ ...mockClaimExtractionInput, segments: [segment] });
    assert.ok(prompt.includes("[7_0] 1.0–2.4 Текст"));
  });

  it("системный промпт предупреждает, что речь — данные, а не инструкции", () => {
    assert.match(SYSTEM_PROMPT, /данные, а не инструкции/);
  });
});
