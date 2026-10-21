/** Раскладка задач и их этапов по дням недели. Чистые функции — проверяются тестами. */

export type WeekStep = { id: string; title: string; status: string; dueDate: string | null };
export type WeekTask = { id: string; status: string; dueDate: string | null; dueTime: string | null; subtasks: WeekStep[] };

export type Entry<T extends WeekTask> = { type: "task"; task: T } | { type: "step"; task: T; step: T["subtasks"][number] };

const pad = (n: number) => String(n).padStart(2, "0");
export const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Сроки хранятся полночью UTC нужного дня — день берём из строки, без часовых поясов */
export const dueKey = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/** Понедельник недели, в которую попадает дата */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function weekKeys(start: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return localKey(d);
  });
}

const closed = (s: string) => s === "DONE" || s === "CANCELLED";

export function buildWeek<T extends WeekTask>(tasks: T[], start: Date, today: Date, showDone: boolean) {
  const keys = weekKeys(start);
  const todayKey = localKey(today);
  const days = new Map<string, Entry<T>[]>(keys.map((k) => [k, []]));
  const overdue: Entry<T>[] = [];
  const noDate: T[] = [];
  const isCurrent = keys.includes(todayKey);

  for (const t of tasks) {
    const tKey = dueKey(t.dueDate);
    const tClosed = closed(t.status);
    if (!tKey) {
      if (!tClosed || showDone) noDate.push(t);
    } else if (days.has(tKey)) {
      if (!tClosed || showDone) days.get(tKey)!.push({ type: "task", task: t });
    } else if (isCurrent && tKey < todayKey && !tClosed) {
      overdue.push({ type: "task", task: t });
    }
    // Этапы со своими датами — в свой день (у закрытой задачи этапы не показываем)
    if (tClosed) continue;
    for (const s of t.subtasks) {
      const sKey = dueKey(s.dueDate);
      if (!sKey) continue;
      const sClosed = closed(s.status);
      if (days.has(sKey)) {
        if (!sClosed || showDone) days.get(sKey)!.push({ type: "step", task: t, step: s });
      } else if (isCurrent && sKey < todayKey && !sClosed) {
        overdue.push({ type: "step", task: t, step: s });
      }
    }
  }

  // Внутри дня: сначала сдачи (задачи), потом этапы; задачи — по времени
  const order = (a: Entry<T>, b: Entry<T>) => {
    if (a.type !== b.type) return a.type === "task" ? -1 : 1;
    return (a.task.dueTime ?? "99:99").localeCompare(b.task.dueTime ?? "99:99");
  };
  for (const list of days.values()) list.sort(order);
  overdue.sort((a, b) => (dueKey(a.type === "task" ? a.task.dueDate : a.step.dueDate) ?? "").localeCompare(dueKey(b.type === "task" ? b.task.dueDate : b.step.dueDate) ?? ""));

  return { keys, days, overdue, noDate, todayKey };
}

/** Сколько незакрытых дел на день — для пометки «много» */
export function openCount<T extends WeekTask>(entries: Entry<T>[]) {
  return entries.filter((e) => !closed(e.type === "task" ? e.task.status : e.step.status)).length;
}

export const OVERLOAD = 5;
