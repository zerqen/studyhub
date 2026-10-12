export const SUBJECT_TYPES = [
  { value: "EXAM", label: "Экзамен" },
  { value: "CREDIT", label: "Зачёт" },
  { value: "TEST", label: "Контрольная" },
  { value: "COURSEWORK", label: "Курсовая" },
  { value: "HOMEWORK", label: "Домашка" },
  { value: "OTHER", label: "Другое" },
] as const;

export const TASK_PRIORITIES = [
  { value: "LOW", label: "Низкий", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "MEDIUM", label: "Средний", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  { value: "HIGH", label: "Высокий", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  { value: "CRITICAL", label: "Критический", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
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
  "#9c6246",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#0891b2",
  "#4f46e5",
  "#16a34a",
  "#b45309",
];

export const NOTE_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff", "#fed7aa", "#e2e8f0"];

export const EMOJIS = ["📘", "📗", "📙", "📕", "🧠", "📐", "🧪", "💻", "📜", "🎯", "📝", "🔬", "🌍", "🎵", "⚖️"];

export const MAX_FILE_SIZE = 15 * 1024 * 1024;

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
  "audio/webm",
  "application/zip",
]);

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], value?: string | null) {
  return list.find((x) => x.value === value)?.label ?? value ?? "—";
}
