"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { markNotificationsRead } from "@/actions/profile";
import { formatRelative } from "@/lib/utils";

export function NotificationBell({
  items,
}: {
  items: { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: Date }[];
}) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="relative">
      <button
        className="relative rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={async () => {
          setOpen((v) => !v);
          if (!open && unread) await markNotificationsRead();
        }}
      >
        <Bell className="h-5 w-5" />
        {unread ? (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-black/10 bg-[var(--bg-elev)] shadow-pop dark:border-white/10">
          <div className="border-b border-black/5 px-3 py-2 text-sm font-semibold dark:border-white/10">
            Уведомления
          </div>
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">Пока тихо — можно заниматься.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href ?? "/"}
                  className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-[var(--muted)]">{n.body}</div>
                  <div className="text-xs text-[var(--muted)]">{formatRelative(n.createdAt)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
