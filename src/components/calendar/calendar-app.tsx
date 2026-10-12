"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_PRIORITIES } from "@/lib/constants";
import { isOverdue, cn } from "@/lib/utils";
import { moveTaskDate } from "@/actions/tasks";
import { Modal } from "../ui/modal";
import { TaskForm } from "../tasks/task-form";
import { createEvent } from "@/actions/events";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { useToast } from "../ui/toast";

export type CalTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  status: string;
  subjectId: string | null;
  subject: { id: string; name: string; color: string } | null;
};
export type CalExam = { id: string; name: string; color: string; examDate: string | null };
export type CalEvent = {
  id: string;
  title: string;
  startAt: string;
  color: string | null;
  subject: { color: string } | null;
};

export function CalendarApp({
  tasks,
  exams,
  events,
  subjects,
}: {
  tasks: CalTask[];
  exams: CalExam[];
  events: CalEvent[];
  subjects: { id: string; name: string }[];
}) {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [filters, setFilters] = useState({ subject: "", priority: "", status: "", type: "all" });
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const toast = useToast();
  const router = useRouter();

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: s, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    }
    const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: e });
  }, [cursor, view]);

  function itemsFor(day: Date) {
    const taskItems = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
    const examItems = exams.filter((s) => s.examDate && isSameDay(new Date(s.examDate), day));
    const eventItems = events.filter((e) => isSameDay(new Date(e.startAt), day));
    return {
      tasks: taskItems.filter((t) => {
        if (filters.subject && t.subjectId !== filters.subject) return false;
        if (filters.priority && t.priority !== filters.priority) return false;
        if (filters.status && t.status !== filters.status) return false;
        if (filters.type === "task" || filters.type === "exam" || filters.type === "event") {
          return filters.type === "task";
        }
        return true;
      }),
      exams: filters.type === "all" || filters.type === "exam" ? examItems.filter((s) => !filters.subject || s.id === filters.subject) : [],
      events: filters.type === "all" || filters.type === "event" ? eventItems : [],
    };
  }

  async function onDrop(day: Date, taskId: string) {
    const res = await moveTaskDate(taskId, format(day, "yyyy-MM-dd"));
    if (!res.ok) toast.push(res.error, "err");
    else {
      toast.push("Задача перенесена");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Календарь</h1>
        {(["month", "week", "day", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn("rounded-xl px-3 py-1.5 text-sm", view === v ? "bg-accent text-white" : "bg-black/5 dark:bg-white/10")}
          >
            {{ month: "Месяц", week: "Неделя", day: "День", list: "Список" }[v]}
          </button>
        ))}
        <Button variant="secondary" onClick={() => setEventOpen(true)}>
          Событие
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg px-2 py-1 hover:bg-black/5" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addDays(cursor, view === "week" ? -7 : -1))}>
          ←
        </button>
        <div className="min-w-40 text-center font-medium capitalize">
          {format(cursor, view === "day" ? "d MMMM yyyy" : "LLLL yyyy", { locale: ru })}
        </div>
        <button
          className="rounded-lg px-2 py-1 hover:bg-black/5"
          onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addDays(cursor, view === "week" ? 7 : 1))}
        >
          →
        </button>
        <button className="rounded-lg px-2 py-1 text-sm underline" onClick={() => setCursor(new Date())}>
          Сегодня
        </button>
        <select className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10" value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })}>
          <option value="">Все предметы</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">Любой приоритет</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Любой статус</option>
          <option value="PLANNED">Запланировано</option>
          <option value="IN_PROGRESS">В процессе</option>
          <option value="DONE">Выполнено</option>
          <option value="OVERDUE">Просрочено</option>
        </select>
        <select className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="all">Все типы</option>
          <option value="task">Задачи</option>
          <option value="exam">Экзамены</option>
          <option value="event">События</option>
        </select>
      </div>

      {view === "list" ? (
        <div className="space-y-2">
          {days.flatMap((d) => {
            const it = itemsFor(d);
            const all = [
              ...it.exams.map((e) => ({ kind: "exam", id: e.id, title: `Экзамен: ${e.name}`, color: e.color, href: `/subjects/${e.id}` })),
              ...it.tasks.map((t) => ({
                kind: "task",
                id: t.id,
                title: t.title,
                color: t.subject?.color ?? "#64748b",
                href: `/tasks?open=${t.id}`,
                overdue: isOverdue(t.dueDate, t.status),
              })),
              ...it.events.map((e) => ({ kind: "event", id: e.id, title: e.title, color: e.color ?? e.subject?.color ?? "#9c6246", href: "/calendar" })),
            ];
            if (!all.length) return [];
            return (
              <div key={d.toISOString()} className="rounded-2xl bg-[var(--bg-elev)] p-4">
                <div className="mb-2 font-medium capitalize">{format(d, "EEEE, d MMMM", { locale: ru })}</div>
                {all.map((x) => (
                  <button key={x.id} className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-black/5" onClick={() => router.push(x.href)}>
                    <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
                    <span className={"overdue" in x && x.overdue ? "text-rose-600" : ""}>{x.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn("grid gap-px overflow-hidden rounded-2xl bg-black/5 dark:bg-white/10", view === "month" ? "grid-cols-7" : view === "week" ? "grid-cols-7" : "grid-cols-1")}>
          {view !== "day"
            ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <div key={d} className="bg-[var(--bg)] px-2 py-2 text-center text-xs text-[var(--muted)]">
                  {d}
                </div>
              ))
            : null}
          {days.map((day) => {
            const it = itemsFor(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-28 bg-[var(--bg-elev)] p-2",
                  view === "month" && !isSameMonth(day, cursor) && "opacity-40",
                  isSameDay(day, new Date()) && "ring-1 ring-inset ring-accent",
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/task");
                  if (id) void onDrop(day, id);
                }}
                onClick={() => setCreateOn(format(day, "yyyy-MM-dd"))}
              >
                <div className="mb-1 text-xs font-medium">{format(day, "d")}</div>
                <div className="space-y-1">
                  {it.exams.map((s) => (
                    <div key={s.id} className="truncate rounded px-1 text-[11px] text-white" style={{ background: s.color }} onClick={(e) => { e.stopPropagation(); router.push(`/subjects/${s.id}`); }}>
                      {s.name}
                    </div>
                  ))}
                  {it.tasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/tasks?open=${t.id}`);
                      }}
                      className={cn(
                        "cursor-grab truncate rounded px-1 text-[11px] text-white",
                        t.priority === "CRITICAL" && "ring-1 ring-white",
                        isOverdue(t.dueDate, t.status) && "line-through opacity-90",
                      )}
                      style={{ background: isOverdue(t.dueDate, t.status) ? "#e11d48" : t.subject?.color ?? "#64748b" }}
                    >
                      {t.title}
                    </div>
                  ))}
                  {it.events.map((e) => (
                    <div key={e.id} className="truncate rounded px-1 text-[11px] text-white" style={{ background: e.color ?? e.subject?.color ?? "#9c6246" }}>
                      {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!createOn} onClose={() => setCreateOn(null)} title="Новая задача на день">
        {createOn ? (
          <TaskForm subjects={subjects} initial={{ dueDate: createOn }} onDone={() => setCreateOn(null)} />
        ) : null}
      </Modal>
      <Modal open={eventOpen} onClose={() => setEventOpen(false)} title="Пользовательское событие">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createEvent({
              title: eventTitle,
              startAt: format(cursor, "yyyy-MM-dd"),
              allDay: true,
            });
            if (!res.ok) toast.push(res.error, "err");
            else {
              toast.push("Событие создано");
              setEventOpen(false);
              setEventTitle("");
              router.refresh();
            }
          }}
        >
          <Field label="Название">
            <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full">
            Добавить
          </Button>
        </form>
      </Modal>
    </div>
  );
}
