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
import { CalendarPlus, ChevronLeft, ChevronRight, FileUp, GraduationCap, MapPin, Plus } from "lucide-react";
import { isOverdue, cn } from "@/lib/utils";
import { moveTaskDate, toggleTaskDone } from "@/actions/tasks";
import { Modal } from "../ui/modal";
import { TaskForm } from "../tasks/task-form";
import { EventForm, type EditableEvent } from "./event-form";
import { ScheduleImport } from "./schedule-import";
import { expandEvents, kindMeta, weekParity } from "@/lib/schedule";
import { isAssignedAt, isDueAt } from "@/lib/homework";
import { HomeworkPanel } from "./homework-panel";
import { taskKind } from "@/lib/task-kinds";
import { useToast } from "../ui/toast";

export type CalTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  status: string;
  subjectId: string | null;
  subject: { id: string; name: string; color: string } | null;
  kind?: string;
  dueTime?: string | null;
  lessonAt?: string | null;
};
export type CalExam = { id: string; name: string; color: string; examDate: string | null };
export type CalEvent = EditableEvent & { color: string | null; subject: { name: string; color: string } | null };

type Sync = { url: string | null; syncedAt: string | null };

type Item = {
  kind: "exam" | "task" | "event";
  id: string;
  title: string;
  color: string;
  href?: string;
  done?: boolean;
  overdue?: boolean;
  time?: string;
  sort: number;
  event?: CalEvent;
  /** Начало конкретного повтора пары */
  start?: string;
  meta?: string;
  /** К паре надо сдать домашку */
  homework?: number;
};

const hhmm = (d: Date) => format(d, "HH:mm");

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const navBtn = "grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-[#424655] transition-colors hover:bg-subtle dark:text-muted";

export function CalendarApp({
  tasks,
  exams,
  events,
  subjects,
  sync = { url: null, syncedAt: null },
}: {
  tasks: CalTask[];
  exams: CalExam[];
  events: CalEvent[];
  subjects: { id: string; name: string; color?: string }[];
  sync?: Sync;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState<null | { event?: CalEvent; date?: string; start?: string }>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [doneOver, setDoneOver] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState(true);
  const toast = useToast();
  const router = useRouter();
  const homework = useMemo(() => tasks.filter((t) => t.kind === "HOMEWORK" && t.status !== "CANCELLED"), [tasks]);

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
      add(s.examDate, { kind: "exam", id: s.id, title: s.name, color: s.color, href: `/subjects/${s.id}`, sort: -1 });
    }
    for (const t of tasks) {
      if (subjectFilter && t.subjectId !== subjectFilter) continue;
      if (t.status === "CANCELLED") continue;
      const due = moved[t.id] ?? t.dueDate;
      const done = doneOver[t.id] ?? t.status === "DONE";
      if (done && !showDone) continue;
      add(due, {
        kind: "task",
        id: t.id,
        title: t.kind && t.kind !== "TASK" ? `${taskKind(t.kind).label}: ${t.title}` : t.title,
        color: t.subject?.color ?? "#94a3b8",
        href: `/tasks/${t.id}`,
        done,
        overdue: isOverdue(due, done ? "DONE" : t.status),
        meta: [t.kind && t.kind !== "TASK" ? taskKind(t.kind).full : "Задача", t.subject?.name].filter(Boolean).join(" · "),
        sort: done ? 3000 : 2000,
      });
    }
    const from = days[0];
    const to = addDays(days[days.length - 1], 1);
    for (const e of expandEvents(events, from, to)) {
      if (subjectFilter && e.subjectId !== subjectFilter) continue;
      const meta = kindMeta(e.kind);
      const hw = homework.filter((t) => t.status !== "DONE" && isDueAt(t, e)).length;
      add(e.start.toISOString(), {
        kind: "event",
        id: e.key,
        title: e.title,
        color: e.color ?? e.subject?.color ?? meta.color,
        time: e.allDay ? undefined : `${hhmm(e.start)}${e.end ? `–${hhmm(e.end)}` : ""}`,
        sort: e.allDay ? 0 : e.start.getHours() * 60 + e.start.getMinutes(),
        event: e,
        start: e.start.toISOString(),
        homework: hw,
        meta: [hw ? "сдать ДЗ" : null, meta.label, e.location, e.description?.split("\n").slice(1).join(", ")].filter(Boolean).join(" · "),
      });
    }
    for (const list of map.values()) list.sort((a, b) => a.sort - b.sort);
    return map;
  }, [tasks, exams, events, subjectFilter, moved, days, homework, doneOver, showDone]);

  const openHomework = useMemo(() => {
    const e = eventOpen?.event;
    const start = eventOpen?.start;
    if (!e || !start || !e.subjectId || ["EXAM", "CONSULT"].includes(e.kind)) return null;
    const lesson = { subjectId: e.subjectId, start: new Date(start) };
    return {
      subjectId: e.subjectId,
      start,
      kind: e.kind,
      due: homework.filter((t) => isDueAt(t, lesson)),
      assigned: homework.filter((t) => isAssignedAt({ subjectId: t.subjectId, lessonAt: t.lessonAt ?? null }, lesson)),
    };
  }, [eventOpen, homework]);

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

  async function toggleDone(id: string, was: boolean) {
    setDoneOver((m) => ({ ...m, [id]: !was }));
    const r = await toggleTaskDone(id);
    if (!r.ok) {
      setDoneOver((m) => ({ ...m, [id]: was }));
      toast.push(r.error, "err");
    }
  }

  const upcomingExams = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return exams
      .filter((x) => x.examDate && new Date(x.examDate).getTime() >= today)
      .sort((a, b) => a.examDate!.localeCompare(b.examDate!))
      .slice(0, 6);
  }, [exams]);

  function shift(dir: 1 | -1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addDays(c, 7 * dir)));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-3 sm:gap-x-4">
        <h1 className="heading mr-2 w-full text-[28px] sm:w-auto sm:text-[34px]">Календарь</h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label={view === "month" ? "Предыдущий месяц" : "Предыдущая неделя"} className={navBtn}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="heading min-w-[130px] text-center text-lg capitalize">
            {view === "month"
              ? format(cursor, "LLLL yyyy", { locale: ru })
              : `${format(days[0], "d MMM", { locale: ru })} – ${format(days[6], "d MMM", { locale: ru })}`}
          </span>
          <button type="button" onClick={() => shift(1)} aria-label={view === "month" ? "Следующий месяц" : "Следующая неделя"} className={navBtn}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(new Date());
              setSelected(startOfDay(new Date()));
            }}
            className="ml-1 h-9 rounded-lg border border-line bg-surface px-3 text-[13px] transition-colors hover:bg-subtle"
          >
            Сегодня
          </button>
          {view === "week" ? (
            <span className="ml-2 text-xs text-muted">
              {(() => {
                const p = weekParity(days[0]);
                return `${p.week}-я неделя · ${p.odd ? "нечётная" : "чётная"}`;
              })()}
            </span>
          ) : null}
        </div>
        <div role="group" aria-label="Вид" className="flex gap-1 rounded-[10px] bg-[#E9E5DC] p-[3px] dark:bg-subtle sm:ml-auto">
          {(
            [
              ["month", "Месяц"],
              ["week", "Неделя"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn("h-[34px] rounded-lg px-3 text-[13px] transition-colors", view === id ? "bg-surface font-semibold shadow-sm" : "text-fg/75 hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 max-sm:ml-auto">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            title="Загрузить расписание из файла .ics или по ссылке"
            aria-label={sync.url ? "Расписание" : "Импорт .ics"}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-[#424655] transition-colors hover:bg-subtle dark:text-muted"
          >
            <FileUp className="h-4 w-4" /> <span className="max-sm:sr-only">{sync.url ? "Расписание" : "Импорт .ics"}</span>
          </button>
          <button
            type="button"
            onClick={() => setEventOpen({ date: format(selected, "yyyy-MM-dd") })}
            title="Пара / событие"
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] transition-colors hover:bg-subtle"
          >
            <CalendarPlus className="h-4 w-4" /> <span className="max-sm:sr-only">Пара / событие</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOn(format(selected, "yyyy-MM-dd"))}
            className="h-10 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:px-4"
          >
            + Задача
          </button>
        </div>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-1.5">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "", name: "Все предметы", color: "#1D2130" }, ...subjects].map((sj) => {
            const on = subjectFilter === sj.id;
            return (
              <button
                key={sj.id || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setSubjectFilter(sj.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                  on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-fg/30",
                )}
              >
                <span aria-hidden className="h-2 w-2 rounded-[3px]" style={{ background: sj.color ?? "#8A8D99" }} />
                {sj.name}
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-[13px] text-[#424655] dark:text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
          Показывать сделанное
        </label>
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label={view === "month" ? "Месяц" : "Неделя"} className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line bg-[#F8F6F1] dark:bg-subtle/60">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={cn("px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.04em] sm:px-2.5 sm:text-left", i >= 5 ? "text-muted/80" : "text-muted")}>
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
                  aria-label={`${format(day, "d MMMM", { locale: ru })}${items.length ? `, записей: ${items.length}` : ""}`}
                  aria-pressed={isSel}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-1 border-[#ECE8DF] p-1 text-left outline-none transition-colors dark:border-line sm:p-2",
                    view === "month" ? "min-h-16 sm:min-h-[104px]" : "min-h-40 sm:min-h-64",
                    i % 7 !== 6 && "border-r",
                    i < days.length - 7 && "border-b",
                    isSel
                      ? "bg-[#F4F7FE] shadow-[inset_0_0_0_2px_rgb(var(--accent))] dark:bg-accent/10"
                      : outside
                        ? "bg-[#F8F6F1] hover:bg-[#F3F1EC] dark:bg-subtle/40"
                        : i % 7 >= 5
                          ? "bg-[#FCFBF7] hover:bg-[#F8F6F1] dark:bg-surface"
                          : "hover:bg-[#FCFBF7] dark:hover:bg-subtle/40",
                  )}
                >
                  <div className="flex justify-center sm:justify-start">
                    <span
                      className={cn(
                        "grid h-[26px] min-w-[26px] place-items-center rounded-full px-1 text-[13px] tabular-nums",
                        today ? "bg-accent font-bold text-white" : outside ? "font-medium text-muted/70" : "font-medium text-fg",
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
                  <div className="hidden flex-col gap-1 sm:flex">
                    {items.slice(0, limit).map((it) => (
                      <div
                        key={`${it.kind}-${it.id}`}
                        draggable={it.kind === "task"}
                        onDragStart={(e) => e.dataTransfer.setData("text/task", it.id)}
                        onClick={(e) => {
                          if (it.event) {
                            e.stopPropagation();
                            setEventOpen({ event: it.event, start: it.start });
                            return;
                          }
                          if (!it.href) return;
                          e.stopPropagation();
                          router.push(it.href);
                        }}
                        title={[it.time, it.title, it.meta].filter(Boolean).join(" · ")}
                        className={cn(
                          "flex items-center gap-1 truncate rounded-md border-l-[3px] px-1.5 py-[3px] text-[11px] leading-[1.3] transition-[filter] hover:brightness-95",
                          it.kind === "exam" && "font-semibold text-white",
                          it.kind === "task" && "cursor-grab",
                          it.done && "bg-[#F3F1EC] text-muted/90 line-through dark:bg-subtle",
                          !it.done && it.overdue && "bg-urgent-soft text-fg",
                        )}
                        style={{
                          borderLeftColor: it.color,
                          ...(it.kind === "exam" ? { background: it.color } : !it.done && !it.overdue ? { background: `${it.color}14` } : {}),
                        }}
                      >
                        {it.time ? <span className="shrink-0 tabular-nums text-muted">{it.time.slice(0, 5)}</span> : null}
                        <span className="truncate">{it.title}</span>
                        {it.homework ? <span className="ml-auto shrink-0 rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">ДЗ</span> : null}
                      </div>
                    ))}
                    {items.length > limit ? <div className="pl-1 text-[11px] text-muted">ещё {items.length - limit}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside aria-label="Выбранный день" className="flex flex-col gap-3.5">
          <section className="overflow-hidden rounded-[14px] border border-line bg-surface">
            <div className="flex items-start justify-between gap-2 px-[18px] pb-3 pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">
                  {isSameDay(selected, new Date()) ? "сегодня · " : ""}
                  {format(selected, "EEEE", { locale: ru })}
                </span>
                <h2 className="heading text-[22px]">{format(selected, "d MMMM", { locale: ru })}</h2>
              </div>
              <button
                type="button"
                aria-label="Задача на этот день"
                title="Задача на этот день"
                onClick={() => setCreateOn(format(selected, "yyyy-MM-dd"))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-[#234AB0] transition-colors hover:bg-subtle dark:text-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="border-t border-[#ECE8DF] px-[18px] pb-[18px] pt-3.5 text-sm text-muted dark:border-line">Ничего не запланировано</p>
            ) : (
              selectedItems.map((it) => {
                const sub = it.kind === "exam" ? "Экзамен" : it.kind === "task" ? it.meta : [it.time, it.meta].filter(Boolean).join(" · ");
                const title = (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-sm font-medium leading-snug", it.done && "text-muted line-through")}>{it.title}</span>
                    {sub ? (
                      <span className="flex items-center gap-1 truncate text-xs text-muted">
                        {it.event?.location ? <MapPin className="h-3 w-3 shrink-0" /> : null}
                        {sub}
                      </span>
                    ) : null}
                  </span>
                );
                return (
                  <div key={`${it.kind}-${it.id}`} className="flex min-h-[52px] items-center gap-2.5 border-t border-[#ECE8DF] px-[18px] py-2 dark:border-line">
                    {it.kind === "task" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(it.done)}
                        onChange={() => void toggleDone(it.id, Boolean(it.done))}
                        aria-label={`Выполнено: ${it.title}`}
                        className="h-[18px] w-[18px] shrink-0 accent-[rgb(var(--accent))]"
                      />
                    ) : it.kind === "exam" ? (
                      <GraduationCap className="h-[18px] w-[18px] shrink-0" style={{ color: it.color }} />
                    ) : (
                      <span className="w-[18px] shrink-0" />
                    )}
                    <span aria-hidden className="w-1 self-stretch rounded-sm" style={{ background: it.overdue && !it.done ? "rgb(var(--urgent))" : it.color }} />
                    {it.event ? (
                      <button type="button" onClick={() => setEventOpen({ event: it.event, start: it.start })} className="flex min-w-0 flex-1 text-left hover:text-accent">
                        {title}
                      </button>
                    ) : it.href ? (
                      <Link href={it.href} className="flex min-w-0 flex-1 hover:text-accent">
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                  </div>
                );
              })
            )}
          </section>

          {upcomingExams.length ? (
            <section aria-label="Ближайшие экзамены" className="flex flex-col rounded-[14px] border border-line bg-surface px-[18px] py-3.5">
              <h2 className="heading mb-1.5 text-lg">Сессия</h2>
              {upcomingExams.map((x) => (
                <Link key={x.id} href={`/subjects/${x.id}`} className="flex justify-between gap-2.5 border-t border-[#ECE8DF] py-2.5 text-sm hover:text-accent dark:border-line">
                  <span className="min-w-0 truncate">{x.name}</span>
                  <span className="heading shrink-0">{format(new Date(x.examDate!), "d MMM", { locale: ru })}</span>
                </Link>
              ))}
            </section>
          ) : null}

          <p className="text-xs leading-normal text-muted max-sm:hidden">Двойной клик по дню — новая задача. Задачи можно перетаскивать между днями. Расписание пар — «Пара / событие» с повтором.</p>
        </aside>
      </div>

      <Modal open={!!createOn} onClose={() => setCreateOn(null)} title="Новая задача" description={createOn ? format(new Date(createOn), "d MMMM, EEEE", { locale: ru }) : undefined}>
        {createOn ? <TaskForm subjects={subjects} initial={{ dueDate: createOn }} onDone={() => setCreateOn(null)} /> : null}
      </Modal>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Импорт расписания" description="Пары, экзамены и предметы из файла .ics" className="sm:max-w-lg">
        {importOpen ? <ScheduleImport subjects={subjects} sync={sync} onDone={() => setImportOpen(false)} /> : null}
      </Modal>
      <Modal open={!!eventOpen} onClose={() => setEventOpen(null)} title={eventOpen?.event ? eventOpen.event.title : "Новое событие"}
        description={eventOpen?.event && eventOpen.start ? format(new Date(eventOpen.start), "EEEE, d MMMM, HH:mm", { locale: ru }) : undefined}
        className="sm:max-w-md"
      >
        {eventOpen ? (
          <EventForm
            key={eventOpen.event?.id ?? "new"}
            event={eventOpen.event}
            defaultDate={eventOpen.date}
            subjects={subjects}
            onDone={() => setEventOpen(null)}
            homework={
              openHomework ? (
                <HomeworkPanel
                  key={openHomework.start}
                  subjectId={openHomework.subjectId}
                  lessonStart={openHomework.start}
                  lessonKind={openHomework.kind}
                  due={openHomework.due}
                  assigned={openHomework.assigned}
                />
              ) : null
            }
          />
        ) : null}
      </Modal>
    </div>
  );
}
