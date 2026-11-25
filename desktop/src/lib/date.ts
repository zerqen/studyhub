import type { TaskDto, TodayEventDto } from "../../electron/types";

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const LESSON_KINDS = new Set(["CLASS", "LECTURE", "LAB", "SEMINAR"]);

export function todayLocalDate(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toDateOnlyIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(raw?: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

export function diffDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86_400_000);
}

export function isOverdue(task: TaskDto, today = todayLocalDate()): boolean {
  if (task.status === "DONE" || task.status === "CANCELLED") return false;
  const d = parseDateOnly(task.dueDate);
  if (!d) return false;
  return diffDays(d, today) < 0;
}

export function isDueThisWeek(task: TaskDto, today = todayLocalDate()): boolean {
  const d = parseDateOnly(task.dueDate);
  if (!d) return false;
  const delta = diffDays(d, today);
  return delta >= 0 && delta <= 7;
}

export function formatShortDate(raw?: string | null): string {
  const d = parseDateOnly(raw);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

export function formatDueBadge(raw?: string | null, time?: string | null, today = todayLocalDate()): { label: string; urgent: boolean } {
  const d = parseDateOnly(raw);
  if (!d) return { label: time || "Без срока", urgent: false };
  const diff = diffDays(d, today);
  const base =
    diff < 0
      ? `Просрочено (${formatShortDate(raw)})`
      : diff === 0
        ? "Сегодня"
        : diff === 1
          ? "Завтра"
          : `${WEEKDAYS_RU[d.getDay()]} · ${formatShortDate(raw)}`;
  return { label: time ? `${base}, ${time}` : base, urgent: diff <= 1 };
}

export function isLessonEvent(ev: TodayEventDto): boolean {
  return LESSON_KINDS.has(ev.kind.toUpperCase());
}

export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function greetingRu(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}
