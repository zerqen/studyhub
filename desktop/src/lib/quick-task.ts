import type { SubjectDto, TaskKind } from "../../electron/types";
import { addDays, formatDueBadge, toDateOnlyIso, todayLocalDate } from "./date";

export interface QuickTaskParsed {
  title: string;
  kind: TaskKind;
  subjectId: string | null;
  subjectName: string | null;
  dueDateIso: string | null;
  dueDateLabel: string | null;
  dueTime: string | null;
}

const KIND_WORDS: [RegExp, TaskKind][] = [
  [/^(лаба|лабу|лабы|лабе|лабораторн\p{L}*|лр)$/iu, "LAB"],
  [/^(кр|контрольн\p{L}*|самостоятельн\p{L}*|коллоквиум\p{L}*)$/iu, "TEST"],
  [/^(дз|домашк\p{L}*|домашн\p{L}*)$/iu, "HOMEWORK"],
  [/^(чертёж|чертеж\p{L}*|чертёжи)$/iu, "DRAWING"],
];

const WEEKDAYS: [RegExp, number][] = [
  [/^(пн|понедельник\p{L}*)$/iu, 1],
  [/^(вт|вторник\p{L}*)$/iu, 2],
  [/^(ср|сред\p{L}*)$/iu, 3],
  [/^(чт|четверг\p{L}*)$/iu, 4],
  [/^(пт|пятниц\p{L}*)$/iu, 5],
  [/^(сб|суббот\p{L}*)$/iu, 6],
  [/^(вс|воскресень\p{L}*)$/iu, 0],
];

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const STOP = new Set(["до", "к", "ко", "в", "во", "на", "по", "через", "срок", "сдать", "сдача"]);

const SUBJECT_ALIASES: [RegExp, string][] = [
  [/^(матан|матанализ|матанал\p{L}*)$/iu, "математический анализ"],
  [/^(линал|линейка|алгебра)$/iu, "линейная алгебра"],
  [/^(физра|физкультура)$/iu, "физическая культура"],
  [/^(англ|английский|инглиш)$/iu, "иностранный язык"],
  [/^(информатика|инф|ит)$/iu, "информационные технологии"],
  [/^история$/iu, "история"],
  [/^(начерт|инженерка)$/iu, "инженерная графика"],
];

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{Nd}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function matchSubject(subjects: SubjectDto[], query: string): SubjectDto | null {
  const q = normalizeName(query);
  if (q.length < 2) return null;
  const norm = subjects.map((s) => ({ s, n: normalizeName(s.name) }));
  const exact = norm.filter((x) => x.n === q);
  if (exact.length === 1) return exact[0].s;

  const alias = SUBJECT_ALIASES.find(([re]) => re.test(q))?.[1];
  const candidates = alias ? [q, alias] : [q];
  for (const c of candidates) {
    const inc = norm.filter((x) => x.n.includes(c) || (c.length >= 4 && c.includes(x.n)));
    if (inc.length === 1) return inc[0].s;
    if (inc.length > 1) {
      const starts = inc.filter((x) => x.n.startsWith(c));
      if (starts.length === 1) return starts[0].s;
      return null;
    }
  }

  const words = q.split(" ").filter((w) => w.length >= 3);
  if (!words.length) return null;
  const scored = norm
    .map((x) => {
      const target = x.n.split(" ");
      const hit = words.filter((w) =>
        target.some((t) => t.startsWith(w) || commonPrefix(w, t) >= Math.max(4, Math.min(w.length, t.length) - 2)),
      ).length;
      return { s: x.s, score: hit / words.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  return scored.length === 1 || scored[0].score > scored[1].score ? scored[0].s : null;
}

function dayMonth(day: number, monthOneBased: number, today: Date, yearRaw?: number): Date | null {
  if (day < 1 || day > 31 || monthOneBased < 1 || monthOneBased > 12) return null;
  let y = yearRaw ?? today.getFullYear();
  if (yearRaw != null && yearRaw < 100) y += 2000;
  let d = new Date(y, monthOneBased - 1, day);
  if (d.getMonth() !== monthOneBased - 1 || d.getDate() !== day) return null;
  if (yearRaw == null && d < addDays(today, -60)) {
    d = new Date(y + 1, monthOneBased - 1, day);
  }
  return d;
}

const KIND_LABELS: Record<TaskKind, string> = {
  LAB: "Лабораторная",
  TEST: "Контрольная",
  HOMEWORK: "Домашка",
  DRAWING: "Чертёж",
  TASK: "Задача",
};

export function parseQuickTask(input: string, subjects: SubjectDto[], todayInput = todayLocalDate()): QuickTaskParsed {
  const today = todayLocalDate(todayInput);
  let text = ` ${input.trim()} `;
  let due: Date | null = null;
  let dueTime: string | null = null;

  const t = /\s(?:в\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i.exec(text);
  if (t) {
    dueTime = `${String(Number(t[1])).padStart(2, "0")}:${t[2]}`;
    text = text.replace(t[0], " ");
  }

  const dm = /\s(?:(?:до|к|на)\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/i.exec(text);
  if (dm) {
    const parsed = dayMonth(Number(dm[1]), Number(dm[2]), today, dm[3] ? Number(dm[3]) : undefined);
    if (parsed) {
      due = parsed;
      text = text.replace(dm[0], " ");
    }
  }

  if (!due) {
    const m = /\s(?:(?:до|к|на)\s+)?(\d{1,2})\s+(\p{L}+)(?=\s)/u.exec(text);
    if (m) {
      const word = m[2].toLowerCase();
      const idx = MONTHS.findIndex((p) => (p === "ма" ? /^ма[яй]$/i.test(word) : word.startsWith(p)));
      if (idx >= 0) {
        const parsed = dayMonth(Number(m[1]), idx + 1, today);
        if (parsed) {
          due = parsed;
          text = text.replace(m[0], " ");
        }
      }
    }
  }

  if (!due) {
    const m = /\s(?:(?:до|к|на)\s+)?(сегодня|завтра|послезавтра)(?=\s)/iu.exec(text);
    if (m) {
      const k = m[1].toLowerCase();
      due = addDays(today, k === "сегодня" ? 0 : k === "завтра" ? 1 : 2);
      text = text.replace(m[0], " ");
    }
  }

  if (!due) {
    const m = /\sчерез\s+(?:(\d+)\s+)?(дн\p{L}*|день|недел\p{L}*)(?=\s)/iu.exec(text);
    if (m) {
      const n = m[1] ? Number(m[1]) : 1;
      due = addDays(today, /^д/i.test(m[2]) ? n : n * 7);
      text = text.replace(m[0], " ");
    }
  }

  if (!due) {
    const wordsMut = text.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < wordsMut.length; i++) {
      const w = wordsMut[i].toLowerCase();
      const wd = WEEKDAYS.find(([re]) => re.test(w));
      if (!wd) continue;
      let diff = (wd[1] - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      due = addDays(today, diff);
      const prev = wordsMut[i - 1]?.toLowerCase();
      if (prev && STOP.has(prev)) {
        wordsMut.splice(i - 1, 2);
      } else {
        wordsMut.splice(i, 1);
      }
      text = ` ${wordsMut.join(" ")} `;
      break;
    }
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  let kind: TaskKind = "TASK";
  for (const w of words) {
    const k = KIND_WORDS.find(([re]) => re.test(w.toLowerCase()));
    if (k) {
      kind = k[1];
      break;
    }
  }

  let subject: SubjectDto | null = null;
  const used = new Set<number>();
  for (const size of [2, 1]) {
    if (subject) break;
    for (let i = 0; i + size <= words.length && !subject; i++) {
      const chunk = words.slice(i, i + size);
      const skip = chunk.some(
        (w) =>
          w.length < 3 ||
          /\d/.test(w) ||
          STOP.has(w.toLowerCase()) ||
          KIND_WORDS.some(([re]) => re.test(w.toLowerCase())),
      );
      if (skip) continue;
      const m = matchSubject(subjects, chunk.join(" "));
      if (m) {
        subject = m;
        for (let j = i; j < i + size; j++) used.add(j);
      }
    }
  }

  const rest = words.filter((_, i) => !used.has(i));
  while (rest.length > 0 && STOP.has(rest[rest.length - 1].toLowerCase())) rest.pop();

  let title = rest.join(" ").replace(/\s+([,.])/g, "$1").trim();
  if (rest.length === 1 && KIND_WORDS.some(([re]) => re.test(rest[0].toLowerCase()))) title = "";
  if (!title) title = kind === "TASK" ? input.trim() : KIND_LABELS[kind];
  title = title ? title.charAt(0).toUpperCase() + title.slice(1) : "";

  const dueDateIso = due ? `${toDateOnlyIso(due)}T00:00:00.000Z` : null;
  const dueDateLabel = dueDateIso ? formatDueBadge(dueDateIso, dueTime, today).label : dueTime;

  return {
    title,
    kind,
    subjectId: subject?.id ?? null,
    subjectName: subject?.name ?? null,
    dueDateIso,
    dueDateLabel,
    dueTime,
  };
}
