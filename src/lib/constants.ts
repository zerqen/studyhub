import type { Tone } from "@/components/ui/badge";

export const SUBJECT_TYPES = [
  { value: "EXAM", label: "Экзамен" },
  { value: "CREDIT", label: "Зачёт" },
  { value: "TEST", label: "Контрольная" },
  { value: "COURSEWORK", label: "Курсовая" },
  { value: "HOMEWORK", label: "Домашка" },
  { value: "OTHER", label: "Другое" },
] as const;

export const TASK_PRIORITIES = [
  { value: "LOW", label: "Низкий" },
  { value: "MEDIUM", label: "Средний" },
  { value: "HIGH", label: "Высокий" },
  { value: "CRITICAL", label: "Критический" },
] as const;

export const TASK_STATUSES = [
  { value: "PLANNED", label: "Запланировано" },
  { value: "IN_PROGRESS", label: "В процессе" },
  { value: "DONE", label: "Выполнено" },
  { value: "OVERDUE", label: "Просрочено" },
  { value: "CANCELLED", label: "Отменено" },
] as const;

export const TICKET_STATUSES = [
  { value: "NOT_STARTED", label: "Не начат" },
  { value: "IN_PROGRESS", label: "В процессе" },
  { value: "LEARNED", label: "Выучен" },
  { value: "REVIEW", label: "Нужно повторить" },
] as const;

export const QUESTION_STATUSES = [
  { value: "UNLEARNED", label: "Не выучен" },
  { value: "IN_PROGRESS", label: "В процессе" },
  { value: "LEARNED", label: "Выучен" },
  { value: "REVIEW", label: "Требует повторения" },
] as const;

export const DIFFICULTIES = [
  { value: "EASY", label: "Легко" },
  { value: "MEDIUM", label: "Средне" },
  { value: "HARD", label: "Сложно" },
] as const;

export const SUBJECT_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
];

// Цвет заметки — это метка (полоска слева), а не фон: так заметки читаются и в тёмной теме
export const NOTE_COLORS = ["#eab308", "#22c55e", "#3b82f6", "#ec4899", "#a855f7", "#f97316", "#94a3b8"];

export const EMOJIS = ["📘", "📗", "📙", "📕", "🧠", "📐", "🧪", "💻", "📜", "🎯", "📝", "🔬", "🌍", "🎵", "⚖️"];

export const MAX_FILE_SIZE = 15 * 1024 * 1024;
/** Аудио и видео (записи лекций) через сервер — до 90 МБ */
export const MAX_MEDIA_FILE_SIZE = 90 * 1024 * 1024;

export function isMedia(mime: string) {
  return mime.startsWith("audio/") || mime.startsWith("video/");
}

/** Лимит для загрузки через сервер: записи — 90 МБ, остальное — 15 МБ */
export function maxServerSize(mime: string) {
  return isMedia(mime) ? MAX_MEDIA_FILE_SIZE : MAX_FILE_SIZE;
}
/** Большие файлы (записи лекций) грузятся из браузера прямо в Vercel Blob, минуя сервер */
export const MAX_DIRECT_FILE_SIZE = 300 * 1024 * 1024;
/** Всё, что больше, идёт напрямую: у функций Vercel лимит тела запроса ~4,5 МБ */
export const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/zip",
]);

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], value?: string | null) {
  return list.find((x) => x.value === value)?.label ?? value ?? "—";
}

export function questionStatusTone(status?: string | null): Tone {
  if (status === "LEARNED") return "success";
  if (status === "REVIEW") return "warning";
  if (status === "IN_PROGRESS") return "accent";
  return "neutral";
}

export function taskStatusTone(status?: string | null): Tone {
  if (status === "DONE") return "success";
  if (status === "OVERDUE") return "danger";
  if (status === "IN_PROGRESS") return "accent";
  return "neutral";
}

export function priorityTone(priority?: string | null): Tone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "LOW") return "neutral";
  return "accent";
}
