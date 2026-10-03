/**
 * Тексты вердиктов, которые код выставляет сам, без LLM (нет источников, прогноз, нет доказательств).
 * Языки UI, которых нет в списке, получают английский.
 */
import type { LanguageCode } from "@news/contracts";

export type FixedVerdict = "no_sources" | "no_evidence" | "prediction";

const TEXTS: Record<string, Record<FixedVerdict, { summary: string; explanation: string }>> = {
  ru: {
    no_sources: {
      summary: "Не нашли источников, по которым можно проверить это утверждение.",
      explanation:
        "Поиск не дал материалов, которые подтверждали бы или опровергали тезис. Без источников мы не выставляем оценку.",
    },
    no_evidence: {
      summary: "Найденные источники не позволяют проверить утверждение.",
      explanation:
        "Источники по теме не содержат прямых данных, которые подтверждали бы или опровергали тезис. Без таких данных мы не выставляем оценку.",
    },
    prediction: {
      summary: "Это прогноз — проверить его сейчас нельзя.",
      explanation:
        "Утверждение касается будущего. Проверить его можно будет только после того, как событие наступит или не наступит.",
    },
  },
  uk: {
    no_sources: {
      summary: "Не знайшли джерел, за якими можна перевірити це твердження.",
      explanation:
        "Пошук не дав матеріалів, які підтверджували б або спростовували тезу. Без джерел ми не виставляємо оцінку.",
    },
    no_evidence: {
      summary: "Знайдені джерела не дозволяють перевірити твердження.",
      explanation:
        "Джерела на цю тему не містять прямих даних, які підтверджували б або спростовували тезу. Без таких даних ми не виставляємо оцінку.",
    },
    prediction: {
      summary: "Це прогноз — перевірити його зараз неможливо.",
      explanation:
        "Твердження стосується майбутнього. Перевірити його можна буде лише після того, як подія настане або не настане.",
    },
  },
  en: {
    no_sources: {
      summary: "No sources were found to check this claim.",
      explanation:
        "The search returned no material that supports or refutes the claim. We do not give a score without sources.",
    },
    no_evidence: {
      summary: "The sources found do not allow this claim to be checked.",
      explanation:
        "The sources on this topic contain no direct evidence that supports or refutes the claim. We do not give a score without such evidence.",
    },
    prediction: {
      summary: "This is a prediction and cannot be checked yet.",
      explanation:
        "The claim is about the future. It can only be checked once the event has or has not happened.",
    },
  },
};

export function fixedTexts(kind: FixedVerdict, uiLanguage: LanguageCode) {
  return (TEXTS[uiLanguage] ?? TEXTS.en)[kind];
}
