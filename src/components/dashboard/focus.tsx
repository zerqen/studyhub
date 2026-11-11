"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { openAssistant } from "../layout/app-shell";

type Focus = { id: string; title: string } | null;
type FocusCtx = { focus: Focus; setFocus: (f: Focus) => void };

const Ctx = createContext<FocusCtx>({ focus: null, setFocus: () => undefined });

const KEY = "studyhub:focus";
const PRESETS = [25, 50, 90];

type Saved = { focus: Focus; minutes: number; endAt: number | null; left: number };

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // таймер работает и без хранилища, просто не переживёт перезагрузку
  }
}

/** Что сейчас «в фокусе»: задачу выбирают кнопкой ▶ в списке, таймер — в панели снизу */
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = useState<Focus>(null);
  useEffect(() => {
    const saved = load();
    if (saved?.focus) setFocus(saved.focus);
  }, []);
  const value = useMemo(() => ({ focus, setFocus }), [focus]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFocus() {
  return useContext(Ctx);
}

/** Кнопка ▶ у задачи: выбрать её для фокуса */
export function FocusButton({ id, title }: { id: string; title: string }) {
  const { focus, setFocus } = useFocus();
  const on = focus?.id === id;
  return (
    <button
      type="button"
      onClick={() => setFocus(on ? null : { id, title })}
      aria-pressed={on}
      aria-label={on ? `Убрать из фокуса: ${title}` : `В фокус: ${title}`}
      title={on ? "Убрать из фокуса" : "В фокус"}
      className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border text-accent transition-colors", on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/50")}
    >
      <Play className="h-3 w-3 translate-x-px" fill={on ? "currentColor" : "none"} />
    </button>
  );
}

const two = (n: number) => String(n).padStart(2, "0");
function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(sec % 60)}` : `${two(m)}:${two(sec % 60)}`;
}

/** Панель фокуса внизу главной: таймер 25 / 50 / 90 или своё время. Переживает перезагрузку страницы. */
export function FocusBar() {
  const { focus, setFocus } = useFocus();
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState("");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(25 * 60);
  const ready = useRef(false);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setMinutes(saved.minutes);
      if (!PRESETS.includes(saved.minutes)) setCustom(String(saved.minutes));
      if (saved.endAt && saved.endAt > Date.now()) {
        setEndAt(saved.endAt);
        setLeft(Math.round((saved.endAt - Date.now()) / 1000));
      } else {
        setLeft(saved.endAt ? saved.minutes * 60 : saved.left);
      }
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (ready.current) save({ focus, minutes, endAt, left });
  }, [focus, minutes, endAt, left]);

  const finish = useCallback(() => {
    setEndAt(null);
    setLeft(minutes * 60);
    try {
      navigator.vibrate?.(300);
      if ("Notification" in window && Notification.permission === "granted") new Notification("Фокус закончен", { body: focus ? focus.title : "Можно отдохнуть 5 минут" });
    } catch {
      // уведомления необязательны
    }
  }, [focus, minutes]);

  useEffect(() => {
    if (!endAt) return;
    const id = window.setInterval(() => {
      const rest = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) finish();
    }, 500);
    return () => window.clearInterval(id);
  }, [endAt, finish]);

  const running = endAt !== null;
  const fresh = !running && left === minutes * 60;

  function pick(m: number) {
    setMinutes(m);
    if (!running) setLeft(m * 60);
  }

  function start() {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    setEndAt(Date.now() + left * 1000);
  }

  function pause() {
    if (endAt) setLeft(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
    setEndAt(null);
  }

  function reset() {
    setEndAt(null);
    setLeft(minutes * 60);
  }

  return (
    <section
      aria-label="Фокус"
      className="no-print sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl bg-[#1D2130] px-4 py-3 text-[#FFFEFB] shadow-pop sm:pl-5 lg:bottom-4"
    >
      <span role="timer" aria-live="off" className="text-[28px] font-bold tabular-nums tracking-tight sm:text-[30px]">
        {clock(left)}
      </span>
      <div className="min-w-0 flex-[1_1_160px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#B9BCC8]">{running ? "Идёт фокус" : "В фокусе"}</div>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{focus ? focus.title : "Свободный фокус — выбери задачу кнопкой ▶"}</span>
          {focus ? (
            <button type="button" onClick={() => setFocus(null)} className="shrink-0 text-xs text-[#B9BCC8] underline-offset-2 hover:underline">
              убрать
            </button>
          ) : null}
        </div>
      </div>
      <div role="group" aria-label="Длина фокуса" className="flex items-center gap-1 rounded-[10px] bg-[#2C3142] p-[3px]">
        {PRESETS.map((m) => {
          const on = !custom && minutes === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              disabled={running}
              onClick={() => {
                setCustom("");
                pick(m);
              }}
              className={cn("h-[34px] rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed", on ? "bg-[#FFFEFB] text-[#1D2130]" : "text-[#D5D3CC] hover:text-white")}
            >
              {m}
            </button>
          );
        })}
        <label className={cn("flex h-[34px] items-center gap-1 rounded-lg px-2 text-[13px] text-[#D5D3CC]", custom && "bg-[#3A3F52]")}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={240}
            value={custom}
            disabled={running}
            placeholder="своё"
            aria-label="Своя длительность в минутах"
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Math.round(Number(e.target.value));
              if (n >= 1 && n <= 240) pick(n);
              else if (!e.target.value) pick(25);
            }}
            className="w-11 border-0 bg-transparent text-[13px] font-semibold text-[#FFFEFB] outline-none placeholder:text-[#8F93A3] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          мин
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={running ? pause : start}
          className="inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-[#FFFEFB] px-5 text-sm font-bold text-[#1D2130] transition-opacity hover:opacity-90"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Пауза" : fresh ? "Старт" : "Дальше"}
        </button>
        {!fresh ? (
          <button type="button" onClick={reset} aria-label="Сбросить таймер" title="Сбросить" className="grid h-[42px] w-[42px] place-items-center rounded-[10px] border border-[#3A3F52] text-[#FFFEFB] hover:bg-white/5">
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={openAssistant}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] border border-[#3A3F52] px-3 text-sm font-semibold text-[#FFFEFB] hover:bg-white/5"
          title="Ассистент (Ctrl+J)"
        >
          <Sparkles className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Ассистент</span>
          <span className="sr-only sm:hidden">Ассистент</span>
        </button>
      </div>
    </section>
  );
}
