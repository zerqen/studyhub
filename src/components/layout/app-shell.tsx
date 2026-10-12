"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  Home,
  Menu,
  NotebookPen,
  Settings,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn, initials } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { SearchBox } from "./search-box";
import { NotificationBell } from "./notification-bell";

const nav = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/subjects", label: "Предметы", icon: BookOpen },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/notes", label: "Заметки", icon: NotebookPen },
  { href: "/files", label: "Файлы", icon: FolderOpen },
];

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: { name: string; email: string; avatarPath: string | null };
  notifications: { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: Date }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const avatar = user.avatarPath ? `/api/files/${user.avatarPath}` : null;

  const side = (
    <aside className="flex h-full w-64 flex-col border-r border-black/5 bg-[var(--bg-elev)]/80 p-4 dark:border-white/10">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-accent text-lg text-white shadow-sm">S</span>
        <div>
          <div className="font-semibold leading-tight">StudyHub</div>
          <div className="text-xs text-[var(--muted)]">Подготовка к сессии</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-1.5">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-accent/10 text-ink-700 dark:bg-accent/15 dark:text-ink-200"
                  : "text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-black/5 pt-3 dark:border-white/10">
        <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
          <User className="h-4 w-4" /> Профиль
        </Link>
        <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
          <Settings className="h-4 w-4" /> Настройки
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen lg:flex">
      <div className="hidden lg:block">{side}</div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full w-72">{side}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/5 bg-[var(--bg)]/80 px-4 py-3 backdrop-blur dark:border-white/10">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <SearchBox />
          <ThemeToggle />
          <NotificationBell items={notifications} />
          <Link href="/profile" className="flex items-center gap-2 rounded-full">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-800 text-xs text-white">
                {initials(user.name)}
              </span>
            )}
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
