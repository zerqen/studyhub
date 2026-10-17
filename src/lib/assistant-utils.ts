/** Чистые помощники ассистента: даты по Москве, сопоставление названий. Проверяются тестами. */
import { normalizeName } from "./ics";
import { weekParity } from "./schedule";
import { dayKey } from "./utils";

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** Сокращения, которыми студенты называют предметы */
const ALIASES: [RegExp, string][] = [
  [/^матан$|^матанализ$|^матанал/, "математический анализ"],
  [/^линал$|^линейка$|^алгебра$/, "линейная алгебра"],
  [/^физра$|^физкультура$/, "физическая культура"],
  [/^англ$|^английский$|^инглиш$/, "иностранный язык"],
  [/^информатика$|^инф$|^ит$/, "информационные технологии"],
  [/^история$/, "история"],
  [/^начерт$|^инженерка$/, "инженерная графика"],
];

function commonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Находит объект по названию: точное совпадение, вхождение, сокращение, общие слова. null — не нашли, массив — неоднозначно. */
export function matchByName<T extends { name: string }>(items: T[], query: string): T | T[] | null {
  const q = normalizeName(query);
  if (!q) return null;
  const norm = items.map((it) => ({ it, n: normalizeName(it.name) }));
  const exact = norm.filter((x) => x.n === q);
  if (exact.length === 1) return exact[0].it;
  const alias = ALIASES.find(([re]) => re.test(q))?.[1];
  const candidates = alias ? [q, alias] : [q];
  for (const c of candidates) {
    const inc = norm.filter((x) => x.n.includes(c) || (c.length >= 4 && c.includes(x.n)));
    if (inc.length === 1) return inc[0].it;
    if (inc.length > 1) {
      const starts = inc.filter((x) => x.n.startsWith(c));
      if (starts.length === 1) return starts[0].it;
      return inc.map((x) => x.it);
    }
  }
  // Общие слова по префиксам: «мат анализ» → «математический анализ», «физ» → «физика»
  const words = q.split(" ").filter((w) => w.length >= 3);
  if (!words.length) return null;
  const scored = norm
    .map((x) => {
      const target = x.n.split(" ");
      // Слово совпадает, если это начало слова названия или общий корень (падежи: «историю» ~ «история»)
      const hit = words.filter((w) => target.some((t) => t.startsWith(w) || commonPrefix(w, t) >= Math.max(4, Math.min(w.length, t.length) - 2))).length;
      return { it: x.it, score: hit / words.length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length === 1 || scored[0].score > scored[1].score) return scored[0].it;
  return scored.filter((s) => s.score === scored[0].score).map((s) => s.it);
}

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
export const pad = (t: string) => (t.length === 4 ? `0${t}` : t);

/** Дата и время по Москве → Date */
export function msk(date: string, time = "00:00") {
  return new Date(`${date}T${pad(time)}:00+03:00`);
}

/** Срок задачи в формате остальных задач: полночь UTC нужного дня */
export function dueDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", ...opts }).format(d);

export function weekdayOf(date: Date) {
  const key = dayKey(date);
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** «чт 22.10» */
export function shortDay(date: Date | string) {
  const d = new Date(date);
  return `${SHORT[weekdayOf(d)]} ${fmt(d, { day: "2-digit", month: "2-digit" })}`;
}

export function timeOf(date: Date | string) {
  return fmt(new Date(date), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Срок задачи для ассистента: дата хранится полночью UTC — берём день по UTC, чтобы не съехать */
export function dueText(dueDate: Date | string | null, dueTime?: string | null) {
  if (!dueDate) return "без срока";
  const key = new Date(dueDate).toISOString().slice(0, 10);
  const d = new Date(`${key}T12:00:00Z`);
  return `${SHORT[d.getUTCDay()]} ${key.slice(8, 10)}.${key.slice(5, 7)}${dueTime ? ` ${dueTime}` : ""}`;
}

/** Контекст времени для модели: сегодня и две недели вперёд с днями недели — модели плохо считают «в среду» сами */
export function timeContext(now = new Date()) {
  const today = dayKey(now);
  const p = weekParity(new Date(`${today}T12:00:00`));
  const lines: string[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const label = i === 0 ? " (сегодня)" : i === 1 ? " (завтра)" : i === 2 ? " (послезавтра)" : "";
    lines.push(`${SHORT[d.getUTCDay()]} ${key}${label}`);
  }
  return {
    now: `${WEEKDAYS[weekdayOf(now)]}, ${today}, ${timeOf(now)} по Москве; учебная неделя ${p.week} (${p.odd ? "нечётная" : "чётная"})`,
    days: lines.join("; "),
  };
}
