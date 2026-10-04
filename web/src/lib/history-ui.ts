/**
 * Открыта ли панель «История» — общий флажок для шапки (открывает панель) и чудика в углу текста
 * (улетает к панели, пока её смотрят). Без контекста: шапка и панель текста в разных ветках дерева.
 */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setHistoryOpen(value: boolean): void {
  if (open === value) return;
  open = value;
  listeners.forEach((l) => l());
}

export function useHistoryOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}

/**
 * Чудик был не дома (у истории или в полёте), когда страница сменилась (выбрали другую проверку): чудик
 * новой страницы не появляется в углу сразу, а прилетает туда — ровно с того места, где был старый,
 * даже если тот не успел долететь.
 */
export interface BlobHandoff {
  left: number;
  top: number;
  /** Размер чудика там, откуда летит (на экране анализа он меньше); нет — как в углу */
  size?: number;
  /** С какой эмоцией стартует (BlobMood из CornerEmojis); нет — сразу эмоция новой страницы */
  mood?: string;
}

let blobReturnFrom: BlobHandoff | null = null;

/** Также экран анализа: пока он открыт, держит здесь место чудика — разбор прилетит оттуда */
export function markBlobReturn(from: BlobHandoff): void {
  blobReturnFrom = from;
}

export function peekBlobReturn(): BlobHandoff | null {
  return blobReturnFrom;
}

export function clearBlobReturn(): void {
  blobReturnFrom = null;
}

/**
 * Запуск проверки с главной: откуда (из толпы, home/EmojiCrowd) вылетает чудик экрана анализа.
 * Отдельно от возвращения в угол разбора — у них разные получатели.
 */
let crowdLaunch: BlobHandoff | null = null;

/** Запомнить, где на главной бирюзовый из толпы, — экран анализа прилетит оттуда */
export function markCrowdLaunch(): void {
  const el = document.querySelector<HTMLElement>('[data-pencil-name="Teal Blob"]');
  const r = el?.getBoundingClientRect();
  crowdLaunch = r ? { left: r.left, top: r.top, size: r.width, mood: "crowd" } : null;
}

/** Забрать место запуска (один раз) */
export function takeCrowdLaunch(): BlobHandoff | null {
  const from = crowdLaunch;
  crowdLaunch = null;
  return from;
}

/**
 * Проверка не нашла ни одного утверждения («привет», мнение, вопрос): возвращаемся на главную, бирюзовый из
 * толпы говорит это в облачке, а в поле снова то, что ввёл пользователь.
 */
export interface CrowdSay {
  message: string;
  input: string;
  isUrl: boolean;
}

let crowdSay: CrowdSay | null = null;
const crowdSayListeners = new Set<() => void>();

export function markCrowdSay(say: CrowdSay | null): void {
  crowdSay = say;
  crowdSayListeners.forEach((l) => l());
}

/** Забрать реплику (один раз) */
export function takeCrowdSay(): CrowdSay | null {
  const say = crowdSay;
  crowdSay = null;
  crowdSayListeners.forEach((l) => l());
  return say;
}

export function clearCrowdSay(): void {
  if (crowdSay === null) return;
  crowdSay = null;
  crowdSayListeners.forEach((l) => l());
}

export function useCrowdSay(): CrowdSay | null {
  return useSyncExternalStore(
    (l) => {
      crowdSayListeners.add(l);
      return () => crowdSayListeners.delete(l);
    },
    () => crowdSay,
    () => null,
  );
}
