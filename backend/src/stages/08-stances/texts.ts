/**
 * Тексты «сторон», которые код выставляет сам, без описания от LLM: нет источников, прогноз,
 * мало независимых источников с позицией. Только про источники — без «правда/ложь» и без оценок.
 * Языки UI, которых нет в списке, получают английский.
 */
import type { LanguageCode } from "@news/contracts";

export type FixedStances = "no_sources" | "few_sources" | "prediction";

const TEXTS: Record<string, Record<FixedStances, { summary: string; explanation: string }>> = {
  ru: {
    no_sources: {
      summary: "Не нашли источников, в которых говорится об этом утверждении.",
      explanation:
        "Поиск не дал материалов на эту тему. Без источников нельзя показать, что о тезисе пишут разные стороны.",
    },
    few_sources: {
      summary: "Мало независимых источников, которые прямо говорят об этом утверждении.",
      explanation:
        "Прямо подтверждают или опровергают тезис меньше двух независимых групп источников (перепечатки одного материала считаются одной группой). Этого мало, чтобы говорить о сторонах.",
    },
    prediction: {
      summary: "Это прогноз — источники пока не могут его подтвердить или опровергнуть.",
      explanation:
        "Утверждение касается будущего. Сравнить, что о нём пишут источники, можно будет после того, как событие наступит или не наступит.",
    },
  },
  uk: {
    no_sources: {
      summary: "Не знайшли джерел, у яких ідеться про це твердження.",
      explanation:
        "Пошук не дав матеріалів на цю тему. Без джерел неможливо показати, що про тезу пишуть різні сторони.",
    },
    few_sources: {
      summary: "Замало незалежних джерел, які прямо говорять про це твердження.",
      explanation:
        "Прямо підтверджують або спростовують тезу менше ніж дві незалежні групи джерел (передруки одного матеріалу вважаються однією групою). Цього замало, щоб говорити про сторони.",
    },
    prediction: {
      summary: "Це прогноз — джерела поки не можуть його підтвердити або спростувати.",
      explanation:
        "Твердження стосується майбутнього. Порівняти, що про нього пишуть джерела, можна буде після того, як подія настане або не настане.",
    },
  },
  en: {
    no_sources: {
      summary: "No sources were found that discuss this claim.",
      explanation:
        "The search returned no material on this topic. Without sources we cannot show what different sides say about the claim.",
    },
    few_sources: {
      summary: "Too few independent sources address this claim directly.",
      explanation:
        "Fewer than two independent groups of sources directly support or refute the claim (reprints of the same story count as one group). That is not enough to describe the sides.",
    },
    prediction: {
      summary: "This is a prediction, so sources cannot support or refute it yet.",
      explanation:
        "The claim is about the future. What sources say about it can only be compared once the event has or has not happened.",
    },
  },
};

export function fixedTexts(kind: FixedStances, uiLanguage: LanguageCode) {
  return (TEXTS[uiLanguage] ?? TEXTS.en)[kind];
}
