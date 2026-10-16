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
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, GraduationCap, Plus } from "lucide-react";
import { isOverdue, cn } from "@/lib/utils";
import { moveTaskDate } from "@/actions/tasks";
import { createEvent } from "@/actions/events";
import { Modal } from "../ui/modal";
import { TaskForm } from "../tasks/task-form";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/field";
import { Segmented } from "../ui/page";
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
export type CalEvent = { id: string; title: string; startAt: string; color: string | null; subject: { color: string } | null };

type Item = { kind: "exam" | "task" | "event"; id: string; title: string; color: string; href?: string; done?: boolean; overdue?: boolean };

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [moved, setMoved] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  const days = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: s, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    });
  }, [cursor, view]);

  // Раскладываем всё по дням один раз, а не фильтруем массивы для каждой ячейки
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (date: string | null, item: Item) => {
      if (!date) return;
      const key = format(new Date(date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    for (const s of exams) {
      if (subjectFilter && s.id !== subjectFilter) continue;
      add(s.examDate, { kind: "exam", id: s.id, title: s.name, color: s.color, href: `/subjects/${s.id}` });
    }
    for (const t of tasks) {
      if (subjectFilter && t.subjectId !== subjectFilter) continue;
      if (t.status === "CANCELLED") continue;
      const due = moved[t.id] ?? t.dueDate;
      add(due, {
        kind: "task",
        id: t.id,
        title: t.title,
        color: t.subject?.color ?? "#94a3b8",
        href: `/tasks/${t.id}`,
        done: t.status === "DONE",
        overdue: isOverdue(due, t.status),
      });
    }
    if (!subjectFilter) for (const e of events) add(e.startAt, { kind: "event", id: e.id, title: e.title, color: e.color ?? e.subject?.color ?? "#6366f1" });
    return map;
  }, [tasks, exams, events, subjectFilter, moved]);

  const itemsOf = (day: Date) => byDay.get(format(day, "yyyy-MM-dd")) ?? [];
  const selectedItems = itemsOf(selected);

  async function onDrop(day: Date, taskId: string) {
    const date = format(day, "yyyy-MM-dd");
    setMoved((m) => ({ ...m, [taskId]: `${date}T00:00:00` }));
    const res = await moveTaskDate(taskId, date);
    if (!res.ok) {
      toast.push(res.error, "err");
      setMoved((m) => {
        const c = { ...m };
        delete c[taskId];
        return c;
      });
    } else toast.push("Задача перенесена");
  }

  function shift(dir: 1 | -1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addDays(c, 7 * dir)));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Календарь</h1>
        <Button
          variant="secondary"
          onClick={() => {
            setEventDate(format(selected, "yyyy-MM-dd"));
            setEventOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Событие
        </Button>
        <Button onClick={() => setCreateOn(format(selected, "yyyy-MM-dd"))}>
          <Plus className="h-4 w-4" /> Задача
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-36 text-center text-[15px] font-semibold capitalize">
            {view === "month"
              ? format(cursor, "LLLL yyyy", { locale: ru })
              : `${format(days[0], "d MMM", { locale: ru })} – ${format(days[6], "d MMM", { locale: ru })}`}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Вперёд">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setCursor(new Date());
            setSelected(startOfDay(new Date()));
          }}
        >
          Сегодня
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="h-8 w-auto min-w-36 text-[13px]">
            <option value="">Все предметы</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              ["month", "Месяц"],
              ["week", "Неделя"],
            ]}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={cn("py-2 text-center text-xs font-medium text-muted", i >= 5 && "text-muted/70")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const items = itemsOf(day);
              const today = isSameDay(day, new Date());
              const isSel = isSameDay(day, selected);
              const outside = view === "month" && !isSameMonth(day, cursor);
              const limit = view === "month" ? 3 : 10;
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(startOfDay(day))}
                  onDoubleClick={() => setCreateOn(format(day, "yyyy-MM-dd"))}
                  onKeyDown={(e) => e.key === "Enter" && setSelected(startOfDay(day))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/task");
                    if (id) void onDrop(day, id);
                  }}
                  className={cn(
                    "relative cursor-pointer border-line p-1 text-left outline-none transition-colors sm:p-1.5",
                    view === "month" ? "min-h-16 sm:min-h-24" : "min-h-40 sm:min-h-64",
                    i % 7 !== 6 && "border-r",
                    i < days.length - 7 && "border-b",
                    outside && "bg-subtle/40",
                    isSel ? "bg-accent/5" : "hover:bg-subtle/50",
                  )}
                >
                  <div className="mb-1 flex justify-center sm:justify-start">
                    <span
                      className={cn(
                        "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums",
                        today ? "bg-accent font-semibold text-accent-fg" : isSel ? "font-semibold text-accent" : outside ? "text-muted/60" : "text-fg/80",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  {/* На телефоне — цветные точки, на компьютере — подписи */}
                  <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((it) => (
                      <span key={`${it.kind}-${it.id}`} className="h-1.5 w-1.5 rounded-full" style={{ background: it.overdue ? "rgb(var(--danger))" : it.color }} />
                    ))}
                  </div>
                  <div className="hidden space-y-0.5 sm:block">
                    {items.slice(0, limit).map((it) => (
                      <div
                        key={`${it.kind}-${it.id}`}
                        draggable={it.kind === "task"}
                        onDragStart={(e) => e.dataTransfer.setData("text/task", it.id)}
                        onClick={(e) => {
                          if (!it.href) return;
                          e.stopPropagation();
                          router.push(it.href);
                        }}
                        title={it.title}
                        className={cn(
                          "flex items-center gap-1 truncate rounded px-1 py-px text-[11px] leading-4",
                          it.kind === "exam" ? "font-semibold text-white" : "bg-subtle text-fg/90 hover:bg-line",
                          it.kind === "task" && "cursor-grab",
                          it.done && "text-muted line-through",
                        )}
                        style={it.kind === "exam" ? { background: it.color } : undefined}
                      >
                        {it.kind !== "exam" ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.overdue ? "rgb(var(--danger))" : it.color }} /> : null}
                        <span className="truncate">{it.title}</span>
                      </div>
                    ))}
                    {items.length > limit ? <div className="px-1 text-[11px] text-muted">ещё {items.length - limit}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="card self-start">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-sm font-semibold capitalize">{format(selected, "EEEE, d MMMM", { locale: ru })}</div>
            <Button variant="ghost" size="icon-sm" aria-label="Задача на этот день" onClick={() => setCreateOn(format(selected, "yyyy-MM-dd"))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-1.5">
            {selectedItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Ничего не запланировано</p>
            ) : (
              selectedItems.map((it) => {
                const inner = (
                  <>
                    {it.kind === "exam" ? (
                      <GraduationCap className="h-4 w-4 shrink-0" style={{ color: it.color }} />
                    ) : (
                      <span className="mx-1 h-2 w-2 shrink-0 rounded-full" style={{ background: it.overdue ? "rgb(var(--danger))" : it.color }} />
                    )}
                    <span className={cn("min-w-0 flex-1 truncate text-sm", it.done && "text-muted line-through", it.kind === "exam" && "font-medium")}>
                      {it.kind === "exam" ? `Экзамен: ${it.title}` : it.title}
                    </span>
                  </>
                );
                return it.href ? (
                  <Link key={`${it.kind}-${it.id}`} href={it.href} className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-subtle">
                    {inner}
                  </Link>
                ) : (
                  <div key={`${it.kind}-${it.id}`} className="flex items-center gap-2 px-2.5 py-2">
                    {inner}
                  </div>
                );
              })
            )}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted max-sm:hidden">Двойной клик по дню — новая задача. Задачи можно перетаскивать.</p>
        </aside>
      </div>

      <Modal open={!!createOn} onClose={() => setCreateOn(null)} title="Новая задача" description={createOn ? format(new Date(createOn), "d MMMM, EEEE", { locale: ru }) : undefined}>
        {createOn ? <TaskForm subjects={subjects} initial={{ dueDate: createOn }} onDone={() => setCreateOn(null)} /> : null}
      </Modal>
      <Modal open={eventOpen} onClose={() => setEventOpen(false)} title="Новое событие">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createEvent({ title: eventTitle, startAt: eventDate, allDay: true });
            if (!res.ok) toast.push(res.error, "err");
            else {
              toast.push("Событие создано");
              setEventOpen(false);
              setEventTitle("");
            }
          }}
        >
          <Field label="Название">
            <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required autoFocus placeholder="Консультация, пересдача…" />
          </Field>
          <Field label="Дата">
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full">
            Добавить
          </Button>
        </form>
      </Modal>
    </div>
  );
}
