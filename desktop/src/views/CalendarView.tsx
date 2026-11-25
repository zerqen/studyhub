import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { DesktopState, TaskDto } from "../../electron/types";
import { formatEventTime, isLessonEvent, toDateOnlyIso, todayLocalDate } from "../lib/date";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function CalendarView({
  state,
  onToggleLessons,
  onToggleTask,
  onOpenTask,
  onCreateTaskOnDate,
}: {
  state: DesktopState;
  onToggleLessons: (show: boolean) => void;
  onToggleTask: (id: string) => void;
  onOpenTask: (task: TaskDto) => void;
  onCreateTaskOnDate: (dateIso: string) => void;
}) {
  const today = todayLocalDate();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedIso, setSelectedIso] = useState(() => toDateOnlyIso(today));

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of state.snapshot.tasks) {
      if (t.status === "CANCELLED" || !t.dueDate) continue;
      const key = t.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [state.snapshot.tasks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof state.snapshot.calendarEvents>();
    for (const ev of state.snapshot.calendarEvents) {
      if (!state.prefs.showLessons && isLessonEvent(ev)) continue;
      const key = ev.start.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [state.snapshot.calendarEvents, state.prefs.showLessons]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const out: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= totalDays; d++) {
      out.push({ iso: toDateOnlyIso(new Date(year, month, d)), day: d });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const dayTasks = tasksByDay.get(selectedIso) ?? [];
  const dayEvents = eventsByDay.get(selectedIso) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading text-3xl">Календарь</h1>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm">
          <input type="checkbox" checked={state.prefs.showLessons} onChange={(e) => onToggleLessons(e.target.checked)} />
          Показывать пары
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-subtle"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="font-serif text-lg font-bold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-subtle"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
            {DAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="h-14" />;
              const active = cell.iso === selectedIso;
              const isToday = cell.iso === toDateOnlyIso(today);
              const tCount = tasksByDay.get(cell.iso)?.length ?? 0;
              const eCount = eventsByDay.get(cell.iso)?.length ?? 0;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedIso(cell.iso)}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-sm transition-colors ${
                    active
                      ? "border-accent bg-accent-soft font-semibold text-accent"
                      : isToday
                        ? "border-accent/40 bg-subtle/60 font-semibold"
                        : "border-transparent hover:bg-subtle"
                  }`}
                >
                  <span>{cell.day}</span>
                  <div className="mt-1 flex gap-1">
                    {tCount > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-urgent" /> : null}
                    {eCount > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="heading text-xl">{selectedIso}</h2>
            <button
              type="button"
              onClick={() => onCreateTaskOnDate(selectedIso)}
              className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Задача
            </button>
          </div>

          {dayEvents.length === 0 && dayTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">На этот день планов нет</p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((ev) => (
                <div key={ev.key} className="flex items-center gap-2 rounded-xl bg-subtle/60 px-3 py-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: ev.color }} />
                  <span className="text-xs text-muted">{ev.allDay ? "день" : formatEventTime(ev.start)}</span>
                  <span className="truncate font-medium">{ev.title}</span>
                </div>
              ))}
              {dayTasks.map((t) => {
                const done = t.status === "DONE";
                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => onToggleTask(t.id)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                        done ? "border-accent bg-accent text-white" : "border-muted"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : null}
                    </button>
                    <button type="button" onClick={() => onOpenTask(t)} className={`min-w-0 flex-1 truncate text-left ${done ? "text-muted line-through" : "font-medium"}`}>
                      {t.title}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
