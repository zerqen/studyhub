/** Список задач «По срокам»: просрочено → эта неделя → следующая → позже → без срока. Чистые функции — проверяются тестами. */
import { dueKey, localKey, type WeekTask } from "./task-week";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "нояб", "дек"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return localKey(d);
};
const closed = (s: string) => s === "DONE" || s === "CANCELLED";

/** «10–15 нояб», «28 нояб – 4 дек» */
export function rangeLabel(from: string, to: string) {
  const a = fromKey(from);
  const b = fromKey(to);
  if (from === to) return `${a.getDate()} ${MONTHS[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** Срок в строке: «сегодня», «завтра», «чт 12» на ближайшую неделю, иначе «23 нояб» */
export function dueLabel(key: string | null, todayKey: string) {
  if (!key) return "—";
  if (key === todayKey) return "сегодня";
  if (key === addDays(todayKey, 1)) return "завтра";
  const d = fromKey(key);
  if (key > todayKey && key <= addDays(todayKey, 6)) return `${WD[d.getDay()]} ${d.getDate()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Срочно: просрочено, сегодня или завтра */
export function isUrgent(key: string | null, todayKey: string) {
  return key !== null && key <= addDays(todayKey, 1);
}

export type DueEntry<T extends WeekTask> = { type: "task"; task: T; key: string | null } | { type: "step"; task: T; step: T["subtasks"][number]; key: string };
export type DueGroup<T extends WeekTask> = { id: string; label: string; range: string; urgent: boolean; entries: DueEntry<T>[] };

/**
 * Группы по срокам. Этапы со своей датой показываются в своей группе (если она раньше сдачи задачи) —
 * так видно, что делать на этой неделе, даже если сдача позже.
 */
export function buildDueGroups<T extends WeekTask>(tasks: T[], today: Date, showDone: boolean): DueGroup<T>[] {
  const todayKey = localKey(today);
  // Неделя — до воскресенья
  const sunday = addDays(todayKey, (7 - today.getDay()) % 7);
  const nextSunday = addDays(sunday, 7);

  const slots: DueGroup<T>[] = [
    { id: "overdue", label: "Просрочено", range: "", urgent: true, entries: [] },
    { id: "week", label: "Эта неделя", range: rangeLabel(todayKey, sunday), urgent: false, entries: [] },
    { id: "next", label: "Следующая неделя", range: rangeLabel(addDays(sunday, 1), nextSunday), urgent: false, entries: [] },
    { id: "later", label: "Позже", range: `с ${rangeLabel(addDays(nextSunday, 1), addDays(nextSunday, 1))}`, urgent: false, entries: [] },
    { id: "none", label: "Без срока", range: "", urgent: false, entries: [] },
    { id: "done", label: "Сделано", range: "", urgent: false, entries: [] },
  ];
  const slotOf = (key: string | null) => (key === null ? 4 : key < todayKey ? 0 : key <= sunday ? 1 : key <= nextSunday ? 2 : 3);

  for (const t of tasks) {
    const key = dueKey(t.dueDate);
    if (closed(t.status)) {
      if (showDone && t.status === "DONE") slots[5].entries.push({ type: "task", task: t, key });
      continue;
    }
    const slot = slotOf(key);
    slots[slot].entries.push({ type: "task", task: t, key });
    for (const s of t.subtasks) {
      const sKey = dueKey(s.dueDate);
      if (!sKey || closed(s.status)) continue;
      const sSlot = slotOf(sKey);
      // Этап в той же группе, что и сдача, виден в развороте задачи — дублировать не нужно
      if (sSlot < slot) slots[sSlot].entries.push({ type: "step", task: t, step: s, key: sKey });
    }
  }

  const byKey = (a: DueEntry<T>, b: DueEntry<T>) =>
    (a.key ?? "9999").localeCompare(b.key ?? "9999") || (a.type === b.type ? (a.task.dueTime ?? "99").localeCompare(b.task.dueTime ?? "99") : a.type === "task" ? -1 : 1);
  for (const g of slots) g.entries.sort(byKey);
  slots[5].entries.reverse();
  return slots.filter((g) => g.entries.length);
}
