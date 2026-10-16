"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ListChecks, Paperclip, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { deleteTask, toggleTaskDone } from "@/actions/tasks";
import { TASK_PRIORITIES, labelOf, priorityTone } from "@/lib/constants";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog, Modal } from "../ui/modal";
import { PageHeader, Segmented } from "../ui/page";
import { EmptyState } from "../ui/empty";
import { Select } from "../ui/field";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";
import { Checkbox } from "./checkbox";

type Task = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  subject: { id: string; name: string; color: string } | null;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  subtasks: { status: string }[];
  tags: { tag: { name: string } }[];
  questions: { id: string }[];
  _count: { attachments: number };
};

type Group = { id: string; title: string; tone?: "danger"; items: Task[] };

export function TasksBoard({
  tasks,
  subjects,
  questions,
  tag,
}: {
  tasks: Task[];
  subjects: { id: string; name: string }[];
  questions: { id: string; text: string; subjectId: string }[];
  tag?: string;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState<"active" | "done" | "all">("active");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });
  // Оптимистичные отметки: галочка ставится сразу, сервер догоняет
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const statusOf = (t: Task) => optimistic[t.id] ?? t.status;

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const list = tasks.filter((t) => {
      const st = optimistic[t.id] ?? t.status;
      if (st === "CANCELLED" && scope !== "all") return false;
      if (scope === "active" && st === "DONE") return false;
      if (scope === "done" && st !== "DONE") return false;
      if (subject && (subject === "none" ? t.subjectId : t.subjectId !== subject)) return false;
      if (tag && !t.tags.some((x) => x.tag.name === tag)) return false;
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const g: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [], nodate: [], done: [] };
    for (const t of list) {
      const st = optimistic[t.id] ?? t.status;
      const d = daysUntil(t.dueDate);
      if (st === "DONE" || st === "CANCELLED") g.done.push(t);
      else if (d === null) g.nodate.push(t);
      else if (d < 0) g.overdue.push(t);
      else if (d === 0) g.today.push(t);
      else if (d <= 7) g.week.push(t);
      else g.later.push(t);
    }
    return [
      { id: "overdue", title: "Просрочено", tone: "danger" as const, items: g.overdue },
      { id: "today", title: "Сегодня", items: g.today },
      { id: "week", title: "На этой неделе", items: g.week },
      { id: "later", title: "Позже", items: g.later },
      { id: "nodate", title: "Без срока", items: g.nodate },
      { id: "done", title: "Выполнено", items: g.done },
    ].filter((x) => x.items.length);
  }, [tasks, query, subject, scope, tag, optimistic]);

  const activeCount = tasks.filter((t) => !["DONE", "CANCELLED"].includes(statusOf(t))).length;

  async function toggle(task: Task) {
    const next = statusOf(task) === "DONE" ? "PLANNED" : "DONE";
    setOptimistic((o) => ({ ...o, [task.id]: next }));
    const result = await toggleTaskDone(task.id);
    if (!result.ok) {
      toast.push(result.error, "err");
      setOptimistic((o) => {
        const c = { ...o };
        delete c[task.id];
        return c;
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Задачи"
        description={activeCount ? `${activeCount} активных` : "Всё сделано"}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Новая задача
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent/60 focus:ring-4 focus:ring-accent/10"
            placeholder="Найти задачу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto min-w-40">
          <option value="">Все предметы</option>
          <option value="none">Без предмета</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            ["active", "Активные"],
            ["done", "Выполненные"],
            ["all", "Все"],
          ]}
        />
        {tag ? (
          <Link href="/tasks" className="inline-flex h-8 items-center gap-1 rounded-full bg-accent/10 px-3 text-[13px] font-medium text-accent">
            #{tag} <X className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={tasks.length ? "Ничего не найдено" : "Задач пока нет"}
          hint={tasks.length ? "Попробуй изменить фильтры." : "Создай первую задачу — например, «Сдать лабораторную №1»."}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const isCollapsed = collapsed[group.id] && scope !== "done";
            return (
              <section key={group.id}>
                <button
                  className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold"
                  onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", isCollapsed && "-rotate-90")} />
                  <span className={group.tone === "danger" ? "text-danger" : ""}>{group.title}</span>
                  <span className="font-normal text-muted">{group.items.length}</span>
                </button>
                {!isCollapsed ? (
                  <ul className="card divide-y divide-line overflow-hidden">
                    {group.items.map((task) => {
                      const st = statusOf(task);
                      const done = st === "DONE";
                      const subDone = task.subtasks.filter((s) => s.status === "DONE").length;
                      return (
                        <li key={task.id} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/50">
                          <Checkbox checked={done} onChange={() => void toggle(task)} className="mt-0.5" label={done ? "Вернуть в работу" : "Выполнить"} />
                          <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
                            <div className={cn("text-sm leading-snug transition-colors", done && "text-muted line-through")}>{task.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                              {task.subject ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full" style={{ background: task.subject.color }} />
                                  {task.subject.name}
                                </span>
                              ) : null}
                              {task.dueDate ? (
                                <span className={cn(group.id === "overdue" && "font-medium text-danger")}>
                                  {formatDate(task.dueDate, "d MMM")}
                                  {task.dueTime ? `, ${task.dueTime}` : ""}
                                </span>
                              ) : null}
                              {task.subtasks.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" /> {subDone}/{task.subtasks.length}
                                </span>
                              ) : null}
                              {task._count.attachments ? (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" /> {task._count.attachments}
                                </span>
                              ) : null}
                              {task.tags.map((t) => (
                                <span key={t.tag.name}>#{t.tag.name}</span>
                              ))}
                            </div>
                          </Link>
                          {task.priority === "HIGH" || task.priority === "CRITICAL" ? (
                            <Badge tone={priorityTone(task.priority)} className="hidden sm:inline-flex">
                              {labelOf(TASK_PRIORITIES, task.priority)}
                            </Badge>
                          ) : null}
                          <div className="flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <Button variant="ghost" size="icon-sm" aria-label="Редактировать" onClick={() => setEditing(task)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label="Удалить" className="hover:text-danger" onClick={() => setDeleting(task.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Новая задача">
        <TaskForm subjects={subjects} questions={questions} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Редактировать задачу">
        {editing ? (
          <TaskForm
            id={editing.id}
            subjects={subjects}
            questions={questions}
            initial={{
              title: editing.title,
              description: editing.description ?? "",
              subjectId: editing.subjectId ?? "",
              startDate: editing.startDate?.slice(0, 10) ?? "",
              dueDate: editing.dueDate?.slice(0, 10) ?? "",
              dueTime: editing.dueTime ?? "",
              priority: editing.priority,
              status: statusOf(editing),
              tags: editing.tags.map((t) => t.tag.name).join(", "),
              questionId: editing.questions[0]?.id,
            }}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Удалить задачу?"
        text="Задача и её подзадачи будут удалены."
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteTask(deleting);
          if (!result.ok) toast.push(result.error, "err");
          else toast.push("Задача удалена");
          setDeleting(null);
        }}
      />
    </div>
  );
}
