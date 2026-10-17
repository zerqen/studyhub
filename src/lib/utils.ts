import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isBefore, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date?: Date | string | null, pattern = "d MMM yyyy") {
  if (!date) return "—";
  return format(new Date(date), pattern, { locale: ru });
}

export function formatRelative(date?: Date | string | null) {
  if (!date) return "";
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: ru });
}

export function isOverdue(dueDate?: Date | string | null, status?: string | null) {
  if (!dueDate) return false;
  if (status === "DONE" || status === "CANCELLED") return false;
  return isBefore(startOfDay(new Date(dueDate)), startOfDay(new Date()));
}

export function daysUntil(date?: Date | string | null) {
  if (!date) return null;
  const diff = startOfDay(new Date(date)).getTime() - startOfDay(new Date()).getTime();
  return Math.round(diff / 86_400_000);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Ключ дня YYYY-MM-DD в часовом поясе пользователя (по умолчанию — Москва) */
export function dayKey(date: Date | string, timeZone = "Europe/Moscow") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}
