"use client";

import { AlarmClock, Bell, BookOpen, SquareCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { markNotificationRead, markNotificationsRead } from "@/actions/profile";
import { buildFeed, type Note } from "@/lib/notify-view";
import { cn, formatRelative } from "@/lib/utils";
import { Button } from "../ui/button";

/** Колокольчик: лента «Сегодня / Просрочено / Раньше». Открытие ленты ничего не помечает — только кнопки. */
export function NotificationBell({ items }: { items: Note[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  const notes = useMemo(() => items.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n)), [items, readIds]);
  const unread = notes.filter((n) => !n.read).length;
  const groups = useMemo(() => buildFeed(notes, new Date(), tab === "unread"), [notes, tab]);
  const unreadItems = useMemo(() => buildFeed(notes, new Date(), true).reduce((k, g) => k + g.items.length, 0), [notes]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function markRead(ids: string[]) {
    setReadIds((s) => new Set([...s, ...ids]));
    void markNotificationRead(ids);
  }

  function readAll() {
    setReadIds(new Set(items.map((n) => n.id)));
    void markNotificationsRead();
  }

  return (
    <div className="relative" ref={box}>
      <Button variant="ghost" size="icon" aria-label={unread ? `Уведомления: ${unread} новых` : "Уведомления"} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="relative">
        <Bell className="h-[18px] w-[18px]" />
        {unread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" /> : null}
      </Button>
      {open ? (
        <section
          aria-label="Уведомления"
          className="absolute right-0 z-40 mt-2 flex w-[min(calc(100vw-2rem),408px)] animate-pop-in flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_12px_32px_rgba(29,33,48,0.12)]"
        >
          <div className="flex items-center justify-between gap-2.5 px-[18px] pb-2.5 pt-4">
            <h2 className="heading text-xl">Уведомления</h2>
            {unread ? (
              <button type="button" onClick={readAll} className="min-h-8 px-1 text-[13px] font-medium text-accent hover:underline">
                Прочитать все
              </button>
            ) : null}
          </div>
          <div role="tablist" className="flex gap-1 border-b border-[#ECE8DF] px-3.5 pb-2.5 dark:border-line">
            {(
              [
                ["all", "Все"],
                ["unread", `Непрочитанные${unreadItems ? ` · ${unreadItems}` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors", tab === id ? "bg-fg text-bg" : "text-fg/75 hover:bg-subtle")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(540px,65vh)] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="px-[18px] py-10 text-center text-sm text-muted">{tab === "unread" ? "Всё прочитано" : "Пока тихо — можно заниматься."}</p>
            ) : (
              groups.map((g) => (
                <div key={g.id}>
                  <h3 className={cn("px-[18px] pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em]", g.id === "late" ? "text-urgent" : "text-fg/75")}>{g.title}</h3>
                  <ul>
                    {g.items.map((n) => {
                      const Icon = n.late ? AlarmClock : n.kind === "exam" ? BookOpen : SquareCheck;
                      return (
                        <li key={n.ids[0]} className={cn("flex gap-3 border-t border-[#ECE8DF] px-[18px] py-3 dark:border-line", !n.read && "bg-[#F7F9FE] dark:bg-accent/5")}>
                          <span className={cn("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]", n.late ? "bg-urgent-soft text-urgent" : "bg-accent-soft text-accent")}>
                            <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[13px] text-muted">{n.label}</span>
                              <span className="shrink-0 whitespace-nowrap text-xs text-muted">{formatRelative(n.createdAt)}</span>
                            </div>
                            <Link href={n.href ?? "/"} onClick={() => setOpen(false)} className={cn("text-sm leading-snug hover:text-accent", n.read ? "font-normal" : "font-semibold")}>
                              {n.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Link
                                href={n.href ?? "/"}
                                onClick={() => {
                                  if (!n.read) markRead(n.ids);
                                  setOpen(false);
                                }}
                                className="inline-flex h-7 items-center rounded-lg bg-accent-soft px-2.5 text-xs font-semibold text-accent"
                              >
                                Открыть
                              </Link>
                              {!n.read ? (
                                <button type="button" onClick={() => markRead(n.ids)} className="h-7 rounded-lg border border-line bg-surface px-2.5 text-xs text-fg/75 hover:text-fg">
                                  Прочитано
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {!n.read ? <span aria-label="Не прочитано" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <Link href="/settings#notify" onClick={() => setOpen(false)} className="flex min-h-[46px] items-center justify-center border-t border-[#ECE8DF] bg-[#F8F6F1] text-[13px] font-medium text-accent dark:border-line dark:bg-subtle">
            Настроить уведомления →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
