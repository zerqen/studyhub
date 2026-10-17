import { addDays } from "date-fns";
import { prisma } from "./prisma";
import { getScheduleEvents } from "./queries";
import { expandEvents } from "./schedule";
import { dayKey } from "./utils";
import type { PushMessage } from "./webpush";

const OPEN = ["PLANNED", "IN_PROGRESS", "OVERDUE"];

function mskDay(offsetDays = 0, now = new Date()) {
  const start = addDays(new Date(`${dayKey(now)}T00:00:00+03:00`), offsetDays);
  return { start, end: addDays(start, 1), key: dayKey(addDays(now, offsetDays)) };
}

const time = (d: Date) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(d);

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

async function lessonsOn(userId: string, start: Date, end: Date) {
  const events = await getScheduleEvents(userId, start, end);
  return expandEvents(events, start, end).filter((e) => !e.allDay || e.kind === "EXAM");
}

/** Утренняя сводка: пары, повторение, задачи и ближайшие экзамены */
export async function morningDigest(userId: string, now = new Date()): Promise<PushMessage | null> {
  const today = mskDay(0, now);
  // Даты задач хранятся как полночь UTC — сравниваем по дню
  const dueFrom = new Date(`${today.key}T00:00:00.000Z`);
  const dueTo = addDays(dueFrom, 1);
  const [lessons, reviews, tasks, exams] = await Promise.all([
    lessonsOn(userId, today.start, today.end),
    prisma.question.count({ where: { userId, srsReps: { gt: 0 }, srsDue: { lt: today.end }, subject: { archived: false } } }),
    prisma.task.findMany({ where: { userId, status: { in: OPEN }, dueDate: { gte: dueFrom, lt: dueTo } }, select: { kind: true } }),
    prisma.subject.findMany({
      where: { userId, archived: false, examDate: { gte: today.start, lt: addDays(today.start, 4) } },
      select: { name: true, examDate: true },
      orderBy: { examDate: "asc" },
    }),
  ]);

  const lines: string[] = [];
  const first = lessons[0];
  if (first) {
    lines.push(`Первая — ${time(first.start)} ${first.subject?.name ?? first.title}${first.location ? ` (${first.location})` : ""}`);
  }
  const hw = tasks.filter((t) => t.kind === "HOMEWORK").length;
  const parts: string[] = [];
  if (hw) parts.push(`сдать ${plural(hw, "домашку", "домашки", "домашек")}`);
  if (tasks.length - hw) parts.push(plural(tasks.length - hw, "задача", "задачи", "задач"));
  if (reviews) parts.push(`${plural(reviews, "вопрос", "вопроса", "вопросов")} к повторению`);
  if (parts.length) lines.push(parts.join(" · "));
  for (const e of exams) {
    const days = Math.round((new Date(`${dayKey(e.examDate!)}T00:00:00Z`).getTime() - new Date(`${today.key}T00:00:00Z`).getTime()) / 86_400_000);
    lines.push(days === 0 ? `Сегодня экзамен: ${e.name}. Удачи!` : `Через ${plural(days, "день", "дня", "дней")} экзамен: ${e.name}`);
  }
  if (!lines.length) return null;

  const title = lessons.length ? `Сегодня ${plural(lessons.length, "пара", "пары", "пар")}` : "Доброе утро";
  return { title, body: lines.join("\n"), url: "/", tag: `morning-${today.key}` };
}

/** Вечернее напоминание: что сдавать завтра и сколько вопросов не повторено */
export async function eveningDigest(userId: string, now = new Date()): Promise<PushMessage | null> {
  const today = mskDay(0, now);
  const tomorrow = mskDay(1, now);
  const dueFrom = new Date(`${tomorrow.key}T00:00:00.000Z`);
  const dueTo = addDays(dueFrom, 1);
  const [tasks, lessons, exam, reviews, practicedToday] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { in: OPEN }, dueDate: { gte: dueFrom, lt: dueTo } },
      select: { title: true, kind: true, subject: { select: { name: true } } },
      orderBy: { dueTime: "asc" },
      take: 10,
    }),
    lessonsOn(userId, tomorrow.start, tomorrow.end),
    prisma.subject.findFirst({ where: { userId, archived: false, examDate: { gte: tomorrow.start, lt: tomorrow.end } }, select: { name: true } }),
    prisma.question.count({ where: { userId, srsReps: { gt: 0 }, srsDue: { lt: today.end }, subject: { archived: false } } }),
    prisma.questionAttempt.count({ where: { userId, createdAt: { gte: today.start } } }),
  ]);

  const lines: string[] = [];
  if (exam) lines.push(`Завтра экзамен: ${exam.name}`);
  const hw = tasks.filter((t) => t.kind === "HOMEWORK");
  for (const t of hw.slice(0, 3)) lines.push(`ДЗ${t.subject ? ` · ${t.subject.name}` : ""}: ${t.title}`);
  if (hw.length > 3) lines.push(`и ещё ${plural(hw.length - 3, "домашка", "домашки", "домашек")}`);
  const other = tasks.length - hw.length;
  if (other) lines.push(`${plural(other, "задача", "задачи", "задач")} на завтра`);
  if (reviews && !practicedToday) lines.push(`${plural(reviews, "вопрос ждёт", "вопроса ждут", "вопросов ждут")} повторения — 10 минут хватит`);
  if (!lines.length) return null;

  const first = lessons[0];
  const title = hw.length ? `На завтра ${plural(hw.length, "домашка", "домашки", "домашек")}` : exam ? "Завтра экзамен" : "Вечернее напоминание";
  if (first) lines.push(`Первая пара в ${time(first.start)}${first.location ? `, ${first.location}` : ""}`);
  return { title, body: lines.join("\n"), url: hw.length ? "/tasks" : "/review", tag: `evening-${today.key}` };
}

/** Тестовое уведомление: показывает, что пришло бы утром (или просто «работает») */
export async function testDigest(userId: string): Promise<PushMessage> {
  const m = await morningDigest(userId);
  return m ? { ...m, title: `Проверка · ${m.title}`, tag: "test" } : { title: "StudyHub", body: "Уведомления работают. Утром здесь будет сводка на день.", url: "/settings", tag: "test" };
}

