/**
 * ФИНАЛЬНАЯ МОДЕЛЬ ДЛЯ ФРОНТА.
 * Это то, что отдаёт этап 06-delivery и что рисует расширение.
 * Всё здесь уже "готово к показу": тексты на языке UI, без внутренних полей пайплайна.
 */
import type {
  ClaimId,
  ISODateString,
  JobId,
  LanguageCode,
  Seconds,
  SourceId,
  TimeRange,
  VideoInfo,
} from "./common.ts";

/** Итоговая метка. Цвет/иконку выбирает фронт. */
export type VerdictLabel =
  | "true" //            правда                     (score 9–10)
  | "mostly_true" //     в основном правда          (score 7–8)
  | "mixed" //           частично правда            (score 5–6)
  | "misleading" //      вводит в заблуждение       (score 3–5, факт верный, вывод нет)
  | "mostly_false" //    в основном ложь            (score 2–4)
  | "false" //           ложь                       (score 0–1)
  | "unverifiable"; //   нельзя проверить (прогноз, мнение, нет данных) → score = null

export type ClaimCategory =
  | "event" //        событие ("в Украине идёт война")
  | "statistic" //    число/статистика
  | "quote" //        цитата кого-то
  | "scientific" //   научное утверждение
  | "historical" //   исторический факт
  | "prediction" //   прогноз
  | "other";

/** Позиция источника относительно утверждения */
export type SourceStance = "supports" | "refutes" | "mixed" | "neutral";

export type SourceType =
  | "news"
  | "government"
  | "international_org"
  | "academic"
  | "fact_checker"
  | "encyclopedia"
  | "ngo"
  | "other";

/** Карточка источника для UI */
export interface SourceCard {
  id: SourceId;
  url: string;
  title: string;
  /** Название издания/организации: "Reuters", "ООН" */
  publisher: string;
  /** "reuters.com" — удобно для фавиконки */
  domain: string;
  faviconUrl?: string;
  sourceType: SourceType;
  publishedAt?: ISODateString;
  language: LanguageCode;
  /** Страна издателя (ISO 3166-1 alpha-2), чтобы показать разнообразие точек зрения */
  country?: string;
  /** Короткий фрагмент, который подтверждает/опровергает (1–2 предложения) */
  snippet: string;
  stance: SourceStance;
}

export interface Verdict {
  /** 0..10 целое. null — если label = "unverifiable" */
  score: number | null;
  label: VerdictLabel;
  /** Уверенность модели в оценке 0..1 */
  confidence: number;
  /** Одно предложение для бейджа/тултипа */
  summary: string;
  /** Развёрнутое объяснение для раскрытой карточки (2–5 предложений) */
  explanation: string;
}

/**
 * checking — тезис найден, идёт поиск/проверка (показываем лоадер на таймкоде)
 * done     — есть вердикт
 * failed   — не смогли проверить из-за ошибки
 */
export type FactCheckStatus = "checking" | "done" | "failed";

/** ОДИН проверенный тезис — главная сущность для дизайна */
export interface FactCheck {
  id: ClaimId;
  status: FactCheckStatus;
  /** Когда в видео это говорится. Показываем оверлей, пока currentTime в [start, end] (+ немного после) */
  range: TimeRange;
  /** Дословно, как сказано в видео */
  quote: string;
  /** Переформулированный самодостаточный тезис, который проверяли */
  claim: string;
  category: ClaimCategory;
  speaker?: string;
  /** null пока status = "checking" или "failed" */
  verdict: Verdict | null;
  /** Может быть пустым, пока status = "checking" */
  sources: SourceCard[];
  checkedAt?: ISODateString;
  /** Только при status = "failed" */
  error?: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

/** Полный отчёт по видео (GET /api/jobs/:id и финальное событие job.completed) */
export interface VideoReport {
  jobId: JobId;
  video: VideoInfo;
  status: JobStatus;
  /** До какой секунды видео бэкенд уже всё обработал (для прогресс-бара на таймлайне) */
  processedUntil: Seconds;
  /** Отсортированы по range.start */
  factChecks: FactCheck[];
}
