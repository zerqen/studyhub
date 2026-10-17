"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { dayKey } from "@/lib/utils";

type Activity = { from: string; days: number; counts: Record<string, number> };

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function level(n: number) {
  if (!n) return 0;
  if (n < 5) return 1;
  if (n < 15) return 2;
  if (n < 30) return 3;
  return 4;
}

const levelClass = ["bg-subtle", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"];

/** Тепловая карта занятий, как на GitHub */
export function ActivityHeatmap({ activity }: { activity: Activity }) {
  // Даты зависят от часового пояса браузера — рисуем после загрузки, чтобы не было расхождения с сервером
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { weeks, streak, total, best, months } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Начинаем с понедельника, чтобы колонки были неделями
    const start = new Date(today);
    start.setDate(start.getDate() - (activity.days - 1));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const cells: { key: string; date: Date; n: number }[] = [];
    for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      cells.push({ key, date: new Date(d), n: activity.counts[key] ?? 0 });
    }
    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Серия: подряд дней с активностью, считая до сегодня (сегодня может быть ещё пустым)
    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].n > 0) streak++;
      else if (i === cells.length - 1) continue;
      else break;
    }
    let best = 0;
    let run = 0;
    for (const c of cells) {
      run = c.n > 0 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const months = weeks.map((w, i) => {
      const m = w[0].date.getMonth();
      return i === 0 || weeks[i - 1][0].date.getMonth() !== m ? MONTHS[m] : "";
    });
    return { weeks, streak, total: cells.reduce((a, c) => a + c.n, 0), best, months };
  }, [activity]);

  if (!mounted) return <section className="card h-[148px]" aria-hidden />;

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold">Активность</h2>
        <span className="inline-flex items-center gap-1 text-sm">
          <Flame className={streak ? "h-4 w-4 text-warning" : "h-4 w-4 text-muted"} />
          <span className="font-semibold tabular-nums">{streak}</span>
          <span className="text-muted">{streak === 1 ? "день подряд" : "дней подряд"}</span>
        </span>
        <span className="text-xs text-muted">рекорд {best} · {total} действий за {Math.round(activity.days / 7)} недель</span>
      </div>
      <div className="scrollbar-none overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] pl-0 text-[10px] text-muted">
            {months.map((m, i) => (
              <span key={i} className="w-[11px] overflow-visible whitespace-nowrap">
                {m}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {w.map((c) => (
                  <span
                    key={c.key}
                    title={`${c.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}: ${c.n || "нет"} действий`}
                    className={`h-[11px] w-[11px] rounded-[3px] ${levelClass[level(c.n)]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
