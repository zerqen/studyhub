import { prisma } from "./prisma";
import { subjectProgress, subtaskProgress } from "./progress";
import { refreshDeadlineNotifications } from "./notify";
import { startOfDay, addDays, endOfDay } from "date-fns";

export async function getDashboard(userId: string) {
  await refreshDeadlineNotifications(userId);
  const today = startOfDay(new Date());
  const [subjects, tasks, questions, notes, notifications] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, archived: false },
      include: { questions: true, tasks: true },
      orderBy: { examDate: "asc" },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      include: { subject: true, subtasks: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.question.findMany({ where: { userId } }),
    prisma.note.findMany({
      where: { userId, pinned: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "DONE",
  );
  const todayTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate >= today && t.dueDate < addDays(today, 1) && t.status !== "DONE",
  );
  const upcoming = tasks.filter(
    (t) => t.dueDate && t.dueDate >= addDays(today, 1) && t.status !== "DONE",
  ).slice(0, 8);
  const exams = subjects
    .filter((s) => s.examDate)
    .sort((a, b) => (a.examDate!.getTime() - b.examDate!.getTime()))
    .slice(0, 6);

  return {
    subjects: subjects.map((s) => ({
      ...s,
      progress: subjectProgress({ questions: s.questions, tasks: s.tasks }),
    })),
    overdue,
    todayTasks,
    upcoming,
    exams,
    notes,
    notifications,
    learnedQuestions: questions.filter((q) => q.status === "LEARNED").length,
    totalQuestions: questions.length,
    doneTasks: tasks.filter((t) => t.status === "DONE").length,
    totalTasks: tasks.length,
  };
}

export async function getCalendarData(userId: string, from: Date, to: Date) {
  const [tasks, subjects, events] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        OR: [{ dueDate: { gte: from, lte: to } }, { startDate: { gte: from, lte: to } }],
      },
      include: { subject: true },
    }),
    prisma.subject.findMany({
      where: { userId, examDate: { gte: from, lte: to } },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: from, lte: to } },
      include: { subject: true },
    }),
  ]);
  return { tasks, subjects, events };
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
