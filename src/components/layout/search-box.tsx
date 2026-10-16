"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, CheckSquare, FileText, Hash, HelpCircle, ListTree, Loader2, NotebookPen, Paperclip, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit } from "@/actions/search";
import { cn } from "@/lib/utils";

const typeMeta: Record<SearchHit["type"], { label: string; icon: typeof Search }> = {
  subject: { label: "Предмет", icon: BookOpen },
  task: { label: "Задача", icon: CheckSquare },
  subtask: { label: "Подзадача", icon: ListTree },
  ticket: { label: "Билет", icon: FileText },
  question: { label: "Вопрос", icon: HelpCircle },
  note: { label: "Заметка", icon: NotebookPen },
  file: { label: "Файл", icon: Paperclip },
  tag: { label: "Тег", icon: Hash },
};

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
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

  function go(hit: SearchHit) {
    router.push(hit.href);
    close();
  }

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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Поиск">
          <button className="absolute inset-0 animate-fade-in bg-black/40 dark:bg-black/60" onClick={close} aria-label="Закрыть" tabIndex={-1} />
          <div className="relative z-10 w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <Search className="h-4 w-4 text-muted" />}
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, hits.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && hits[active]) go(hits[active]);
                }}
                placeholder="Предметы, вопросы, задачи, заметки…"
                className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              <kbd className="rounded-md border border-line bg-subtle px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {!q.trim() ? (
                <p className="px-3 py-6 text-center text-sm text-muted">Начни печатать — ищу по всему сразу</p>
              ) : !loading && hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">Ничего не найдено</p>
              ) : (
                hits.map((h, i) => {
                  const meta = typeMeta[h.type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={`${h.type}-${h.id}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === active ? "bg-subtle" : "")}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{h.title}</span>
                        {h.hint ? <span className="block truncate text-xs text-muted">{h.hint}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{meta.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
