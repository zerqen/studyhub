"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { parseQuickTask } from "@/lib/quick-task";
import { KIND_STAGES, taskKind } from "@/lib/task-kinds";
import { Modal } from "../ui/modal";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";

const shortDate = (iso: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Строка «Добавить: кр линал в среду» + кнопка полной формы. Разбор — те же правила, что на странице задач. */
export function QuickAddBar({
  subjects,
  fixedSubjectId,
  placeholder = "Добавить: «кр линал в среду»",
  label = "Быстро добавить задачу",
  className,
  button = "Задача",
}: {
  subjects: { id: string; name: string }[];
  /** На странице предмета задача всегда привязывается к нему */
  fixedSubjectId?: string;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Текст на кнопке: «Задача» на главной, «Добавить» в предмете */
  button?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const toast = useToast();
  const parsed = useMemo(() => (text.trim().length >= 2 ? parseQuickTask(text, subjects) : null), [text, subjects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || busy) {
      if (!parsed) setForm(true);
      return;
    }
    setBusy(true);
    const stages = KIND_STAGES[parsed.kind] ?? [];
    const r = await createTask({
      title: parsed.title,
      kind: parsed.kind,
      subjectId: fixedSubjectId ?? parsed.subjectId,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: "MEDIUM",
      status: "PLANNED",
      ...(stages.length ? { stages } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      toast.push(r.error, "err");
      return;
    }
    toast.push(stages.length ? `Добавлено с этапами (${stages.length})` : "Задача добавлена");
    setText("");
  }

  const k = parsed ? taskKind(parsed.kind) : null;
  return (
    <>
    <form onSubmit={submit} className={className ?? "w-full sm:max-w-[460px] sm:flex-[0_1_460px]"}>
      <div className="flex gap-2">
        <label htmlFor="quick-add" className="sr-only">
          {label}
        </label>
        <input
          id="quick-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted/80 focus:border-accent/60 focus:ring-4 focus:ring-accent/10"
        />
        <button
          type={parsed ? "submit" : "button"}
          onClick={parsed ? undefined : () => setForm(true)}
          disabled={busy}
          className="inline-flex h-[42px] shrink-0 items-center gap-1 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {button === "Задача" ? <Plus className="h-4 w-4" /> : null} {button}
        </button>
      </div>
      {parsed ? (
        <p className="mt-1.5 truncate px-1 text-xs text-muted" aria-live="polite">
          {k && k.value !== "TASK" ? `${k.label} · ` : ""}
          <span className="font-medium text-fg">{parsed.title}</span>
          {fixedSubjectId ? "" : parsed.subjectName ? ` · ${parsed.subjectName}` : " · без предмета"}
          {parsed.dueDate ? ` · ${shortDate(parsed.dueDate)}${parsed.dueTime ? `, ${parsed.dueTime}` : ""}` : " · без срока"}
          {" · Enter — добавить"}
        </p>
      ) : null}
    </form>
    {/* Модалка — вне <form>: внутри неё своя форма, а вложенные формы ломают отправку */}
    <Modal open={form} onClose={() => setForm(false)} title="Новая задача">
      <TaskForm subjects={subjects} initial={fixedSubjectId ? { subjectId: fixedSubjectId } : undefined} onDone={() => setForm(false)} />
    </Modal>
    </>
  );
}
