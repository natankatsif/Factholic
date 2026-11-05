/**
 * Пречек утверждений (client-side):
 * 1. Быстрая эвристика (0 мс) на приветствия, типовые междометия, односложные фразы
 *    (например, «привкет», «привет», «хай», «как дела»).
 * 2. Реплика чудика, если проверять нечего: тексты — в словаре (t.precheck), здесь только выбор.
 * Списки слов ниже — про текст, который ввёл человек, а не про язык интерфейса: их не переводим.
 */
import type { SiteDictionary } from "../i18n/site";

const GREETING_STEMS = [
  /^прив/i, // привет, привкет, приветик, приветос, прив, приветству...
  /^превед/i, // превед
  /^здрав/i, // здравствуйте, здравствуй, здравия
  /^здра[ссь]/i, // здрасте, здрасьте
  /^салют/i, // салют
  /^здаров/i, // здарова
  /^здоров/i, // здорово
  /^хай/i, // хай
  /^хей/i, // хей
  /^хэй/i, // хэй
  /^хелло/i, // хелло, хеллоу
  /^хело/i, // хело, хелоу
  /^добр/i, // добрый, доброе, доброго, добра
  /^hello/i,
  /^hey/i,
  /^hi$/i,
  /^howdy/i,
  /^greetings/i,
];

const FILLER_WORDS = new Set([
  // Russian
  "ку",
  "йоу",
  "йо",
  "угу",
  "ага",
  "неа",
  "ок",
  "окей",
  "оки",
  "ясно",
  "понятно",
  "ладно",
  "хорошо",
  "ладушки",
  "день",
  "утро",
  "вечер",
  "ночи",
  "суток",
  "время",
  "времени",
  "как",
  "дела",
  "делишки",
  "жизнь",
  "житуха",
  "оно",
  "че",
  "чё",
  "чо",
  "что",
  "кого",
  "куда",
  "кто",
  "ты",
  "вы",
  "тебя",
  "вас",
  "такое",
  "это",
  "тут",
  "здесь",
  "там",
  "зачем",
  "почему",
  "такой",
  "такая",
  "такие",
  "вообще",
  "спасибо",
  "спасибки",
  "пожалуйста",
  "благодарю",
  "плиз",
  "пж",
  "пожалуйсто",
  "тест",
  "тестик",
  "проверка",
  "проверочка",
  "ахах",
  "хаха",
  "хахаха",
  "лол",
  "кек",
  "рофл",
  "чудик",
  "друг",
  "бот",
  "брат",
  "бро",
  "всем",
  "люди",
  "народ",
  "чел",
  "чувак",
  // English
  "sup",
  "yo",
  "hiya",
  "good",
  "morning",
  "afternoon",
  "evening",
  "night",
  "day",
  "how",
  "are",
  "you",
  "u",
  "doing",
  "is",
  "it",
  "going",
  "whats",
  "up",
  "who",
  "what",
  "why",
  "where",
  "thanks",
  "thank",
  "thx",
  "please",
  "pls",
  "yes",
  "no",
  "okay",
  "sure",
  "yep",
  "nope",
  "nah",
  "test",
  "testing",
  "check",
  "lol",
  "haha",
  "hahaha",
  "rofl",
  "lmao",
  "friend",
  "bro",
  "bot",
  "all",
  "there",
  "everyone",
]);

function isGreetingOrFiller(w: string): boolean {
  if (FILLER_WORDS.has(w)) return true;
  return GREETING_STEMS.some((rx) => rx.test(w));
}

/**
 * Определяет, является ли входной текст заведомо не содержащим проверяемых фактов
 * (приветствия, опечатки приветствий типа «привкет», вежливые слова, вопросы о себе).
 */
export function isObviouslyNonFactual(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;

  // Одиночные цифры или тесты типа "123", "1", "00"
  if (/^\d{1,4}$/.test(trimmed)) return true;

  // Если есть цифры и длина > 4 (например, "в 2024 году", "на 15%"),
  // это может быть проверяемый факт — не отсекаем локально
  if (/\d/.test(trimmed)) return false;

  // Разбиваем на слова (буквы)
  const words = trimmed
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

  if (words.length === 0) return true;

  // Если фраза длинная (> 6 слов), отдаём на проверку бэкенду/LLM
  if (words.length > 6) return false;

  // Проверяем каждое слово: является ли оно приветствием или разговорным заполнителем
  return words.every(isGreetingOrFiller);
}

/**
 * Подбирает естественный, релевантный контексту ответ без смайликов и шаблонных примеров,
 * когда утверждений для проверки не найдено.
 */
export function getNonFactualMessage(raw: string, isUrl: boolean, texts: SiteDictionary["precheck"]): string {
  if (isUrl) {
    return texts.url;
  }

  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Вопросы о самом сервисе
  if (/^(кто ты|что ты|ты кто|что это|как это работает|зачем ты)/i.test(trimmed)) {
    return texts.about;
  }

  // Приветствия
  const words = lower.split(/[^\p{L}]+/u).filter(Boolean);
  const hasGreeting = words.some((w) => GREETING_STEMS.some((rx) => rx.test(w)));
  if (hasGreeting) {
    return texts.greeting;
  }

  // Тестовые реплики или короткие заполнители ("123", "тест", "ок", "ясно")
  if (words.length <= 2 && (words.every((w) => FILLER_WORDS.has(w)) || /^(тест|проверк)/i.test(trimmed))) {
    return texts.filler;
  }

  // Короткие вопросы ("правда ли?", "почему так?")
  if (trimmed.endsWith("?") && words.length <= 4) {
    return texts.shortQuestion;
  }

  // Текст без фактов (личное мнение, рассуждения)
  return texts.text;
}
