"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, CalendarDays, CheckSquare, FolderOpen, Home, Menu, NotebookPen, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { SearchBox } from "./search-box";
import { NotificationBell } from "./notification-bell";
import { Hotkeys } from "./hotkeys";
import { Assistant } from "../assistant/assistant";

const nav = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/review", label: "Повторение", icon: Brain },
  { href: "/subjects", label: "Предметы", icon: BookOpen },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/notes", label: "Заметки", icon: NotebookPen },
  { href: "/files", label: "Файлы", icon: FolderOpen },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/subjects") return pathname.startsWith("/subjects") || pathname.startsWith("/questions") || pathname.startsWith("/lectures") || pathname.startsWith("/exams");
  return pathname.startsWith(href);
}

export function AppShell({
  user,
  notifications,
  subjects,
  children,
}: {
  user: { name: string; email: string; avatarPath: string | null };
  subjects: { id: string; name: string }[];
  notifications: { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: Date }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const avatar = user.avatarPath ? `/api/files/${user.avatarPath}` : null;

  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-1.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">S</span>
        <span className="font-semibold tracking-tight">StudyHub</span>
      </Link>
      <nav className="flex-1 space-y-0.5">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
                active ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/60 hover:text-fg",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-accent")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-0.5 border-t border-line pt-2">
        <Link
          href="/settings"
          className={cn(
            "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/settings") ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/60 hover:text-fg",
          )}
        >
          <Settings className="h-4 w-4" /> Настройки
        </Link>
        <Link href="/profile" className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-subtle/60">
          <Avatar src={avatar} name={user.name} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-60 print:pl-0">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setOpen(false)} aria-label="Закрыть меню" />
          <aside className="relative h-full w-72 animate-slide-in-left border-r border-line bg-surface">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-subtle" onClick={() => setOpen(false)} aria-label="Закрыть">
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg px-4 sm:px-6">
        <button className="-ml-1.5 rounded-lg p-1.5 text-muted hover:bg-subtle lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
          <Menu className="h-5 w-5" />
        </button>
        <SearchBox />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell items={notifications} />
          <Link href="/profile" className="ml-1 lg:hidden" aria-label="Профиль">
            <Avatar src={avatar} name={user.name} />
          </Link>
        </div>
      </header>

      <Hotkeys subjects={subjects} />
      <Assistant storageKey={user.email} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-accent" : "text-muted")}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{initials(name)}</span>
  );
}
