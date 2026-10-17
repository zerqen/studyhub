export const EVENT_KINDS = [
  { value: "LECTURE", label: "Лекция", color: "#6366f1" },
  { value: "SEMINAR", label: "Практика", color: "#0ea5e9" },
  { value: "LAB", label: "Лабораторная", color: "#14b8a6" },
  { value: "TEST", label: "Контрольная", color: "#f97316" },
  { value: "CONSULT", label: "Консультация", color: "#a855f7" },
  { value: "EXAM", label: "Экзамен / зачёт", color: "#ef4444" },
  { value: "OTHER", label: "Другое", color: "#94a3b8" },
] as const;

export type EventKind = (typeof EVENT_KINDS)[number]["value"];

export function kindMeta(kind?: string | null) {
  return EVENT_KINDS.find((k) => k.value === kind) ?? EVENT_KINDS[EVENT_KINDS.length - 1];
}

export const RECURRENCE = [
  { value: "", label: "Не повторять" },
  { value: "WEEKLY", label: "Каждую неделю" },
  { value: "BIWEEKLY", label: "Через неделю" },
] as const;

type EventLike = {
  id: string;
  startAt: Date | string;
  endAt: Date | string | null;
  recurrence: string | null;
  repeatUntil: Date | string | null;
};

export type Occurrence<T> = T & { key: string; start: Date; end: Date | null };

const DAY = 86_400_000;

/** Разворачивает повторяющиеся события в конкретные даты внутри [from, to) */
export function expandEvents<T extends EventLike>(events: T[], from: Date, to: Date): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  for (const e of events) {
    const start = new Date(e.startAt);
    const duration = e.endAt ? new Date(e.endAt).getTime() - start.getTime() : null;
    const step = e.recurrence === "WEEKLY" ? 7 * DAY : e.recurrence === "BIWEEKLY" ? 14 * DAY : 0;
    if (!step) {
      if (start >= from && start < to) out.push({ ...e, key: e.id, start, end: duration !== null ? new Date(start.getTime() + duration) : null });
      continue;
    }
    const until = e.repeatUntil ? Math.min(new Date(e.repeatUntil).getTime() + DAY, to.getTime()) : to.getTime();
    let t = start.getTime();
    if (t < from.getTime()) t += Math.ceil((from.getTime() - t) / step) * step;
    for (let i = 0; t < until && i < 400; t += step, i++) {
      const s = new Date(t);
      out.push({ ...e, key: `${e.id}:${t}`, start: s, end: duration !== null ? new Date(t + duration) : null });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Чётность учебной недели относительно 1 сентября (неделя, содержащая 1.09 — первая, нечётная) */
export function weekParity(date: Date) {
  const y = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const sept1 = new Date(y, 8, 1);
  const monday = new Date(sept1);
  monday.setDate(sept1.getDate() - ((sept1.getDay() + 6) % 7));
  const week = Math.floor((date.getTime() - monday.getTime()) / (7 * DAY)) + 1;
  return { week, odd: week % 2 === 1 };
}
