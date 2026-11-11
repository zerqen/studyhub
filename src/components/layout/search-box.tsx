"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit } from "@/actions/search";
import { subjectShort } from "@/lib/home";
import { cn } from "@/lib/utils";
import { openAssistant } from "./app-shell";

/** Значок задачи по типу: «ДЗ», «ЛБ», «КР»… */
const KIND_BADGE: Record<string, string> = { HOMEWORK: "ДЗ", LAB: "ЛБ", TEST: "КР", DRAWING: "ЧР", TASK: "ЗД" };

const GROUPS: { type: SearchHit["type"]; title: string; badge: string }[] = [
  { type: "subject", title: "Предметы", badge: "" },
  { type: "task", title: "Задачи", badge: "ЗД" },
  { type: "subtask", title: "Подзадачи", badge: "↳" },
  { type: "question", title: "Вопросы", badge: "?" },
  { type: "lecture", title: "Лекции", badge: "Л" },
  { type: "note", title: "Заметки", badge: "¶" },
  { type: "file", title: "Файлы", badge: "Ф" },
  { type: "ticket", title: "Билеты", badge: "Б" },
  { type: "tag", title: "Теги", badge: "#" },
];

type Item = { key: string; badge: string; label: string; meta?: string; iconBg: string; iconFg: string; run: () => void; words: string };

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await globalSearch(q);
      if (id !== reqId.current) return; // пришёл устаревший ответ
      setHits(res.ok ? (res.data ?? []) : []);
      setActive(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Действия и страницы ищутся сразу, без сервера
  const local = useMemo(() => {
    const go = (href: string) => () => {
      router.push(href);
      close();
    };
    const soft = { iconBg: "bg-accent-soft", iconFg: "text-accent" };
    const plain = { iconBg: "bg-subtle", iconFg: "text-fg/75" };
    const actions: Item[] = [
      { key: "a-task", badge: "+", label: "Новая задача", ...soft, words: "создать добавить задачу дз", run: () => { close(); window.dispatchEvent(new Event("task-create-open")); } },
      { key: "a-subj", badge: "+", label: "Новый предмет", ...soft, words: "создать добавить предмет", run: go("/subjects?new=1") },
      { key: "a-event", badge: "+", label: "Новое событие в календаре", ...soft, words: "создать добавить событие пара календарь", run: go("/calendar") },
      { key: "a-ai", badge: "✦", label: "Спросить ассистента", iconBg: "bg-fg", iconFg: "text-bg", words: "ии чат ассистент спросить", run: () => { close(); openAssistant(); } },
    ];
    const pages: Item[] = (
      [
        ["Главная", "/"],
        ["Повторение", "/review"],
        ["Предметы", "/subjects"],
        ["Задачи", "/tasks"],
        ["Календарь", "/calendar"],
        ["Заметки", "/notes"],
        ["Файлы", "/files"],
        ["Изучаю", "/learn"],
        ["Embedded", "/embedded"],
        ["Интерактивы", "/interactives"],
        ["Настройки", "/settings"],
      ] as const
    ).map(([label, href]) => ({ key: `p-${href}`, badge: "→", label, meta: "страница", ...plain, words: label.toLowerCase(), run: go(href) }));
    return { actions, pages };
  }, [router, close]);

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return [
        { title: "Действия", items: local.actions },
        { title: "Страницы", items: local.pages },
      ];
    }
    const out: { title: string; items: Item[] }[] = [];
    for (const g of GROUPS) {
      const items = hits
        .filter((h) => h.type === g.type)
        .map<Item>((h) => ({
          key: `${h.type}-${h.id}`,
          badge: h.type === "subject" ? subjectShort(h.title) : h.type === "task" ? (KIND_BADGE[h.kind ?? "TASK"] ?? "ЗД") : g.badge,
          label: h.title,
          meta: h.hint,
          iconBg: h.type === "task" && h.kind === "TEST" ? "bg-urgent-soft" : "bg-subtle",
          iconFg: h.type === "task" && h.kind === "TEST" ? "text-urgent" : "text-fg/75",
          ...(h.type === "subject" && h.color ? { color: h.color } : {}),
          words: h.title.toLowerCase(),
          run: () => {
            router.push(h.href);
            close();
          },
        }));
      if (items.length) out.push({ title: g.title, items });
    }
    const match = (it: Item) => it.words.includes(query) || it.label.toLowerCase().includes(query);
    const acts = [...local.actions, ...local.pages].filter(match);
    if (acts.length) out.push({ title: "Действия и страницы", items: acts });
    return out;
  }, [q, hits, local, router, close]);

  const flat = groups.flatMap((g) => g.items);
  const none = q.trim() && !loading && flat.length === 0;

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted transition-colors hover:border-fg/20"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Поиск</span>
        <kbd className="hidden rounded-md border border-line bg-subtle px-1.5 py-0.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[9vh]" role="dialog" aria-modal="true" aria-label="Поиск">
          <button className="absolute inset-0 animate-fade-in bg-[#1D2130]/25 dark:bg-black/60" onClick={close} aria-label="Закрыть" tabIndex={-1} />
          <div className="relative z-10 flex w-full max-w-[640px] animate-pop-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_48px_rgba(29,33,48,0.18)]">
            <div className="flex h-[58px] items-center gap-2.5 border-b border-[#ECE8DF] px-4 dark:border-line">
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin text-muted" /> : <Search className="h-[18px] w-[18px] text-muted" />}
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, flat.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && flat[active]) flat[active].run();
                }}
                placeholder="Предметы, задачи, вопросы, заметки, файлы…"
                aria-label="Поиск по всему сайту"
                className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
              />
              <kbd className="flex h-6 items-center rounded-md border border-line px-2 text-[11px] text-muted">Esc</kbd>
            </div>
            <div ref={list} className="max-h-[min(520px,60vh)] overflow-y-auto py-1.5">
              {none ? (
                <div className="flex flex-col items-center gap-2.5 px-[18px] py-7 text-sm text-muted">
                  Ничего не нашлось
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openAssistant();
                    }}
                    className="h-9 rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-accent hover:bg-subtle"
                  >
                    Спросить ассистента
                  </button>
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.title} className="py-1">
                    <div className="px-[18px] pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{g.title}</div>
                    {g.items.map((it) => {
                      const i = flat.indexOf(it);
                      const color = (it as Item & { color?: string }).color;
                      return (
                        <button
                          key={it.key}
                          type="button"
                          data-active={i === active}
                          onMouseMove={() => setActive(i)}
                          onClick={it.run}
                          className={cn("mx-1.5 flex min-h-11 w-[calc(100%-12px)] items-center gap-3 rounded-[9px] px-3 text-left", i === active && "bg-accent-soft/70 dark:bg-subtle")}
                        >
                          <span
                            className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold", color ? "" : `${it.iconBg} ${it.iconFg}`)}
                            style={color ? { background: `${color}1f`, color } : undefined}
                            aria-hidden
                          >
                            {it.badge}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{it.label}</span>
                          {it.meta ? <span className="max-w-[45%] shrink-0 truncate text-xs text-muted">{it.meta}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="hidden flex-wrap gap-x-4 gap-y-1 border-t border-[#ECE8DF] bg-[#F8F6F1] px-[18px] py-2.5 text-xs text-muted dark:border-line dark:bg-subtle sm:flex">
              <span>↑ ↓ — выбрать</span>
              <span>Enter — открыть</span>
              <span>Ctrl K — открыть поиск с любой страницы</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
