"use client";

/**
 * Отчёт пишется на языке запуска проверки. Здесь его подписи и даты показываются на текущем языке:
 * таблицу даёт бэкенд, текст модели и цитаты не меняются.
 */
import { useEffect, useMemo, useState } from "react";
import { LOCALE_TAGS, type Locale } from "../i18n/locale";
import { BACKEND_URL, DATA_SOURCE } from "./jobs";

interface Labels {
  exact: Record<string, string>;
  patterns: Array<{ from: string; to: string }>;
}

/** Такие же метки значений, как в backend/src/pipeline/report-labels.ts */
const SLOT = /[-]/g;

interface Rule {
  regex: RegExp;
  slots: string[];
  to: string;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile({ from, to }: Labels["patterns"][number]): Rule {
  const slots = from.match(SLOT) ?? [];
  const source = from.split(SLOT).map(escapeRegex).join("(.+?)");
  return { regex: new RegExp(`^${source}$`, "s"), slots, to };
}

function translate(text: string, labels: Labels, rules: Rule[]): string {
  const exact = labels.exact[text];
  if (exact !== undefined) return exact;
  for (const rule of rules) {
    const match = rule.regex.exec(text);
    if (match) return rule.slots.reduce((out, slot, index) => out.replace(slot, match[index + 1]!), rule.to);
  }
  return text;
}

const fullDate = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Только подписи: в других полях те же слова бывают кодами (role: "retelling"), их менять нельзя */
const LABEL_KEYS = new Set([
  "label",
  "categoryLabel",
  "tag",
  "consensusSummary",
  "title",
  "subtitle",
  "detail",
  "date",
]);

function relabel<T>(value: T, labels: Labels, rules: Rule[], locale: Locale): T {
  if (Array.isArray(value)) return value.map((item) => relabel(item, labels, rules, locale)) as T;
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] =
      typeof item === "string"
        ? LABEL_KEYS.has(key)
          ? translate(item, labels, rules)
          : item
        : relabel(item, labels, rules, locale);
  }
  const dated = value as { date?: unknown; isoDate?: unknown };
  if (typeof dated.date === "string" && typeof dated.isoDate === "string") {
    const time = Date.parse(dated.isoDate);
    if (!Number.isNaN(time)) result.date = fullDate(dated.isoDate, locale);
  }
  return result as T;
}

const tables = new Map<Locale, Promise<Labels | null>>();

function loadLabels(locale: Locale): Promise<Labels | null> {
  const known = tables.get(locale);
  if (known) return known;
  const loading = fetch(`${BACKEND_URL}/api/report-labels/${locale}`)
    .then((res) => (res.ok ? (res.json() as Promise<Labels>) : null))
    .catch(() => null);
  tables.set(locale, loading);
  return loading;
}

/** Пока таблица не пришла, показываем отчёт как есть */
export function useLocalizedReport<T>(report: T, locale: Locale): T {
  const [labels, setLabels] = useState<Labels | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "backend") return;
    let current = true;
    void loadLabels(locale).then((table) => {
      if (current) setLabels(table);
    });
    return () => {
      current = false;
    };
  }, [locale]);
  return useMemo(
    () => (report && labels ? relabel(report, labels, labels.patterns.map(compile), locale) : report),
    [report, labels, locale],
  );
}
