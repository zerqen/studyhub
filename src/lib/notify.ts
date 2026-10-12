import { prisma } from "./prisma";
import { startOfDay, addDays } from "date-fns";

export async function refreshDeadlineNotifications(userId: string) {
  const today = startOfDay(new Date());
  const soon = addDays(today, 3);

  const overdue = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["PLANNED", "IN_PROGRESS", "OVERDUE"] },
      dueDate: { lt: today },
    },
    take: 20,
  });

  const todayTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
      dueDate: { gte: today, lt: addDays(today, 1) },
    },
    take: 20,
  });

  const exams = await prisma.subject.findMany({
    where: { userId, archived: false, examDate: { gte: today, lte: soon } },
  });

  await prisma.task.updateMany({
    where: {
      userId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
      dueDate: { lt: today },
    },
    data: { status: "OVERDUE" },
  });

  const existing = await prisma.notification.findMany({
    where: { userId, createdAt: { gte: today } },
    select: { title: true, href: true },
  });
  const seen = new Set(existing.map((n) => `${n.title}|${n.href ?? ""}`));

  const rows = [
    ...overdue.map((t) => ({
      title: "Просроченная задача",
      body: t.title,
      href: `/tasks?open=${t.id}`,
      kind: "danger",
    })),
    ...todayTasks.map((t) => ({
      title: "Задача на сегодня",
      body: t.title,
      href: `/tasks?open=${t.id}`,
      kind: "today",
    })),
    ...exams.map((s) => ({
      title: "Скоро экзамен / зачёт",
      body: s.name,
      href: `/subjects/${s.id}`,
      kind: "exam",
    })),
  ].filter((r) => !seen.has(`${r.title}|${r.href ?? ""}`));

  if (rows.length) {
    await prisma.notification.createMany({
      data: rows.map((r) => ({ ...r, userId })),
    });
  }
}
