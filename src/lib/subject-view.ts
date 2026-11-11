/** Подписи и подсчёты для списка предметов и страницы предмета. Чистые функции — проверяются тестами. */

/** plural(5, "задача", "задачи", "задач") → "задач" */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

type Q = { status: string; srsReps: number };

/** Выучено / в процессе / не начато. «Выучено» — как везде на сайте: статус LEARNED (интервал от 7 дней). */
export function questionSplit(questions: Q[]) {
  let learned = 0;
  let started = 0;
  for (const q of questions) {
    if (q.status === "LEARNED") learned++;
    else if (q.srsReps > 0 || q.status !== "UNLEARNED") started++;
  }
  return { learned, started, fresh: questions.length - learned - started, total: questions.length };
}

/**
 * Темп до экзамена: сколько новых вопросов в день брать, чтобы открыть все за неделю до экзамена
 * (последняя неделя — на повторение). null — если экзамена нет или считать нечего.
 */
export function newPerDay(fresh: number, daysLeft: number | null) {
  if (daysLeft === null || daysLeft < 0 || fresh <= 0) return null;
  const days = Math.max(1, daysLeft - 7);
  return Math.ceil(fresh / days);
}

export function paceText(split: { fresh: number; total: number }, daysLeft: number | null) {
  if (!split.total) return null;
  if (daysLeft !== null && daysLeft < 0) return null;
  if (split.fresh === 0) return "все вопросы уже начаты — теперь повторение";
  const n = newPerDay(split.fresh, daysLeft);
  if (n === null) return null;
  return `≈ ${n} ${plural(n, "новый", "новых", "новых")} в день — и успеваешь к экзамену`;
}

/** «через 76 дней», «завтра», «сегодня», «прошёл» */
export function untilText(days: number | null) {
  if (days === null) return "";
  if (days < 0) return "прошёл";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${plural(days, "день", "дня", "дней")}`;
}

/** Семестр по дате: сентябрь–январь — осенний */
export function semesterText(now: Date) {
  const m = Number(new Intl.DateTimeFormat("en", { month: "numeric", timeZone: "Europe/Moscow" }).format(now));
  if (m >= 9 || m === 1) return "осенний семестр";
  if (m >= 2 && m <= 6) return "весенний семестр";
  return "каникулы";
}

/** Цвет метки расширения файла: [текст, фон] */
export function extTone(name: string): [string, string] {
  const e = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (e === "pdf") return ["#B91C1C", "#FDECEC"];
  if (["xlsx", "xls", "csv", "ods"].includes(e)) return ["#15803D", "#E8F5EC"];
  if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(e)) return ["#1D4ED8", "#E8EEFC"];
  if (["ppt", "pptx", "odp"].includes(e)) return ["#C2410C", "#FBEBDD"];
  if (["png", "jpg", "jpeg", "webp", "gif", "heic", "svg"].includes(e)) return ["#0E7490", "#E3F3F6"];
  if (["mp3", "m4a", "wav", "ogg", "mp4", "mov", "webm"].includes(e)) return ["#6D28D9", "#EFE9FB"];
  return ["#424655", "#F0EDE6"];
}

/** Категория вопроса во вкладке «Вопросы»: совпадает с полосой в шапке (в процессе + сложные = «в процессе»). */
export type QCat = "new" | "learn" | "hard" | "done";
export function questionCat(q: Q): QCat {
  if (q.status === "LEARNED") return "done";
  if (q.status === "REVIEW") return "hard";
  if (q.status === "IN_PROGRESS" || q.srsReps > 0) return "learn";
  return "new";
}

/** Статус, который ставится по клику на чип: не начато → в процессе → сложный → выучено → не начато */
export const NEXT_STATUS: Record<QCat, string> = { new: "IN_PROGRESS", learn: "REVIEW", hard: "LEARNED", done: "UNLEARNED" };

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "нояб", "дек"];

/** Когда повторить: «—» для новых, «сегодня», «завтра», «через 3 дн.», дальше двух недель — дата */
export function nextReviewLabel(srsDue: string | Date | null, srsReps: number, now: Date) {
  if (!srsReps || !srsDue) return "—";
  const due = new Date(srsDue);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(due) - day(now)) / 864e5);
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days <= 14) return `через ${days} дн.`;
  return `${due.getDate()} ${MONTHS[due.getMonth()]}`;
}

/** Поиск во вкладке «Вопросы»: число — по номеру (с начала), иначе все слова должны встретиться в тексте */
export function matchQuestion(query: string, n: number, text: string, ticketNo?: number | null) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (/^\d+$/.test(q)) return String(n).startsWith(q) || (ticketNo != null && String(ticketNo) === q);
  const hay = text.toLowerCase().replace(/ё/g, "е");
  return q
    .replace(/ё/g, "е")
    .split(/\s+/)
    .every((w) => hay.includes(w));
}
