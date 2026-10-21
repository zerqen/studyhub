import { prisma } from "./prisma";
import { subjectProgress, subtaskProgress } from "./progress";
import { startOfDay, addDays, endOfDay } from "date-fns";
import { expandEvents } from "./schedule";
import { dayKey } from "./utils";

export async function getDashboard(userId: string) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  // Только нужные поля — раньше сюда тянулись все вопросы и задачи целиком
  const now = new Date();
  // Границы «сегодня» по Москве — сервер Vercel живёт в UTC
  const mskStart = new Date(`${dayKey(now)}T00:00:00+03:00`);
  const mskEnd = addDays(mskStart, 1);
  const [subjects, tasks, questionCounts, notes, dueCount, newCount, events, activity, recentTopics] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, archived: false, selfStudy: false },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        examDate: true,
        type: true,
        questions: { select: { status: true } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ examDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        dueTime: true,
        kind: true,
        subjectId: true,
        lessonAt: true,
        subject: { select: { name: true, color: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.question.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.note.findMany({
      where: { userId, pinned: true },
      select: { id: true, title: true, content: true, color: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.question.count({ where: { userId, srsReps: { gt: 0 }, srsDue: { lte: now } } }),
    prisma.question.count({ where: { userId, srsReps: 0 } }),
    getScheduleEvents(userId, mskStart, mskEnd),
    getActivity(userId, 140),
    // «Изучаю»: последние темы саморазвития — без счётчиков и целей
    prisma.lecture.findMany({
      where: { userId, subject: { selfStudy: true, archived: false } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, title: true, updatedAt: true, subject: { select: { name: true, emoji: true, color: true } } },
    }),
  ]);

  const open = tasks.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const todayTasks = open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
  const upcoming = open.filter((t) => t.dueDate && t.dueDate >= tomorrow).slice(0, 6);
  const exams = subjects.filter((s) => s.examDate && s.examDate >= today).slice(0, 4);

  const totalQuestions = questionCounts.reduce((a, c) => a + c._count._all, 0);
  const learnedQuestions = questionCounts.find((c) => c.status === "LEARNED")?._count._all ?? 0;
  const reviewQuestions = questionCounts.find((c) => c.status === "REVIEW")?._count._all ?? 0;

  return {
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji,
      color: s.color,
      examDate: s.examDate,
      questionsTotal: s.questions.length,
      questionsLeft: s.questions.filter((q) => q.status !== "LEARNED").length,
      progress: subjectProgress({ questions: s.questions, tasks: s.tasks }),
    })),
    overdue,
    todayTasks,
    upcoming,
    exams,
    notes,
    learnedQuestions,
    reviewQuestions,
    dueCount,
    newCount,
    todayEvents: expandEvents(events, mskStart, mskEnd),
    // Домашка — для пометок «сдать ДЗ» у сегодняшних пар
    homework: tasks
      .filter((t) => t.kind === "HOMEWORK" && ((t.dueDate && t.dueDate >= addDays(mskStart, -1) && t.dueDate < mskEnd) || (t.lessonAt && t.lessonAt >= mskStart && t.lessonAt < mskEnd)))
      .map((t) => ({ id: t.id, title: t.title, status: t.status, subjectId: t.subjectId, dueDate: t.dueDate?.toISOString() ?? null, dueTime: t.dueTime, lessonAt: t.lessonAt?.toISOString() ?? null })),
    activity,
    recentTopics,
    totalQuestions,
    doneTasks: tasks.filter((t) => t.status === "DONE").length,
    totalTasks: tasks.length,
  };
}

export async function getCalendarData(userId: string, from: Date, to: Date) {
  const [tasks, subjects] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        OR: [{ dueDate: { gte: from, lte: to } }, { startDate: { gte: from, lte: to } }, { lessonAt: { gte: from, lte: to } }],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        dueTime: true,
        kind: true,
        lessonAt: true,
        priority: true,
        status: true,
        subjectId: true,
        subject: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.subject.findMany({
      where: { userId, examDate: { gte: from, lte: to } },
      select: { id: true, name: true, color: true, examDate: true },
    }),
  ]);
  return { tasks, subjects };
}

export function withSubtaskTree<T extends { id: string; parentId: string | null }>(items: T[]) {
  return {
    items,
    progress: subtaskProgress(items.map((i) => ({ ...i, status: (i as unknown as { status: string }).status }))),
  };
}

export async function getAchievements(userId: string) {
  const [subjects, questions, tasks] = await Promise.all([
    prisma.subject.count({ where: { userId } }),
    prisma.question.count({ where: { userId, status: "LEARNED" } }),
    prisma.task.count({ where: { userId, status: "DONE" } }),
  ]);
  return [
    { id: "first-subject", title: "Первый предмет", done: subjects >= 1 },
    { id: "five-subjects", title: "Пять предметов", done: subjects >= 5 },
    { id: "ten-q", title: "10 выученных вопросов", done: questions >= 10 },
    { id: "fifty-q", title: "50 выученных вопросов", done: questions >= 50 },
    { id: "five-tasks", title: "5 выполненных задач", done: tasks >= 5 },
    { id: "twenty-tasks", title: "20 выполненных задач", done: tasks >= 20 },
  ];
}

export { endOfDay };

/** События, которые могут попасть в интервал (с учётом повторяющихся) */
export function getScheduleEvents(userId: string, from: Date, to: Date) {
  return prisma.calendarEvent.findMany({
    where: {
      userId,
      startAt: { lte: to },
      OR: [{ startAt: { gte: from } }, { recurrence: { not: null }, OR: [{ repeatUntil: null }, { repeatUntil: { gte: from } }] }],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      allDay: true,
      color: true,
      kind: true,
      location: true,
      recurrence: true,
      repeatUntil: true,
      subjectId: true,
      description: true,
      externalId: true,
      subject: { select: { name: true, color: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

/** Активность по дням: ответы на карточки + закрытые задачи */
export async function getActivity(userId: string, days: number) {
  const from = startOfDay(addDays(new Date(), -days + 1));
  const [attempts, logs] = await Promise.all([
    prisma.questionAttempt.findMany({ where: { userId, createdAt: { gte: from } }, select: { createdAt: true } }),
    prisma.progressLog.findMany({
      where: { userId, createdAt: { gte: from }, type: { notIn: ["QUESTION_KNOWN", "QUESTION_UNKNOWN"] } },
      select: { createdAt: true },
    }),
  ]);
  const counts: Record<string, number> = {};
  for (const r of [...attempts, ...logs]) {
    const key = dayKey(r.createdAt);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return { from: from.toISOString(), days, counts };
}
