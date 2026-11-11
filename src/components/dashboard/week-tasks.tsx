"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleTaskDone } from "@/actions/tasks";
import { taskKind } from "@/lib/task-kinds";
import { cn } from "@/lib/utils";
import { useToast } from "../ui/toast";
import { Checkbox } from "../tasks/checkbox";
import { FocusButton } from "./focus";

export type WeekRow = {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  steps: { done: number; total: number } | null;
};

export type WeekGroup = { key: string; label: string; date: string; urgent: boolean; items: WeekRow[] };

/** Задачи на неделю по дням: отметка «сделано», выбор для фокуса, «показать ещё» */
export function WeekTasks({ groups, limit }: { groups: WeekGroup[]; limit: number }) {
  const [more, setMore] = useState(false);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const toast = useToast();
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  let left = more ? Infinity : limit;
  const shown = groups
    .map((g) => {
      const items = g.items.slice(0, Math.max(0, left));
      left -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length);

  async function toggle(id: string) {
    const on = done.has(id);
    setDone((d) => {
      const next = new Set(d);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
    const r = await toggleTaskDone(id);
    if (!r.ok) {
      toast.push(r.error, "err");
      setDone((d) => {
        const next = new Set(d);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  }

  return (
    <>
      {shown.map((g) => (
        <div key={g.key}>
          <div className="flex items-baseline gap-2 border-t border-line bg-[#F8F6F1] px-4 py-2 dark:bg-subtle sm:px-5">
            <h3 className={cn("heading text-[15px]", g.urgent && "text-urgent")}>{g.label}</h3>
            {g.date ? <span className="text-xs text-muted">{g.date}</span> : null}
          </div>
          <ul>
            {g.items.map((k) => {
              const isDone = done.has(k.id);
              const kind = k.kind === "TASK" ? null : taskKind(k.kind).label;
              return (
                <li
                  key={k.id}
                  className="grid min-h-12 grid-cols-[22px_minmax(0,1fr)_auto_32px] items-center gap-x-3 border-t border-[#ECE8DF] px-4 py-1.5 text-sm dark:border-line sm:grid-cols-[22px_minmax(0,1.4fr)_minmax(0,1fr)_76px_32px] sm:px-5"
                >
                  <Checkbox checked={isDone} onChange={() => toggle(k.id)} label={isDone ? `Вернуть: ${k.title}` : `Выполнено: ${k.title}`} />
                  <span className="min-w-0">
                    <Link href={`/tasks/${k.id}`} className={cn("block truncate font-medium transition-colors hover:text-accent", isDone && "text-muted line-through")}>
                      {k.title}
                      {k.steps ? <span className="font-normal text-muted"> · {k.steps.done}/{k.steps.total}</span> : null}
                    </Link>
                    {k.subject ? <span className="block truncate text-xs text-muted sm:hidden">{k.subject}</span> : null}
                  </span>
                  <span className="hidden truncate text-muted sm:block">{k.subject ?? ""}</span>
                  <span>
                    {kind ? (
                      <span className={cn("inline-block whitespace-nowrap rounded-md px-[7px] py-0.5 text-xs", g.urgent ? "bg-urgent-soft text-urgent" : "bg-subtle text-fg/75")}>{kind}</span>
                    ) : null}
                  </span>
                  <FocusButton id={k.id} title={k.subject ? `${k.title} · ${k.subject}` : k.title} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
        {total > limit ? (
          <button type="button" onClick={() => setMore((m) => !m)} className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-subtle">
            {more ? "Свернуть" : `Показать ещё ${total - limit}`}
          </button>
        ) : null}
        <Link href="/tasks" className="ml-auto text-[13px] text-accent hover:underline">
          Все задачи →
        </Link>
      </div>
    </>
  );
}
