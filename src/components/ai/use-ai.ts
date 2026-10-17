"use client";

import { useEffect, useState } from "react";
import { getAiStatus } from "@/actions/ai";

let status: Promise<boolean> | null = null;

/** Включён ли ИИ на сервере (есть ли GROQ_API_KEY). Один запрос на всю сессию вкладки. */
export function useAiEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    status ??= getAiStatus()
      .then((s) => s.enabled)
      .catch(() => false);
    let alive = true;
    void status.then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Waitable<T> = { ok: true; data?: { wait?: number; value?: T } } | { ok: false; error: string };

/**
 * Вызывает ИИ-действие; если бесплатный лимит Groq временно исчерпан — ждёт и повторяет.
 * onWait(секунды) — показать пользователю обратный отсчёт.
 */
export async function callWithWait<T>(call: () => Promise<Waitable<T>>, onWait?: (seconds: number) => void, tries = 6): Promise<T> {
  for (let i = 0; i < tries; i++) {
    const r = await call();
    if (!r.ok) throw new Error(r.error);
    if (r.data?.wait) {
      const wait = Math.min(90, r.data.wait + 1);
      for (let s = wait; s > 0; s--) {
        onWait?.(s);
        await sleep(1000);
      }
      onWait?.(0);
      continue;
    }
    return r.data?.value as T;
  }
  throw new Error("Лимит Groq не освобождается — попробуй через несколько минут");
}
