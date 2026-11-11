/** Главная: раскладка задач по дням, подписи и сокращения. Чистые функции — проверяются тестами. */
import { dayKey } from "./utils";

const DAY = 86_400_000;

export type HomeTask = {
  id: string;
  title: string;
  kind: string;
  status: string;
  dueDate: Date | string | null;
  dueTime: string | null;
  subject: { name: string; color: string } | null;
  subtasks: { status: string }[];
};

export type DayGroup<T> = { key: string; label: string; date: string; urgent: boolean; items: T[] };

const dueKey = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
// Полдень по Москве: так сдвиг на день не меняет дату ни в каком часовом поясе сервера
const keyDate = (key: string) => new Date(`${key}T12:00:00+03:00`);
const fmt = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { ...opts, timeZone: "Europe/Moscow" }).format(keyDate(key));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Дни недели вперёд от сегодня (по Москве) */
export function nextKeys(now: Date, days = 7) {
  const today = dayKey(now);
  return Array.from({ length: days }, (_, i) => dayKey(new Date(keyDate(today).getTime() + i * DAY)));
}

/**
 * Открытые задачи на 7 дней вперёд, по дням. Просроченные — первой группой.
 * Суббота и воскресенье, если это не сегодня и не завтра, сливаются в «Выходные».
 */
export function buildWeekGroups<T extends HomeTask>(tasks: T[], now: Date): DayGroup<T>[] {
  const keys = nextKeys(now);
  const [today, tomorrow] = keys;
  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const byTime = (a: T, b: T) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");

  const groups: DayGroup<T>[] = [];
  const overdue = open.filter((t) => {
    const k = dueKey(t.dueDate);
    return k !== null && k < today;
  });
  if (overdue.length) {
    groups.push({ key: "overdue", label: "Просрочено", date: "", urgent: true, items: overdue.sort((a, b) => (dueKey(a.dueDate) ?? "").localeCompare(dueKey(b.dueDate) ?? "")) });
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const items = open.filter((t) => dueKey(t.dueDate) === key).sort(byTime);
    const weekday = keyDate(key).getUTCDay();
    const next = keys[i + 1];
    // Суббота + воскресенье = «Выходные»
    if (weekday === 6 && next && key !== today && key !== tomorrow) {
      const sunday = open.filter((t) => dueKey(t.dueDate) === next).sort(byTime);
      i++;
      if (items.length || sunday.length) {
        groups.push({ key, label: "Выходные", date: `${fmt(key, { day: "numeric" })}–${fmt(next, { day: "numeric", month: "long" })}`, urgent: false, items: [...items, ...sunday] });
      }
      continue;
    }
    if (!items.length) continue;
    const near = key === today || key === tomorrow;
    groups.push({
      key,
      label: key === today ? "Сегодня" : key === tomorrow ? "Завтра" : capital(fmt(key, { weekday: "long" })),
      date: near ? fmt(key, { weekday: "short", day: "numeric", month: "long" }) : fmt(key, { day: "numeric", month: "long" }),
      urgent: near,
      items,
    });
  }
  return groups;
}

/** Ограничение длины списка с сохранением групп: первые limit задач по порядку */
export function limitGroups<T>(groups: DayGroup<T>[], limit: number) {
  let left = limit;
  const out: DayGroup<T>[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    const items = g.items.slice(0, left);
    left -= items.length;
    out.push({ ...g, items });
  }
  return out;
}

const SHORT_SKIP = new Set(["и", "в", "во", "на", "по", "к", "с", "для", "о", "об", "основы", "введение"]);

/** Две буквы для плитки предмета: «Линейная алгебра» → ЛА, «Физика» → ФИ */
export function subjectShort(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const main = words.filter((w) => !SHORT_SKIP.has(w.toLowerCase()));
  const use = main.length ? main : words;
  if (!use.length) return "?";
  if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
  return (use[0][0] + use[1][0]).toUpperCase();
}

/** «через 63 дня», «завтра», «сегодня» */
export function inDays(days: number) {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  const n = days % 100;
  const d = n % 10;
  const word = n >= 11 && n <= 14 ? "дней" : d === 1 ? "день" : d >= 2 && d <= 4 ? "дня" : "дней";
  return `через ${days} ${word}`;
}

/** Номер учебной недели от 1 сентября (неделя с 1.09 — первая) */
export function studyWeek(now: Date) {
  const key = dayKey(now);
  const [y, m] = key.split("-").map(Number);
  const year = m >= 9 ? y : y - 1;
  const sept1 = keyDate(`${year}-09-01`);
  const monday = sept1.getTime() - ((sept1.getUTCDay() + 6) % 7) * DAY;
  return Math.floor((keyDate(key).getTime() - monday) / (7 * DAY)) + 1;
}

/** Подпись под заголовком: «вторник, 10 ноября · 11-я неделя» */
export function todayLine(now: Date) {
  const date = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(now);
  const [, m] = dayKey(now).split("-").map(Number);
  // Летом учебной недели нет
  return m >= 7 && m <= 8 ? date : `${date} · ${studyWeek(now)}-я неделя`;
}
