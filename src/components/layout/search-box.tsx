"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit } from "@/actions/search";

const typeLabel: Record<SearchHit["type"], string> = {
  subject: "Предмет",
  task: "Задача",
  subtask: "Подзадача",
  ticket: "Билет",
  question: "Вопрос",
  note: "Заметка",
  file: "Файл",
  tag: "Тег",
};

export function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      const res = await globalSearch(q);
      setHits(res.ok ? (res.data ?? []) : []);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Поиск по всему… Ctrl+K"
        className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 outline-none ring-info/40 focus:ring-2 dark:border-white/10 dark:bg-ink-900 dark:text-ink-50"
      />
      {open && hits.length > 0 ? (
        <div className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-black/10 bg-[var(--bg-elev)] shadow-pop dark:border-white/10">
          {hits.map((h) => (
            <button
              key={`${h.type}-${h.id}`}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onMouseDown={() => {
                router.push(h.href);
                setOpen(false);
                setQ("");
              }}
            >
              <span className="font-medium">{h.title}</span>
              <span className="text-xs text-[var(--muted)]">
                {typeLabel[h.type]}
                {h.hint ? ` · ${h.hint}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
