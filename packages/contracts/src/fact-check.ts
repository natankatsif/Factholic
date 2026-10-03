/**
 * ФИНАЛЬНАЯ МОДЕЛЬ ДЛЯ ФРОНТЕНДА И РАСШИРЕНИЯ (factholic).
 * То, что генерирует бэкенд и рисует UI/расширение:
 * - Сводка консенсуса источников («Сходятся», «Разделились», «Большинство против», «С флагами»)
 * - Флаги искажений («Старый контент», «Раздуто») и ключевые выводы («Событию 3,5 года»)
 * - Цепочка происхождения («Путь утверждения» и интерактивное «Дерево источников»)
 * - Детальный diff изменений («Что изменилось»: цифры, место, время, уверенность)
 * - Сводная панель («Разбор», статистика, фильтры, быстрые вопросы)
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

// =============================================================================
// КОНСЕНСУС И ВЕРДИКТЫ (Вместо единой оценки 0..10)
// =============================================================================

/** Позиция источников по утверждению (вкладки фильтров и плашки в плеере) */
export type ClaimConsensus =
  | "converge" //         Сходятся: позиции совпадают
  | "split" //            Разделились: мнения расходятся
  | "against" //          Большинство против: источники возражают
  | "flagged" //          С флагами: раздуто • старое
  | "unverifiable"; //    Мало источников / нельзя проверить

/** Категория утверждения по теме */
export type ClaimCategory =
  | "event" //        событие
  | "statistic" //    число/статистика
  | "quote" //        цитата кого-то
  | "scientific" //   научное утверждение
  | "historical" //   исторический факт
  | "prediction" //   прогноз
  | "other";

/** Типы флагов искажения / манипуляции */
export type ClaimFlagType = "outdated" | "exaggerated" | "distortion" | "other";

/** Флаг манипуляции или искажения утверждения */
export interface ClaimFlag {
  type: ClaimFlagType;
  /** Заголовок флага: "Старый контент", "Раздуто" */
  label: string;
  /** Детализация: "первоисточник от 14.03.2023", "2 → 200 пострадавших" */
  detail: string;
  severity?: "warning" | "danger" | "info";
}

/** Ключевой вывод фактчека для карточки (главная плашка) */
export interface KeyFinding {
  /** Крупный заголовок: "Событию 3,5 года" */
  title: string;
  /** Подзаголовок: "в видео подано как вчерашнее" */
  subtitle?: string;
}

// =============================================================================
// ДЕРЕВО И ПУТЬ УТВЕРЖДЕНИЯ (PROVENANCE & PROPAGATION GRAPH)
// =============================================================================

/** Краткий шаг в горизонтальной цепочке («Путь утверждения» в карточке разбора) */
export interface ProvenancePathStep {
  name: string; // "Новости MD", "Портал Х", "Срочно MD", "Город MD"
  date: string; // "14.03.2023", "2023", "сен 2026", "окт 2026"
  tag: string; // "оригинал", "пересказ", "склад → ТЦ", "2 → 200"
  isDistortion?: boolean; // признак искажения (красная/акцентная подсветка)
}

/** Роль узла в цепочке пересказов */
export type ProvenanceNodeRole =
  | "primary" //       Первоисточник
  | "retelling" //     Пересказ
  | "confirmation" //  Официальное подтверждение
  | "distortion" //    Искажение / раздувание
  | "target"; //       Исследуемое видео / фрагмент

/** Категория источника для бейджей: СМИ, официальный и т.п. */
export type ProvenanceSourceCategory =
  | "media" //        СМИ
  | "official" //     официальный (мэрия, министерство)
  | "channel" //      новостной канал / паблик
  | "social" //       соцсети
  | "fact_checker" // фактчекер
  | "other";

/** Действие по клику на узел */
export interface ProvenanceNodeAction {
  type: "open_source" | "watch_fragment";
  label: string; // "Открыть источник ↗" | "Смотреть фрагмент ↗"
  url?: string;
  timecodeSec?: number;
}

/** Узел интерактивного дерева источников */
export interface ProvenanceNode {
  id: string; // "src_news_md"
  name: string; // "Новости MD"
  /** Короткий код бейджа: "HM", "MK", "CM", "ГМ" */
  shortCode?: string;
  category: ProvenanceSourceCategory;
  categoryLabel?: string; // "СМИ", "официальный"
  role: ProvenanceNodeRole;
  isPrimary?: boolean; // true для первоисточника
  date: string; // "14 марта 2023", "март 2023", "октябрь 2026 • 02:15"
  isoDate?: ISODateString;
  quote: string; // "«Пожар на складе рядом с ТЦ, 2 пострадавших»"
  url?: string;
  /** Теги изменений на узле: ["@ дата убрана", "✂ склад → ТЦ"] или ["@ вчера", "2 2 → 200"] */
  tags?: string[];
  action?: ProvenanceNodeAction;
  column?: number;
  row?: number;
}

/** Тип связи между источниками в графе */
export type ProvenanceRelationType =
  | "direct" //          прямая связь (сплошная линия)
  | "likely_derived" //  вероятно взято отсюда (пунктир)
  | "confirmation" //    подтверждение (подтверждает: 2 пострадавших)
  | "distorted"; //      искажение / изменения в тексте (акцентная линия)

/** Категория изменения в тексте при пересказе */
export type MutationChangeCategory =
  | "numbers" //       Цифры
  | "location" //      Место
  | "time" //          Время
  | "confidence" //    Уверенность
  | string;

/** Детализированная мутация между двумя источниками */
export interface MutationChange {
  category: MutationChangeCategory;
  categoryLabel: string; // "Цифры", "Место", "Время", "Уверенность"
  description: string; // "«2» → «200», в 100 раз больше", "«рядом с рынком» — убрано"
}

/** Сравнение двух источников (панель «Связь между источниками») */
export interface ProvenanceEdgeDiff {
  before: {
    sourceName: string; // "Срочно MD"
    date?: string; // "сен 2026"
    text: string; // "Сгорел ТЦ рядом с рынком, 2 пострадавших"
  };
  after: {
    sourceName: string; // "Город MD, 02:15"
    date?: string; // "окт 2026"
    text: string; // "Вчера сгорел торговый центр, 200 пострадавших"
  };
  changes: MutationChange[];
}

/** Ребро между узлами в дереве источников */
export interface ProvenanceEdge {
  id: string; // "edge_srochno_gorod"
  fromNodeId: string;
  toNodeId: string;
  relationType: ProvenanceRelationType;
  label: string; // "пересказ без изменений", "вероятно взято отсюда", "сен 2026 → окт 2026 • пересказ с изменениями"
  hasDistortion?: boolean;
  diff?: ProvenanceEdgeDiff;
}

/** Временной разрыв на таймлайне (например, «3,5 года тишины») */
export interface TimelineGap {
  afterNodeId: string;
  beforeNodeId: string;
  label: string; // "3,5 года тишины"
}

/** Полная структура дерева источников и цепочки пересказов */
export interface ProvenanceTree {
  /** Горизонтальный путь для мини-превью в боковой панели */
  pathSummary: ProvenancePathStep[];
  /** Узлы дерева */
  nodes: ProvenanceNode[];
  /** Связи между узлами */
  edges: ProvenanceEdge[];
  /** Разрывы на шкале времени */
  timelineGaps?: TimelineGap[];
  /** Метки дат на нижней оси таймлайна */
  timelineDates?: string[];
  primarySourceCount?: number;
  totalSourcesCount?: number;
  /** Ребро, выбранное по умолчанию для правой панели diff */
  selectedEdgeId?: string;
}

// =============================================================================
// КАРТОЧКИ ИСТОЧНИКОВ
// =============================================================================

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

export interface SourceCard {
  id: SourceId;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  faviconUrl?: string;
  sourceType: SourceType;
  publishedAt?: ISODateString;
  language: LanguageCode;
  country?: string;
  snippet: string;
  stance: SourceStance;
}

// =============================================================================
// СТАРАЯ ОЦЕНКА 0..10 (LEGACY / FALLBACK)
// =============================================================================

export type VerdictLabel =
  "true" | "mostly_true" | "mixed" | "misleading" | "mostly_false" | "false" | "unverifiable";

export interface Verdict {
  score: number | null;
  label: VerdictLabel;
  confidence: number;
  summary: string;
  explanation: string;
}

// =============================================================================
// ГЛАВНЫЕ СУЩНОСТИ ФРОНТЕНДА: FACTCHECK & VIDEOREPORT
// =============================================================================

export type FactCheckStatus = "checking" | "done" | "failed";

/** ОДИН проверенный тезис */
export interface FactCheck {
  id: ClaimId;
  status: FactCheckStatus;
  range: TimeRange;
  /** Дословно, как сказано в видео */
  quote: string;
  /** Переформулированный тезис */
  claim: string;
  category: ClaimCategory;
  speaker?: string;

  /** Консенсус позиций источников */
  consensus: ClaimConsensus;
  /** Описание статуса («позиции совпадают», «мнения расходятся», «раздуто • старое») */
  consensusSummary?: string;

  /** Флаги манипуляций («Старый контент», «Раздуто») */
  flags: ClaimFlag[];

  /** Ключевой вывод: «Событию 3,5 года» / «в видео подано как вчерашнее» */
  keyFinding?: KeyFinding;

  /** Интерактивное дерево первоисточника и путь пересказов */
  provenance?: ProvenanceTree;

  /** Список источников для UI */
  sources: SourceCard[];

  /** @deprecated Старый скор 0..10. Сохранён для обратной совместимости. */
  verdict?: Verdict | null;

  checkedAt?: ISODateString;
  error?: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

/** Агрегированная статистика для боковой панели «Разбор» и нижней плашки */
export interface ReportSummary {
  title: string; // "Позиции источников по 4 утверждениям"
  subtitle: string; // "Общего вердикта нет - смотрите каждое утверждение"
  totalClaims: number; // 4
  totalSources: number; // 11
  primarySourcesCount: number; // 1
  consensusBreakdown: {
    converge: number; // 1 (Сходятся)
    split: number; // 1 (Разделились)
    against: number; // 1 (Большинство против)
    flagged: number; // 1 (С флагами)
  };
  flagBreakdown: {
    exaggerated: number; // 1 (Раздуто)
    outdated: number; // 1 (Старый контент)
    [flag: string]: number;
  };
  suggestedQuestions: string[]; // ["Кто первоисточник?", "Что исказили?", "Когда это было?"]
  footerNote?: string; // "* Каждое утверждение кликабельно — откроются источники и цепочка пересказов"
}

/** Полный отчёт по видео */
export interface VideoReport {
  jobId: JobId;
  video: VideoInfo;
  status: JobStatus;
  processedUntil: Seconds;
  summary?: ReportSummary;
  factChecks: FactCheck[];
}
