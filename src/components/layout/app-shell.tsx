"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Cpu, FileText, Folder, GraduationCap, Home, Menu, MonitorPlay, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, Sparkles, SquareCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn, initials } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { SearchBox } from "./search-box";
import { NotificationBell } from "./notification-bell";
import { Hotkeys } from "./hotkeys";

// Чат с его Markdown и формулами нужен не на каждой странице: подгружается отдельно, после открытия сайта
const Assistant = dynamic(() => import("../assistant/assistant").then((m) => m.Assistant), { ssr: false });

type Badge = "review" | "tasks";

const nav: { href: string; label: string; icon: typeof Home; badge?: Badge }[] = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/review", label: "Повторение", icon: RefreshCw, badge: "review" },
  { href: "/subjects", label: "Предметы", icon: BookOpen },
  { href: "/tasks", label: "Задачи", icon: SquareCheck, badge: "tasks" },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/notes", label: "Заметки", icon: FileText },
  { href: "/files", label: "Файлы", icon: Folder },
  { href: "/learn", label: "Изучаю", icon: GraduationCap },
  { href: "/embedded", label: "Embedded", icon: Cpu },
  { href: "/interactives", label: "Интерактивы", icon: MonitorPlay },
];

const NAV_KEY = "studyhub:nav-collapsed";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/subjects") return pathname.startsWith("/subjects") || pathname.startsWith("/questions") || pathname.startsWith("/lectures") || pathname.startsWith("/exams");
  return pathname.startsWith(href);
}

export function openAssistant() {
  window.dispatchEvent(new Event("assistant-open"));
}

export function AppShell({
  user,
  notifications,
  subjects,
  counts,
  children,
}: {
  user: { name: string; email: string; avatarPath: string | null };
  subjects: { id: string; name: string }[];
  notifications: { id: string; title: string; body: string; href: string | null; read: boolean; kind?: string; createdAt: Date }[];
  counts: Record<Badge, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const avatar = user.avatarPath ? `/api/files/${user.avatarPath}` : null;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_KEY) === "1");
    } catch {
      // без хранилища меню просто остаётся развёрнутым
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(NAV_KEY, c ? "0" : "1");
      } catch {
        // не критично
      }
      return !c;
    });
  }

  const sidebar = (mini: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col gap-3 px-2.5 py-4">
      <div className={cn("flex items-center gap-2 px-1", mini ? "justify-center" : "justify-between")}>
        {mini ? null : (
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent text-[15px] font-bold text-accent-fg">S</span>
            <span className="heading truncate text-lg">StudyHub</span>
          </Link>
        )}
        {mobile ? null : (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={mini ? "Развернуть меню" : "Свернуть меню"}
            title={mini ? "Развернуть меню" : "Свернуть меню"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:text-fg"
          >
            {mini ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-none" aria-label="Основное меню">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={mini ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                mini && "justify-center px-0",
                active ? "bg-accent-soft font-semibold text-accent" : "text-fg hover:bg-subtle",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              {mini ? (
                badge ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-label={`${badge}`} /> : null
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {badge ? <span className="text-xs font-semibold tabular-nums text-accent">{badge}</span> : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1">
        <button
          type="button"
          onClick={openAssistant}
          title="Ассистент (Ctrl+J)"
          aria-label="Ассистент"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-fg px-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-[18px] w-[18px] shrink-0" />
          {mini ? null : "Ассистент"}
        </button>
        <Link
          href="/settings"
          title={mini ? "Настройки" : undefined}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
            mini && "justify-center px-0",
            pathname.startsWith("/settings") ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-subtle hover:text-fg",
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          {mini ? null : "Настройки"}
        </Link>
        <Link href="/settings#profile" title={mini ? user.name : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-subtle", mini && "justify-center px-0")}>
          <Avatar src={avatar} name={user.name} />
          {mini ? null : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.email}</span>
            </span>
          )}
        </Link>
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-dvh transition-[padding] duration-200 print:pl-0", collapsed ? "lg:pl-16" : "lg:pl-[220px]")}>
      <aside className={cn("no-print fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface transition-[width] duration-200 lg:block", collapsed ? "w-16" : "w-[220px]")}>
        {sidebar(collapsed, false)}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setOpen(false)} aria-label="Закрыть меню" />
          <aside className="relative h-full w-72 animate-slide-in-left border-r border-line bg-surface">
            <button className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-muted hover:bg-subtle" onClick={() => setOpen(false)} aria-label="Закрыть">
              <X className="h-4 w-4" />
            </button>
            {sidebar(false, true)}
          </aside>
        </div>
      ) : null}

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 bg-bg px-4 sm:px-6 lg:px-10">
        <button className="-ml-1.5 rounded-lg p-1.5 text-muted hover:bg-subtle lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
          <Menu className="h-5 w-5" />
        </button>
        <SearchBox />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell items={notifications} />
          <Link href="/settings#profile" className="ml-1 lg:hidden" aria-label="Профиль">
            <Avatar src={avatar} name={user.name} />
          </Link>
        </div>
      </header>

      <Hotkeys subjects={subjects} />
      <Assistant storageKey={user.email} />
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-6">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Быстрое меню">
        {nav.slice(0, 5).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-accent" : "text-muted")}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {badge ? <span className="absolute left-1/2 top-1.5 ml-2 h-1.5 w-1.5 rounded-full bg-accent" /> : null}
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
