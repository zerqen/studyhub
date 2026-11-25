import { useMemo, useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import type { SubjectDto } from "../../electron/types";
import { parseQuickTask, type QuickTaskParsed } from "../lib/quick-task";

const KIND_NAMES: Record<string, string> = {
  HOMEWORK: "ДЗ",
  LAB: "Лаба",
  TEST: "КР",
  DRAWING: "Чертёж",
  TASK: "Задача",
};

export function QuickAddBar({
  subjects,
  onCreate,
  autoFocus = false,
  placeholder = "Быстрая задача: «ДЗ матан завтра 18:00» или «лаба 3 физика до 5.12»",
}: {
  subjects: SubjectDto[];
  onCreate: (parsed: QuickTaskParsed) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseQuickTask(text, subjects) : null), [text, subjects]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!parsed || !parsed.title.trim()) return;
    onCreate(parsed);
    setText("");
  }

  return (
    <form onSubmit={submit} className="card p-3.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="text"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/75"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg transition-opacity disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>
      {parsed ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-2.5 text-xs">
          <span className="rounded-md bg-subtle px-2 py-0.5 font-medium text-fg">{parsed.title}</span>
          <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent">
            {KIND_NAMES[parsed.kind] ?? parsed.kind}
          </span>
          {parsed.subjectName ? (
            <span className="rounded-md bg-subtle px-2 py-0.5 text-fg">{parsed.subjectName}</span>
          ) : null}
          {parsed.dueDateLabel ? (
            <span className="rounded-md bg-urgent-soft px-2 py-0.5 text-urgent">{parsed.dueDateLabel}</span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
