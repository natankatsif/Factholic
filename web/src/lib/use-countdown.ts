"use client";

/** Примерный обратный отсчёт: сколько ещё ждать. Настоящего времени бэкенд не сообщает, это оценка */
import { useEffect, useState } from "react";

/** Когда начался отсчёт. Вне компонента: лента и плеер показывают одно и то же время и оно не сбрасывается при перерисовке */
const startedAt = new Map<string, number>();

/** Секунд осталось; 0 — время вышло, а дело ещё идёт */
export function useCountdown(key: string, totalSec: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!startedAt.has(key)) startedAt.set(key, now);
  const passed = Math.floor((now - startedAt.get(key)!) / 1000);
  return Math.max(0, totalSec - passed);
}

/** 75 → «1:15» */
export function formatCountdown(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
