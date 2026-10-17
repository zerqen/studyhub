"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUS = 25 * 60;
const BREAK = 5 * 60;

/** Таймер помодоро: 25 минут работы / 5 минут отдыха. Состояние живёт в браузере. */
export function Pomodoro() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const rest = Math.max(0, Math.round(((endAt.current ?? 0) - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        const next = phase === "focus" ? "break" : "focus";
        setPhase(next);
        setLeft(next === "focus" ? FOCUS : BREAK);
        setRunning(false);
        try {
          navigator.vibrate?.(300);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(next === "break" ? "Перерыв 5 минут" : "Снова за работу");
          }
        } catch {
          // уведомления необязательны
        }
      }
    }, 500);
    return () => clearInterval(t);
    // left намеренно не в зависимостях: таймер считает от сохранённого endAt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-medium tabular-nums transition-colors",
          running ? (phase === "focus" ? "border-accent/40 bg-accent/10 text-accent" : "border-success/40 bg-success/10 text-success") : "border-line text-muted hover:text-fg",
        )}
        aria-label="Таймер помодоро"
      >
        <Timer className="h-3.5 w-3.5" />
        {running || left !== FOCUS ? `${mm}:${ss}` : "25:00"}
      </button>
      {open ? (
        <>
          <button className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} aria-hidden tabIndex={-1} />
          <div className="absolute right-0 z-40 mt-1 w-56 animate-pop-in rounded-2xl border border-line bg-surface p-4 shadow-pop">
            <div className="label-xs">{phase === "focus" ? "Фокус" : "Перерыв"}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {mm}:{ss}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  if (!running && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
                  setRunning((r) => !r);
                }}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-[13px] font-medium text-accent-fg"
              >
                {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {running ? "Пауза" : "Старт"}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setPhase("focus");
                  setLeft(FOCUS);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-fg"
                aria-label="Сбросить"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">25 минут занятий, 5 минут отдыха.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
