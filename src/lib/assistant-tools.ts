import { addDays } from "date-fns";
import { prisma } from "./prisma";
import { getScheduleEvents } from "./queries";
import { expandEvents, kindMeta, EVENT_KINDS } from "./schedule";
import { dayKey } from "./utils";
import { dueFields, nextLesson } from "./homework";
import { dueDay, dueText, isDate, isTime, matchByName, msk, pad, shortDay, timeOf } from "./assistant-utils";
import type { ToolSpec } from "./groq";
import { KIND_STAGES, TASK_KIND_VALUES, taskKind, type TaskKind } from "./task-kinds";

/**
 * Инструменты ассистента. Читающие выполняются сразу; изменяющие только готовят «предложение»,
 * которое пользователь подтверждает карточкой — данные меняются в applyProposal.
 */

export type ProposalItem = { label: string; detail?: string };
export type Proposal = { id: string; kind: "tasks" | "events" | "questions" | "task_updates" | "subject"; summary: string; items: ProposalItem[]; data: unknown };

export const READ_TOOLS = new Set(["get_deadlines", "get_schedule", "get_subject", "search"]);

const str = { type: "string" };
const date = { type: "string", description: "YYYY-MM-DD" };
const time = { type: "string", description: "HH:MM по Москве" };

export const TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_deadlines",
      description: "Открытые задачи и домашка со сроками (включая просроченные) и ближайшие экзамены. Для вопросов «что сдавать», «какие дедлайны», «что горит».",
      parameters: { type: "object", properties: { days: { type: "integer", description: "На сколько дней вперёд, по умолчанию 14" }, subject: str }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedule",
      description: "Пары и события в диапазоне дат (до 31 дня).",
      parameters: { type: "object", properties: { from: date, to: date, subject: str }, required: ["from", "to"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_subject",
      description: "Сводка по предмету: экзамен, преподаватель, вопросы (выучено/всего/к повторению), открытые задачи, лекции, пробные экзамены.",
      parameters: { type: "object", properties: { subject: str }, required: ["subject"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description: "Поиск по задачам, вопросам, заметкам и лекциям. Возвращает id задач — их можно передать в update_tasks.",
      parameters: { type: "object", properties: { query: str }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tasks",
      description: "Создать задачи или домашку (после подтверждения пользователем).",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: str,
                description: str,
                subject: str,
                type: { type: "string", enum: ["HOMEWORK", "LAB", "TEST", "DRAWING", "TASK"], description: "HOMEWORK — ДЗ, LAB — лабораторная, TEST — контрольная, DRAWING — чертёж, TASK — другое" },
                homework: { type: "boolean", description: "Это домашнее задание с пары (то же, что type=HOMEWORK)" },
                due_next_lesson: { type: "boolean", description: "Срок — следующая пара этого предмета (для домашки)" },
                due_date: date,
                due_time: time,
                priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                stages: { type: "array", items: str, description: "Этапы по порядку. Не передавай — для LAB/TEST/DRAWING подставится стандартный шаблон" },
              },
              required: ["title"],
            },
          },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_events",
      description: "Добавить пары или события в календарь (после подтверждения). Для расписания на семестр — repeat WEEKLY или BIWEEKLY.",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                subject: str,
                title: str,
                kind: { type: "string", enum: EVENT_KINDS.map((k) => k.value) },
                date: { ...date, description: "Дата (первого) занятия, YYYY-MM-DD" },
                start: time,
                end: time,
                location: str,
                repeat: { type: "string", enum: ["WEEKLY", "BIWEEKLY"] },
                until: { ...date, description: "До какой даты повторять" },
              },
              required: ["date"],
            },
          },
        },
        required: ["events"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_questions",
      description: "Добавить вопросы в предмет (после подтверждения). Формулировки пользователя — дословно. Ответы, которых нет, допишутся автоматически.",
      parameters: {
        type: "object",
        properties: {
          subject: str,
          lecture: { type: "string", description: "Номер или название лекции, если вопросы к ней" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: str,
                answer: str,
                kind: { type: "string", enum: ["THEORY", "PROBLEM"] },
                difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
                ticket: { type: "integer", description: "Номер билета" },
              },
              required: ["text"],
            },
          },
          fill_answers: { type: "boolean", description: "Дописать ответы ИИ, по умолчанию true" },
        },
        required: ["subject", "questions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks",
      description: "Отметить задачи выполненными, перенести срок и т.п. (после подтверждения). task_id берётся из get_deadlines или search.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: str,
                status: { type: "string", enum: ["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"] },
                due_date: date,
                due_time: time,
              },
              required: ["task_id"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_subject",
      description: "Изменить дату экзамена/зачёта или преподавателя предмета (после подтверждения).",
      parameters: { type: "object", properties: { subject: str, exam_date: date, exam_time: time, teacher: str }, required: ["subject"] },
    },
  },
];

type Subject = { id: string; name: string; examDate: Date | null; teacher: string | null; type: string };

export class ToolError extends Error {}

function resolve(subjects: Subject[], name: unknown, required = false): Subject | null {
  if (typeof name !== "string" || !name.trim()) {
    if (required) throw new ToolError("Не указан предмет");
    return null;
  }
  const m = matchByName(subjects, name);
  if (!m) throw new ToolError(`Предмет «${name}» не найден. Есть: ${subjects.map((s) => s.name).join("; ")}`);
  if (Array.isArray(m)) throw new ToolError(`«${name}» подходит к нескольким предметам: ${m.map((s) => s.name).join("; ")}. Уточни у пользователя.`);
  return m;
}

const OPEN = ["PLANNED", "IN_PROGRESS", "OVERDUE"];
const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ── Чтение ─────────────────────────────────────────────────────────────────

export async function runReadTool(userId: string, subjects: Subject[], name: string, a: Record<string, unknown>) {
  const now = new Date();
  if (name === "get_deadlines") {
    const days = Math.max(1, Math.min(120, Number(a.days) || 14));
    const subject = resolve(subjects, a.subject);
    const until = addDays(new Date(`${dayKey(now)}T00:00:00.000Z`), days + 1);
    const [tasks, noDate] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { in: OPEN }, dueDate: { lt: until }, ...(subject ? { subjectId: subject.id } : {}) },
        select: { id: true, title: true, dueDate: true, dueTime: true, kind: true, status: true, priority: true, subject: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }],
        take: 40,
      }),
      prisma.task.count({ where: { userId, status: { in: OPEN }, dueDate: null, ...(subject ? { subjectId: subject.id } : {}) } }),
    ]);
    const today = new Date(`${dayKey(now)}T00:00:00.000Z`);
    const exams = subjects
      .filter((s) => s.examDate && s.examDate >= addDays(now, -1) && s.examDate <= addDays(now, Math.max(days, 30)) && (!subject || s.id === subject.id))
      .sort((x, y) => x.examDate!.getTime() - y.examDate!.getTime())
      .map((s) => ({ subject: s.name, type: s.type === "EXAM" ? "экзамен" : "зачёт", date: `${shortDay(s.examDate!)} ${timeOf(s.examDate!)}` }));
    return {
      today: shortDay(now),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: short(t.title),
        subject: t.subject?.name,
        due: dueText(t.dueDate, t.dueTime),
        overdue: t.dueDate! < today || undefined,
        type: t.kind && t.kind !== "TASK" ? taskKind(t.kind).full : undefined,
        priority: t.priority === "HIGH" || t.priority === "CRITICAL" ? t.priority : undefined,
        status: t.status === "IN_PROGRESS" ? "в процессе" : undefined,
      })),
      exams,
      tasksWithoutDate: noDate,
    };
  }

  if (name === "get_schedule") {
    if (!isDate(a.from) || !isDate(a.to)) throw new ToolError("from и to — даты YYYY-MM-DD");
    const from = msk(a.from);
    let to = addDays(msk(a.to), 1);
    if (to.getTime() - from.getTime() > 31 * 86_400_000) to = addDays(from, 31);
    const subject = resolve(subjects, a.subject);
    const events = await getScheduleEvents(userId, from, to);
    const list = expandEvents(events, from, to).filter((e) => !subject || e.subjectId === subject.id);
    return {
      lessons: list.slice(0, 90).map((e) => ({
        day: shortDay(e.start),
        time: e.allDay ? "весь день" : `${timeOf(e.start)}${e.end ? `–${timeOf(e.end)}` : ""}`,
        title: short(e.title, 80),
        kind: kindMeta(e.kind).label,
        location: e.location ?? undefined,
        teacher: e.description?.split("\n").slice(1).join(", ") || undefined,
      })),
      truncated: list.length > 90 || undefined,
    };
  }

  if (name === "get_subject") {
    const s = resolve(subjects, a.subject, true)!;
    const [byStatus, due, tasks, lectures, exams] = await Promise.all([
      prisma.question.groupBy({ by: ["status"], where: { userId, subjectId: s.id }, _count: { _all: true } }),
      prisma.question.count({ where: { userId, subjectId: s.id, srsReps: { gt: 0 }, srsDue: { lte: now } } }),
      prisma.task.findMany({
        where: { userId, subjectId: s.id, status: { in: OPEN } },
        select: { id: true, title: true, dueDate: true, dueTime: true, kind: true },
        orderBy: { dueDate: "asc" },
        take: 15,
      }),
      prisma.lecture.count({ where: { userId, subjectId: s.id } }),
      prisma.examSession.findMany({ where: { userId, subjectId: s.id, phase: "DONE" }, select: { grade: true, startedAt: true }, orderBy: { startedAt: "desc" }, take: 5 }),
    ]);
    const count = (st: string) => byStatus.find((b) => b.status === st)?._count._all ?? 0;
    const total = byStatus.reduce((x, b) => x + b._count._all, 0);
    return {
      subject: s.name,
      type: s.type === "EXAM" ? "экзамен" : s.type === "CREDIT" ? "зачёт" : s.type,
      examDate: s.examDate ? `${shortDay(s.examDate)} ${timeOf(s.examDate)}` : null,
      teacher: s.teacher,
      questions: { total, learned: count("LEARNED"), inProgress: count("IN_PROGRESS"), needReview: count("REVIEW"), notStarted: count("UNLEARNED"), dueForReviewNow: due },
      openTasks: tasks.map((t) => ({ id: t.id, title: short(t.title), due: dueText(t.dueDate, t.dueTime), type: t.kind && t.kind !== "TASK" ? taskKind(t.kind).full : undefined })),
      lectures,
      mockExams: exams.map((e) => ({ grade: e.grade, date: shortDay(e.startedAt) })),
    };
  }

  if (name === "search") {
    const q = String(a.query ?? "").trim();
    if (q.length < 2) throw new ToolError("Слишком короткий запрос");
    const contains = { contains: q, mode: "insensitive" as const };
    const [tasks, questions, notes, lectures] = await Promise.all([
      prisma.task.findMany({
        where: { userId, OR: [{ title: contains }, { description: contains }] },
        select: { id: true, title: true, status: true, dueDate: true, dueTime: true, subject: { select: { name: true } } },
        take: 10,
      }),
      prisma.question.findMany({ where: { userId, OR: [{ text: contains }, { answer: contains }] }, select: { text: true, status: true, subject: { select: { name: true } } }, take: 8 }),
      prisma.note.findMany({ where: { userId, OR: [{ title: contains }, { content: contains }] }, select: { title: true, content: true }, take: 5 }),
      prisma.lecture.findMany({ where: { userId, OR: [{ title: contains }, { summary: contains }] }, select: { number: true, title: true, subject: { select: { name: true } } }, take: 5 }),
    ]);
    return {
      tasks: tasks.map((t) => ({ id: t.id, title: short(t.title), subject: t.subject?.name, status: t.status, due: dueText(t.dueDate, t.dueTime) })),
      questions: questions.map((x) => ({ text: short(x.text), subject: x.subject.name, status: x.status })),
      notes: notes.map((n) => ({ title: n.title, excerpt: short(n.content, 200) })),
      lectures: lectures.map((l) => ({ subject: l.subject.name, number: l.number, title: l.title })),
    };
  }
  throw new ToolError(`Неизвестный инструмент ${name}`);
}

// ── Предложения изменений ────────────────────────────────────────────────────

export type TaskDraft = { title: string; description: string | null; subjectId: string | null; kind: string; lessonAt: string | null; dueDate: string | null; dueTime: string | null; priority: string; stages: string[] };
export type EventDraft = { title: string; subjectId: string | null; kind: string; startAt: string; endAt: string | null; allDay: boolean; location: string | null; recurrence: string | null; repeatUntil: string | null };
export type QuestionDraft = { text: string; answer: string | null; kind: string; difficulty: string; ticketNo: number | null };
export type QuestionsData = { subjectId: string; lectureId: string | null; questions: QuestionDraft[]; fillAnswers: boolean };
export type TaskUpdate = { id: string; status?: string; dueDate?: string; dueTime?: string | null };
export type SubjectUpdate = { id: string; examDate?: string; teacher?: string };

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUS_LABEL: Record<string, string> = { PLANNED: "в план", IN_PROGRESS: "в процессе", DONE: "выполнено", CANCELLED: "отменено" };
const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

let seq = 0;
const pid = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function buildProposal(userId: string, subjects: Subject[], name: string, a: Record<string, unknown>): Promise<Proposal> {
  const now = new Date();

  if (name === "create_tasks") {
    const list = arr(a.tasks).slice(0, 30);
    if (!list.length) throw new ToolError("Пустой список задач");
    const drafts: TaskDraft[] = [];
    const items: ProposalItem[] = [];
    for (const t of list) {
      const title = txt(t.title, 200);
      if (!title) throw new ToolError("У задачи нет названия");
      const subject = resolve(subjects, t.subject);
      const type = (TASK_KIND_VALUES as readonly string[]).includes(String(t.type)) ? (String(t.type) as TaskKind) : t.homework ? "HOMEWORK" : "TASK";
      const homework = type === "HOMEWORK";
      let dueDate: string | null = null;
      let dueTime: string | null = isTime(t.due_time) ? pad(t.due_time) : null;
      let lessonAt: string | null = null;
      let note = "";
      if (subject && (homework || t.due_next_lesson)) {
        const from = addDays(now, -1);
        const to = addDays(now, 120);
        const occ = expandEvents(await getScheduleEvents(userId, from, to), from, to).filter((o) => o.subjectId === subject.id && !["EXAM", "CONSULT"].includes(o.kind));
        // Пара, на которой задали: последняя начавшаяся сегодня
        const todays = occ.filter((o) => dayKey(o.start) === dayKey(now) && o.start <= now);
        const lesson = todays[todays.length - 1] ?? null;
        lessonAt = lesson ? lesson.start.toISOString() : null;
        if (t.due_next_lesson && !isDate(t.due_date)) {
          const next = nextLesson(occ, subject.id, lesson?.start ?? now);
          if (next) {
            const f = dueFields(next.start);
            dueDate = f.dueDate.toISOString();
            dueTime = f.dueTime;
            note = ` (${kindMeta(next.kind).label.toLowerCase()})`;
          } else note = " (следующей пары нет в расписании)";
        }
      }
      if (isDate(t.due_date)) dueDate = dueDay(t.due_date).toISOString();
      const priority = PRIORITIES.includes(String(t.priority)) ? String(t.priority) : "MEDIUM";
      const given = arr(t.stages as unknown).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 10);
      const stages = given.length ? given : (KIND_STAGES[type] ?? []);
      drafts.push({ title, description: txt(t.description, 4000) || null, subjectId: subject?.id ?? null, kind: type, lessonAt, dueDate, dueTime, priority, stages });
      items.push({
        label: `${type !== "TASK" ? `${taskKind(type).label} · ` : ""}${subject ? `${subject.name} — ` : ""}${title}`,
        detail: [`срок: ${dueText(dueDate, dueTime)}${note}`, priority !== "MEDIUM" ? `приоритет ${priority.toLowerCase()}` : "", stages.length ? `этапы: ${stages.join(" → ")}` : ""].filter(Boolean).join(" · "),
      });
    }
    return { id: pid(), kind: "tasks", summary: drafts.length === 1 ? "Добавить задачу" : `Добавить задачи (${drafts.length})`, items, data: drafts };
  }

  if (name === "create_events") {
    const list = arr(a.events).slice(0, 40);
    if (!list.length) throw new ToolError("Пустой список событий");
    const drafts: EventDraft[] = [];
    const items: ProposalItem[] = [];
    for (const e of list) {
      if (!isDate(e.date)) throw new ToolError("У события нет даты YYYY-MM-DD");
      const subject = resolve(subjects, e.subject);
      const kind = EVENT_KINDS.some((k) => k.value === e.kind) ? String(e.kind) : subject ? "LECTURE" : "OTHER";
      const allDay = !isTime(e.start);
      const startAt = allDay ? msk(e.date) : msk(e.date, e.start as string);
      const endAt = !allDay && isTime(e.end) ? msk(e.date, e.end) : null;
      const recurrence = e.repeat === "WEEKLY" || e.repeat === "BIWEEKLY" ? e.repeat : null;
      const repeatUntil = recurrence && isDate(e.until) ? msk(e.until, "23:59") : null;
      const title = txt(e.title, 200) || (subject ? `${kindMeta(kind).label}: ${subject.name}` : kindMeta(kind).label);
      drafts.push({
        title,
        subjectId: subject?.id ?? null,
        kind,
        startAt: startAt.toISOString(),
        endAt: endAt?.toISOString() ?? null,
        allDay,
        location: txt(e.location, 120) || null,
        recurrence,
        repeatUntil: repeatUntil?.toISOString() ?? null,
      });
      items.push({
        label: title,
        detail: [
          `${shortDay(startAt)}${allDay ? "" : ` ${timeOf(startAt)}${endAt ? `–${timeOf(endAt)}` : ""}`}`,
          kindMeta(kind).label.toLowerCase(),
          e.location ? String(e.location) : "",
          recurrence ? `${recurrence === "WEEKLY" ? "каждую неделю" : "через неделю"}${repeatUntil ? ` до ${shortDay(repeatUntil)}` : ""}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    return { id: pid(), kind: "events", summary: drafts.length === 1 ? "Добавить в календарь" : `Добавить в календарь (${drafts.length})`, items, data: drafts };
  }

  if (name === "add_questions") {
    const subject = resolve(subjects, a.subject, true)!;
    let lectureId: string | null = null;
    let lectureLabel = "";
    if (typeof a.lecture === "string" || typeof a.lecture === "number") {
      const lectures = await prisma.lecture.findMany({ where: { userId, subjectId: subject.id }, select: { id: true, number: true, title: true } });
      const n = Number(a.lecture);
      const byNumber = Number.isInteger(n) ? lectures.find((l) => l.number === n) : undefined;
      const byName = byNumber ?? (() => {
        const m = matchByName(lectures.map((l) => ({ ...l, name: l.title })), String(a.lecture));
        return m && !Array.isArray(m) ? m : undefined;
      })();
      if (!byName) throw new ToolError(`Лекция «${a.lecture}» не найдена в предмете ${subject.name}`);
      lectureId = byName.id;
      lectureLabel = ` · лекция ${byName.number ?? ""} «${byName.title}»`;
    }
    const qs: QuestionDraft[] = arr(a.questions)
      .slice(0, 150)
      .map((q) => ({
        text: txt(q.text, 4000).replace(/^\s*(?:\d{1,3}[.)]|[-•*])\s+/, ""),
        answer: txt(q.answer, 8000) || null,
        kind: q.kind === "PROBLEM" ? "PROBLEM" : "THEORY",
        difficulty: q.difficulty === "EASY" || q.difficulty === "HARD" ? String(q.difficulty) : "MEDIUM",
        ticketNo: Number.isInteger(Number(q.ticket)) && Number(q.ticket) > 0 && Number(q.ticket) < 1000 ? Number(q.ticket) : null,
      }))
      .filter((q) => q.text.length >= 3);
    if (!qs.length) throw new ToolError("Нет вопросов");
    const fill = a.fill_answers !== false;
    const missing = qs.filter((q) => !q.answer).length;
    return {
      id: pid(),
      kind: "questions",
      summary: `Добавить ${qs.length} вопр. в «${subject.name}»${lectureLabel}`,
      items: qs.map((q) => ({
        label: q.text,
        detail: [q.kind === "PROBLEM" ? "задача" : "", q.ticketNo ? `билет ${q.ticketNo}` : "", q.answer ? "с ответом" : fill ? "ответ допишет ИИ" : "без ответа"].filter(Boolean).join(" · "),
      })),
      data: { subjectId: subject.id, lectureId, questions: qs, fillAnswers: fill && missing > 0 } satisfies QuestionsData,
    };
  }

  if (name === "update_tasks") {
    const list = arr(a.updates).slice(0, 30);
    const ids = list.map((u) => String(u.task_id ?? ""));
    const tasks = await prisma.task.findMany({ where: { userId, id: { in: ids } }, select: { id: true, title: true, dueDate: true, dueTime: true } });
    type Row = { id: string; title: string; dueDate: Date | null; dueTime: string | null };
    const byId = new Map<string, Row>(tasks.map((t: Row): [string, Row] => [t.id, t]));
    const updates: TaskUpdate[] = [];
    const items: ProposalItem[] = [];
    for (const u of list) {
      const t = byId.get(String(u.task_id ?? ""));
      if (!t) throw new ToolError(`Задача ${u.task_id} не найдена — найди id через get_deadlines или search`);
      const upd: TaskUpdate = { id: t.id };
      const parts: string[] = [];
      if (typeof u.status === "string" && STATUS_LABEL[u.status]) {
        upd.status = u.status;
        parts.push(STATUS_LABEL[u.status]);
      }
      if (isDate(u.due_date)) {
        upd.dueDate = dueDay(u.due_date).toISOString();
        upd.dueTime = isTime(u.due_time) ? pad(u.due_time) : null;
        parts.push(`срок ${dueText(t.dueDate, t.dueTime)} → ${dueText(upd.dueDate, upd.dueTime)}`);
      }
      if (!parts.length) throw new ToolError("Нечего менять");
      updates.push(upd);
      items.push({ label: t.title, detail: parts.join(" · ") });
    }
    if (!updates.length) throw new ToolError("Пустой список");
    return { id: pid(), kind: "task_updates", summary: updates.length === 1 ? "Изменить задачу" : `Изменить задачи (${updates.length})`, items, data: updates };
  }

  if (name === "update_subject") {
    const s = resolve(subjects, a.subject, true)!;
    const upd: SubjectUpdate = { id: s.id };
    const items: ProposalItem[] = [];
    if (isDate(a.exam_date)) {
      const d = msk(a.exam_date, isTime(a.exam_time) ? a.exam_time : "09:00");
      upd.examDate = d.toISOString();
      items.push({ label: s.type === "EXAM" ? "Дата экзамена" : "Дата зачёта", detail: `${s.examDate ? `${shortDay(s.examDate)} → ` : ""}${shortDay(d)} ${timeOf(d)}` });
    }
    if (txt(a.teacher, 120)) {
      upd.teacher = txt(a.teacher, 120);
      items.push({ label: "Преподаватель", detail: upd.teacher });
    }
    if (!items.length) throw new ToolError("Нечего менять");
    return { id: pid(), kind: "subject", summary: `Изменить «${s.name}»`, items, data: upd };
  }

  throw new ToolError(`Неизвестный инструмент ${name}`);
}
