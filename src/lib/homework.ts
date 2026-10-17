import { dayKey } from "./utils";

/** Пары, которые не считаются «следующим занятием» для домашки */
const NOT_A_LESSON = new Set(["EXAM", "CONSULT"]);

type Lesson = { subjectId: string | null; kind: string; start: Date };

/**
 * Следующая пара предмета после той, на которой задали домашку.
 * Пары в тот же день (сдвоенные) пропускаем: домашку сдают на следующем занятии, а не через перемену.
 * sameKind — искать пару того же типа (практику после практики).
 */
export function nextLesson<T extends Lesson>(occurrences: T[], subjectId: string, after: Date, kind?: string | null): T | null {
  const day = dayKey(after);
  let best: T | null = null;
  for (const o of occurrences) {
    if (o.subjectId !== subjectId || NOT_A_LESSON.has(o.kind)) continue;
    if (kind && o.kind !== kind) continue;
    if (o.start.getTime() <= after.getTime() || dayKey(o.start) === day) continue;
    if (!best || o.start < best.start) best = o;
  }
  return best;
}

/** Срок задачи в формате, в котором хранятся остальные задачи: дата (полночь UTC дня по Москве) + время HH:mm */
export function dueFields(start: Date) {
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow", hourCycle: "h23" }).format(start);
  return { dueDate: new Date(`${dayKey(start)}T00:00:00.000Z`), dueTime: time };
}

/** Домашка, которую надо сдать на этой паре */
export function isDueAt(task: { subjectId: string | null; dueDate: Date | string | null }, lesson: { subjectId: string | null; start: Date }) {
  return Boolean(task.dueDate && task.subjectId && task.subjectId === lesson.subjectId && dayKey(task.dueDate) === dayKey(lesson.start));
}

/** Домашка, которую задали на этой паре */
export function isAssignedAt(task: { subjectId: string | null; lessonAt: Date | string | null }, lesson: { subjectId: string | null; start: Date }) {
  return Boolean(task.lessonAt && task.subjectId === lesson.subjectId && Math.abs(new Date(task.lessonAt).getTime() - lesson.start.getTime()) < 60_000);
}
