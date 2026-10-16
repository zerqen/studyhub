"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { markNotificationsRead } from "@/actions/profile";
import { formatRelative } from "@/lib/utils";
import { Button } from "../ui/button";

export function NotificationBell({
  items,
}: {
  items: { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: Date }[];
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = seen ? 0 : items.filter((i) => !i.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Уведомления"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread) {
            setSeen(true); // сразу гасим точку, запрос уходит в фоне
            void markNotificationsRead();
          }
        }}
        className="relative"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-bg" /> : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(90vw,22rem)] animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Уведомления</div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Пока тихо — можно заниматься.</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.href ?? "/"} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-subtle" onClick={() => setOpen(false)}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {!n.read && !seen ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    {n.title}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">{n.body}</div>
                  <div className="mt-1 text-xs text-muted/80">{formatRelative(n.createdAt)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
