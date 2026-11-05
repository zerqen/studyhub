"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const TOTAL = 10 * 60;

/** Обратный отсчёт короткой тренировки. Время никого не прерывает: карточку можно спокойно закончить. */
export function TenMinutesTimer() {
  const [left, setLeft] = useState(TOTAL);

  useEffect(() => {
    const end = Date.now() + TOTAL * 1000;
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const over = left === 0;
  return (
    <span role="timer" className={cn("inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium tabular-nums", over && "text-success")}>
      <Timer className="h-4 w-4" />
      {over ? "Время вышло, можно заканчивать" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
    </span>
  );
}
