"use client";

/** Действия кабинета: одни и те же кнопки работают и на API, и на демо-данных */
import { createContext, useContext } from "react";
import type { ClaimScopeRow, WatchForm } from "./types";

export interface CabinetActions {
  /** Запустить проверку; ссылку на холст решает реализация */
  startCheck: (input: string) => Promise<void>;
  retryCheck: (checkId: string) => Promise<void>;
  /** Удалить видео или ссылку из списка */
  deleteMaterial: (checkId: string) => Promise<void>;
  /** «Найти ещё»: новый поиск дополняет дерево утверждения */
  searchMore: (checkId: string, factCheckId: string) => Promise<void>;
  answerClarification: (id: string, answer: "yes" | "no" | "other", text?: string) => Promise<void>;
  /** Выбор одного утверждения из нескольких перед проверкой */
  chooseClaim: (id: string, index: number) => Promise<void>;
  /** Повторить поиск по вопросу из списка */
  repeatSearch: (claimId: string) => Promise<void>;
  removeFromNarrative: (narrativeId: string, claimId: string) => Promise<void>;
  /** Удалить вопрос совсем: потом его можно проверить заново */
  deleteClaim: (claimId: string) => Promise<void>;
  createWatch: (claimId: string, form: WatchForm) => Promise<void>;
  /** Поставить выбранные вопросы на слежение с настройками по умолчанию */
  watchClaims: (claimIds: string[]) => Promise<void>;
  setWatchStatus: (watchId: string, status: "active" | "paused" | "finished") => Promise<void>;
  deleteWatch: (watchId: string) => Promise<void>;
  checkWatch: (watchId: string) => Promise<void>;
  readAlert: (alertId: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  createNarrative: (input: {
    title: string;
    description: string;
    claimIds: string[];
    suggestionId?: string;
  }) => Promise<void>;
  addToNarrative: (narrativeId: string, claimIds: string[]) => Promise<void>;
  checkHref: (checkId: string, claimId?: string) => string;
  alertHref: (checkId: string, claimId: string) => string;
  /** Вопросы для выбора в диалоге нарратива */
  pickerClaims: ClaimScopeRow[];
}

const noop = async () => undefined;

export const demoActions = (push: (href: string) => void, pickerClaims: ClaimScopeRow[]): CabinetActions => ({
  startCheck: async () => push("/cabinet/checks/demo?fixture=search"),
  retryCheck: async () => push("/cabinet/checks/demo?fixture=search"),
  searchMore: noop,
  deleteMaterial: noop,
  repeatSearch: noop,
  removeFromNarrative: noop,
  deleteClaim: noop,
  answerClarification: async () => push("/cabinet/checks/demo?fixture=search"),
  chooseClaim: async () => push("/cabinet/checks/demo?fixture=search"),
  createWatch: async () => push("/cabinet/checks/demo?fixture=alert-on-tree"),
  watchClaims: noop,
  setWatchStatus: noop,
  deleteWatch: noop,
  checkWatch: noop,
  readAlert: noop,
  dismissSuggestion: noop,
  createNarrative: noop,
  addToNarrative: noop,
  checkHref: () => "/cabinet/checks/demo?fixture=tree-ready",
  alertHref: () => "/cabinet/checks/demo?fixture=alert-on-tree",
  pickerClaims,
});

export const ActionsContext = createContext<CabinetActions | null>(null);

export function useCabinetActions(): CabinetActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("useCabinetActions: нет ActionsContext");
  return actions;
}
