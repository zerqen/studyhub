"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

export type NoteRow = {
  id: string;
  title: string;
  snippet: string;
  /** Весь текст в нижнем регистре — для поиска */
  haystack: string;
  color: string;
  pinned: boolean;
  updatedAt: string;
  subject: { id: string; name: string } | null;
};

/** Шапка с поиском + список заметок слева + редактор (children) справа. */
export function NotesShell({ notes, selectedId, creating = false, children }: { notes: NoteRow[]; selectedId?: string; creating?: boolean; children: ReactNode }) {
  // На телефоне — либо список, либо редактор
  const editing = Boolean(selectedId) || creating;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | string>("all");

  const subjects = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notes) if (n.subject) m.set(n.subject.id, n.subject.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [notes]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return notes.filter(
      (n) =>
        (filter === "all" || (filter === "pinned" ? n.pinned : filter === "none" ? !n.subject : n.subject?.id === filter)) &&
        words.every((w) => n.haystack.includes(w)),
    );
  }, [notes, q, filter]);

  const subjectFilter = filter !== "all" && filter !== "pinned";
  const chip = (on: boolean) =>
    cn(
      "h-[30px] rounded-full border px-2.5 text-xs transition-colors",
      on ? "border-accent bg-accent-soft font-semibold text-[#234AB0] dark:text-accent" : "border-line bg-surface text-fg hover:border-fg/30",
    );

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="mr-2 flex flex-col gap-0.5">
          <h1 className="heading text-[28px] sm:text-[32px]">Заметки</h1>
          <p className="text-[13px] text-muted">{notes.length ? `${notes.length} ${plural(notes.length)} · конспекты, формулы, шпаргалки` : "Конспекты, формулы, шпаргалки"}</p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по заметкам"
          aria-label="Поиск по заметкам"
          className={cn(
            "h-10 min-w-0 flex-[1_1_240px] rounded-[10px] border border-line bg-surface px-3 text-sm outline-none transition-shadow placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20",
            editing && "max-lg:hidden",
          )}
        />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <aside
          aria-label="Список заметок"
          className={cn(
            "flex w-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:w-[300px] lg:shrink-0",
            editing && "max-lg:hidden",
          )}
        >
          <div className="p-3">
            <Link
              href="/notes?new=1"
              className={cn(
                "flex h-[42px] w-full items-center justify-center rounded-[10px] border-[1.5px] border-dashed text-sm font-semibold transition-colors",
                selectedId ? "border-[#9DB4EE] bg-[#F4F7FE] text-[#234AB0] hover:border-accent dark:border-accent/40 dark:bg-accent/5 dark:text-accent" : "border-accent bg-accent-soft text-[#234AB0] dark:text-accent",
              )}
            >
              + Новая заметка
            </Link>
          </div>
          <div role="group" aria-label="Фильтр" className="flex flex-wrap gap-1.5 px-3 pb-3">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>
              Все
            </button>
            <button type="button" aria-pressed={filter === "pinned"} onClick={() => setFilter(filter === "pinned" ? "all" : "pinned")} className={chip(filter === "pinned")}>
              Закреплённые
            </button>
            {subjects.length ? (
              <label className="relative">
                <span className="sr-only">По предметам</span>
                <select
                  value={subjectFilter ? filter : ""}
                  onChange={(e) => setFilter(e.target.value || "all")}
                  className={cn(chip(subjectFilter), "max-w-[11rem] cursor-pointer appearance-none truncate pr-6")}
                >
                  <option value="">По предметам</option>
                  {subjects.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                  <option value="none">Без предмета</option>
                </select>
                <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                  ▾
                </span>
              </label>
            ) : null}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto border-t border-[#ECE8DF] dark:border-line">
            {shown.map((n) => {
              const on = n.id === selectedId;
              return (
                <li key={n.id} className="border-b border-[#ECE8DF] last:border-b-0 dark:border-line">
                  <Link
                    href={`/notes?open=${n.id}`}
                    aria-current={on ? "page" : undefined}
                    className={cn("flex gap-2.5 px-3.5 py-3 transition-colors", on ? "bg-[#F4F7FE] dark:bg-accent/10" : "hover:bg-[#F8F6F1] dark:hover:bg-subtle")}
                    style={{ boxShadow: `inset 3px 0 0 ${n.color}` }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-sm font-semibold">{n.title}</span>
                      <span className="truncate text-xs text-muted">{n.snippet || "пустая заметка"}</span>
                      <span className="truncate text-[11px] text-muted/90">
                        {formatDate(n.updatedAt, "d MMM")}
                        {n.subject ? ` · ${n.subject.name.toLowerCase()}` : ""}
                      </span>
                    </span>
                    {n.pinned ? (
                      <span aria-label="закреплена" className="text-xs text-accent">
                        ●
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[13px] text-muted">{notes.length ? "Ничего не нашлось" : "Заметок пока нет"}</p>
          ) : null}
          <p className="mt-auto border-t border-[#ECE8DF] px-3.5 py-3.5 text-xs leading-normal text-muted dark:border-line">
            Заметки, привязанные к предмету, появятся и на его вкладке «Материалы».
          </p>
        </aside>

        <section className={cn("min-w-0 flex-[3_1_560px]", !editing && "max-lg:hidden")}>
          {editing ? (
            <Link href="/notes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg lg:hidden">
              <ChevronLeft className="h-4 w-4" /> Все заметки
            </Link>
          ) : null}
          {children}
        </section>
      </div>
    </div>
  );
}

function plural(n: number) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return "заметка";
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "заметки";
  return "заметок";
}
