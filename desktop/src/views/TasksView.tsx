import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { DesktopState, TaskDto } from "../../electron/types";
import { QuickAddBar } from "../components/QuickAddBar";
import { diffDays, formatDueBadge, isOverdue, parseDateOnly, todayLocalDate } from "../lib/date";
import type { QuickTaskParsed } from "../lib/quick-task";

type Filter = "open" | "hw" | "overdue" | "today" | "done";

const FILTERS: [Filter, string][] = [
  ["open", "Открытые"],
  ["hw", "ДЗ"],
  ["overdue", "Просрочено"],
  ["today", "Сегодня"],
  ["done", "Сделано"],
];

export function TasksView({
  state,
  onToggleTask,
  onPostponeTask,
  onQuickCreate,
  onOpenTask,
  onOpenCreate,
}: {
  state: DesktopState;
  onToggleTask: (id: string) => void;
  onPostponeTask: (id: string) => void;
  onQuickCreate: (parsed: QuickTaskParsed) => void;
  onOpenTask: (task: TaskDto) => void;
  onOpenCreate: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const today = todayLocalDate();
  const subjectsById = useMemo(() => new Map(state.snapshot.subjects.map((s) => [s.id, s])), [state.snapshot.subjects]);

  const rows = useMemo(() => {
    const active = state.snapshot.tasks.filter((t) => t.status !== "CANCELLED");
    switch (filter) {
      case "open":
        return active.filter((t) => t.status !== "DONE");
      case "hw":
        return active.filter((t) => t.status !== "DONE" && t.kind === "HOMEWORK");
      case "overdue":
        return active.filter((t) => isOverdue(t, today));
      case "today":
        return active.filter((t) => {
          if (t.status === "DONE") return false;
          const d = parseDateOnly(t.dueDate);
          return d !== null && diffDays(d, today) === 0;
        });
      case "done":
        return active.filter((t) => t.status === "DONE");
    }
  }, [state.snapshot.tasks, filter, today]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading text-3xl">Задачи</h1>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          <Plus className="h-4 w-4" />
          Создать
        </button>
      </div>

      <QuickAddBar subjects={state.snapshot.subjects} onCreate={onQuickCreate} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              filter === id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-line">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">В этом фильтре задач пока нет</p>
        ) : (
          rows.map((task) => {
            const sub = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
            const due = formatDueBadge(task.dueDate, task.dueTime, today);
            const done = task.status === "DONE";
            return (
              <div key={task.id} className="group flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    done ? "border-accent bg-accent text-white" : "border-muted hover:border-accent"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : null}
                </button>
                <button type="button" onClick={() => onOpenTask(task)} className="min-w-0 flex-1 text-left">
                  <div className={`truncate text-sm font-medium ${done ? "text-muted line-through" : "text-fg hover:text-accent"}`}>
                    {task.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {sub ? <span>{sub.emoji} {sub.name}</span> : null}
                    <span className={due.urgent && !done ? "font-medium text-urgent" : ""}>{due.label}</span>
                    {task.subtasks.length > 0 ? (
                      <span>· этапы {task.subtasks.filter((s) => s.status === "DONE").length}/{task.subtasks.length}</span>
                    ) : null}
                  </div>
                </button>
                {!done ? (
                  <button
                    type="button"
                    onClick={() => onPostponeTask(task.id)}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted opacity-0 transition-opacity hover:border-accent hover:text-accent group-hover:opacity-100"
                  >
                    На завтра
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
