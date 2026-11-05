/**
 * Сообщения бэкенда, которые видит пользователь: лимиты, размер запроса, сбои задачи.
 * Служебные ответы (неверный запрос, «нет такого адреса») и логи остаются по-русски: их читает разработчик.
 * Языки UI, которых нет в списке, получают английский (как в этапах 06 и 08).
 */
import type { ApiError, LanguageCode } from "@news/contracts";
import type { GuardedAction } from "./pipeline/guard.ts";

interface Messages {
  fileTooLarge: string;
  textTooLong: (max: number) => string;
  chatTooLong: string;
  chatFailed: string;
  claimCheckFailed: string;
  /** Подписи материала без названия */
  titles: { untitled: string; screenshot: string; image: string };
  /** Текст сбоя по коду. В ru этапы пишут подробнее, поэтому там берём их текст (см. pipelineErrorText) */
  jobFailed: Record<ApiError["code"], string>;
  limits: Record<GuardedAction, { perIp: string; daily: string }>;
}

const MESSAGES: Record<string, Messages> = {
  ru: {
    fileTooLarge: "Файл слишком большой",
    textTooLong: (max) => `Текст слишком длинный: до ${max.toLocaleString("ru-RU")} символов`,
    chatTooLong: "Слишком длинный разговор — начни новый чат",
    chatFailed: "Не удалось получить ответ, попробуйте ещё раз",
    claimCheckFailed: "Не удалось проверить тезис",
    titles: { untitled: "Без названия", screenshot: "Скриншот", image: "Изображение" },
    jobFailed: {
      VIDEO_UNAVAILABLE: "Не удалось открыть видео: оно удалено, недоступно или ссылка неверная",
      UNSUPPORTED_PLATFORM: "На этой странице не нашли ни видео, ни текста статьи",
      TRANSCRIPTION_FAILED: "Не удалось распознать речь или текст",
      RATE_LIMITED: "Платформа временно ограничила запросы, попробуй через минуту",
      INTERNAL: "Что-то пошло не так на сервере, попробуй ещё раз",
    },
    limits: {
      job: {
        perIp: "Слишком много проверок подряд. Подожди немного и попробуй снова",
        daily: "Сервис сегодня исчерпал дневной лимит проверок. Попробуй завтра",
      },
      check: {
        perIp: "Слишком много проверок подряд — это утверждение проверим чуть позже",
        daily: "Дневной лимит проверок исчерпан — попробуй завтра",
      },
      chat: {
        perIp: "Слишком много вопросов подряд. Подожди немного и спроси снова",
        daily: "Ассистент сегодня исчерпал дневной лимит. Попробуй завтра",
      },
    },
  },
  ro: {
    fileTooLarge: "Fișierul este prea mare",
    textTooLong: (max) => `Textul este prea lung: maximum ${max.toLocaleString("ro-RO")} de caractere`,
    chatTooLong: "Conversația este prea lungă. Începe un chat nou",
    chatFailed: "Nu am putut obține un răspuns, încearcă din nou",
    claimCheckFailed: "Afirmația nu a putut fi verificată",
    titles: { untitled: "Fără titlu", screenshot: "Captură de ecran", image: "Imagine" },
    jobFailed: {
      VIDEO_UNAVAILABLE:
        "Videoclipul nu a putut fi deschis: a fost șters, nu este disponibil sau linkul e greșit",
      UNSUPPORTED_PLATFORM: "Pe această pagină nu am găsit nici video, nici textul unui articol",
      TRANSCRIPTION_FAILED: "Nu am putut recunoaște vorbirea sau textul",
      RATE_LIMITED: "Platforma a limitat temporar cererile, încearcă peste un minut",
      INTERNAL: "Ceva nu a mers pe server, încearcă din nou",
    },
    limits: {
      job: {
        perIp: "Prea multe verificări la rând. Așteaptă puțin și încearcă din nou",
        daily: "Serviciul a epuizat azi limita zilnică de verificări. Încearcă mâine",
      },
      check: {
        perIp: "Prea multe verificări la rând. Vom verifica această afirmație puțin mai târziu",
        daily: "Limita zilnică de verificări s-a epuizat. Încearcă mâine",
      },
      chat: {
        perIp: "Prea multe întrebări la rând. Așteaptă puțin și întreabă din nou",
        daily: "Asistentul a epuizat azi limita zilnică. Încearcă mâine",
      },
    },
  },
  en: {
    fileTooLarge: "The file is too large",
    textTooLong: (max) => `The text is too long: up to ${max.toLocaleString("en-US")} characters`,
    chatTooLong: "The conversation is too long. Start a new chat",
    chatFailed: "Could not get a reply, please try again",
    claimCheckFailed: "The claim could not be checked",
    titles: { untitled: "Untitled", screenshot: "Screenshot", image: "Image" },
    jobFailed: {
      VIDEO_UNAVAILABLE: "Could not open the video: it was removed, is unavailable, or the link is wrong",
      UNSUPPORTED_PLATFORM: "No video or article text was found on this page",
      TRANSCRIPTION_FAILED: "Could not recognize the speech or text",
      RATE_LIMITED: "The platform has temporarily limited requests, try again in a minute",
      INTERNAL: "Something went wrong on the server, please try again",
    },
    limits: {
      job: {
        perIp: "Too many checks in a row. Wait a moment and try again",
        daily: "The service has reached its daily check limit. Try again tomorrow",
      },
      check: {
        perIp: "Too many checks in a row. This claim will be checked a little later",
        daily: "The daily check limit has been reached. Try again tomorrow",
      },
      chat: {
        perIp: "Too many questions in a row. Wait a moment and ask again",
        daily: "The assistant has reached its daily limit. Try again tomorrow",
      },
    },
  },
};

export function messagesFor(uiLanguage: LanguageCode): Messages {
  return MESSAGES[uiLanguage] ?? MESSAGES.en;
}

/** Этапы пишут причину сбоя по-русски; на других языках показываем общий текст по коду */
export function pipelineErrorText(code: ApiError["code"], text: string, uiLanguage: LanguageCode): string {
  return uiLanguage === "ru" ? text : messagesFor(uiLanguage).jobFailed[code];
}
