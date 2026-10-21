/**
 * Быстрое добавление задачи одной строкой: «лаба 3 физика до 5.11», «кр линал в среду», «чертёж лист 2 через неделю».
 * Без ИИ — простые правила, чтобы работало мгновенно и офлайн.
 */
import { matchByName } from "./assistant-utils";
import type { TaskKind } from "./task-kinds";

export type QuickTask = {
  title: string;
  kind: TaskKind;
  subjectId: string | null;
  subjectName: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:MM
};

const KIND_WORDS: [RegExp, TaskKind][] = [
  [/^(лаба|лабу|лабы|лабе|лабораторн\p{L}*|лр)$/u, "LAB"],
  [/^(кр|контрольн\p{L}*|самостоятельн\p{L}*|коллоквиум\p{L}*)$/u, "TEST"],
  [/^(дз|домашк\p{L}*|домашн\p{L}*)$/u, "HOMEWORK"],
  [/^(чертёж|чертеж\p{L}*|чертёжи)$/u, "DRAWING"],
];

const WEEKDAYS: [RegExp, number][] = [
  [/^(пн|понедельник\p{L}*)$/u, 1],
  [/^(вт|вторник\p{L}*)$/u, 2],
  [/^(ср|сред\p{L}*)$/u, 3],
  [/^(чт|четверг\p{L}*)$/u, 4],
  [/^(пт|пятниц\p{L}*)$/u, 5],
  [/^(сб|суббот\p{L}*)$/u, 6],
  [/^(вс|воскресень\p{L}*)$/u, 0],
];

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

const STOP = new Set(["до", "к", "ко", "в", "во", "на", "по", "через", "срок", "сдать", "сдача"]);

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Дата без года: если она уже давно прошла — значит, следующий год */
function dayMonth(day: number, month: number, now: Date, year?: number) {
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  let y = year ?? now.getFullYear();
  if (year && year < 100) y = 2000 + year;
  let d = new Date(y, month, day);
  if (!year && d < addDays(now, -60)) d = new Date(y + 1, month, day);
  return d.getDate() === day ? d : null;
}

export function parseQuickTask(input: string, subjects: { id: string; name: string }[], now = new Date()): QuickTask {
  let text = ` ${input.trim()} `;
  let due: Date | null = null;
  let dueTime: string | null = null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cut = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // Время: «в 10:45», «10.45» после слова «в»
  const t = /\s(?:в\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)(?!\.\d)/u.exec(text);
  if (t && /:/.test(t[0])) {
    dueTime = `${pad(Number(t[1]))}:${t[2]}`;
    cut(new RegExp(t[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  // 5.11 / 05.11.2026 / 5/11
  const dm = /\s(?:(?:до|к|на)\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/u.exec(text);
  if (dm) {
    due = dayMonth(Number(dm[1]), Number(dm[2]) - 1, now, dm[3] ? Number(dm[3]) : undefined);
    if (due) cut(new RegExp(dm[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  // 5 ноября
  if (!due) {
    const m = /\s(?:(?:до|к|на)\s+)?(\d{1,2})\s+(\p{L}+)(?=\s)/u.exec(text);
    if (m) {
      const word = m[2].toLowerCase();
      const month = MONTHS.findIndex((p) => (p === "ма" ? /^ма[яй]$/u.test(word) : word.startsWith(p)));
      if (month >= 0) {
        due = dayMonth(Number(m[1]), month, now);
        if (due) cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
  }
  // сегодня / завтра / послезавтра
  if (!due) {
    const m = /\s(?:(?:до|к|на)\s+)?(сегодня|завтра|послезавтра)(?=\s)/iu.exec(text);
    if (m) {
      due = addDays(today, { сегодня: 0, завтра: 1, послезавтра: 2 }[m[1].toLowerCase() as "сегодня"]);
      cut(new RegExp(m[0]));
    }
  }
  // через 3 дня / через неделю / через 2 недели
  if (!due) {
    const m = /\sчерез\s+(\d+\s+)?(дн\p{L}*|день|недел\p{L}*)(?=\s)/iu.exec(text);
    if (m) {
      const n = m[1] ? Number(m[1]) : 1;
      due = addDays(today, /^д/iu.test(m[2]) ? n : n * 7);
      cut(new RegExp(m[0]));
    }
  }
  // в среду / к пятнице / до пн — ближайший такой день (сегодняшний — через неделю)
  if (!due) {
    const words = text.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      const wd = WEEKDAYS.find(([re]) => re.test(w));
      if (!wd) continue;
      let diff = (wd[1] - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      due = addDays(today, diff);
      const prev = words[i - 1]?.toLowerCase();
      words.splice(prev && STOP.has(prev) ? i - 1 : i, prev && STOP.has(prev) ? 2 : 1);
      text = ` ${words.join(" ")} `;
      break;
    }
  }

  // Тип и предмет — по словам
  const words = text.trim().split(/\s+/).filter(Boolean);
  let kind: TaskKind = "TASK";
  for (const w of words) {
    const k = KIND_WORDS.find(([re]) => re.test(w.toLowerCase()));
    if (k) {
      kind = k[1];
      break;
    }
  }
  let subject: { id: string; name: string } | null = null;
  const used = new Set<number>();
  // Сначала пары слов («мат анализ»), потом одиночные
  for (const size of [2, 1]) {
    if (subject) break;
    for (let i = 0; i + size <= words.length && !subject; i++) {
      const chunk = words.slice(i, i + size);
      if (chunk.some((w) => w.length < 3 || /\d/.test(w) || STOP.has(w.toLowerCase()) || KIND_WORDS.some(([re]) => re.test(w.toLowerCase())))) continue;
      const m = matchByName(subjects, chunk.join(" "));
      if (m && !Array.isArray(m)) {
        subject = m;
        for (let j = i; j < i + size; j++) used.add(j);
      }
    }
  }

  const rest = words.filter((w, i) => !used.has(i));
  // Висячие предлоги в конце («лаба 3 до») убираем
  while (rest.length && STOP.has(rest[rest.length - 1].toLowerCase())) rest.pop();
  let title = rest.join(" ").replace(/\s+([,.])/g, "$1").trim();
  // «кр» / «дз» без подробностей — полное название типа
  if (rest.length === 1 && KIND_WORDS.some(([re]) => re.test(rest[0].toLowerCase()))) title = "";
  if (!title) title = kind === "TASK" ? input.trim() : { LAB: "Лабораторная", TEST: "Контрольная", HOMEWORK: "Домашка", DRAWING: "Чертёж" }[kind];
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, kind, subjectId: subject?.id ?? null, subjectName: subject?.name ?? null, dueDate: due ? iso(due) : null, dueTime };
}
