import { prisma } from "./prisma";
import { startOfDay, addDays } from "date-fns";

// Не чаще раза в 10 минут на пользователя. Отметка хранится в базе — общая для всех инстансов
const MIN_INTERVAL = 10 * 60 * 1000;
// Быстрая проверка в памяти, чтобы не ходить в базу на каждом переходе
const lastCheck = new Map<string, number>();

export async function refreshDeadlineNotifications(userId: string, force = false) {
  if (!force) {
    if (Date.now() - (lastCheck.get(userId) ?? 0) < MIN_INTERVAL) return;
    lastCheck.set(userId, Date.now());
    // Атомарно «занимаем» пересчёт: обновится, только если прошло 10 минут
    const claimed = await prisma.user.updateMany({
      where: { id: userId, OR: [{ deadlineCheckedAt: null }, { deadlineCheckedAt: { lt: new Date(Date.now() - MIN_INTERVAL) } }] },
      data: { deadlineCheckedAt: new Date() },
    });
    if (!claimed.count) return;
  }

  const today = startOfDay(new Date());
  const soon = addDays(today, 3);

  // Все чтения — параллельно, одной волной
  const [overdue, todayTasks, exams, existing] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { in: ["PLANNED", "IN_PROGRESS", "OVERDUE"] }, dueDate: { lt: today } },
      select: { id: true, title: true },
      take: 20,
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["PLANNED", "IN_PROGRESS"] }, dueDate: { gte: today, lt: addDays(today, 1) } },
      select: { id: true, title: true },
      take: 20,
    }),
    prisma.subject.findMany({
      where: { userId, archived: false, examDate: { gte: today, lte: soon } },
      select: { id: true, name: true },
    }),
    prisma.notification.findMany({
      where: { userId, createdAt: { gte: today } },
      select: { title: true, href: true },
    }),
  ]);

  const seen = new Set(existing.map((n) => `${n.title}|${n.href ?? ""}`));
  const rows = [
    ...overdue.map((t) => ({ title: "Просроченная задача", body: t.title, href: `/tasks/${t.id}`, kind: "danger" })),
    ...todayTasks.map((t) => ({ title: "Задача на сегодня", body: t.title, href: `/tasks/${t.id}`, kind: "today" })),
    ...exams.map((s) => ({ title: "Скоро экзамен / зачёт", body: s.name, href: `/subjects/${s.id}`, kind: "exam" })),
  ].filter((r) => !seen.has(`${r.title}|${r.href}`));

  await Promise.all([
    prisma.task.updateMany({
      where: { userId, status: { in: ["PLANNED", "IN_PROGRESS"] }, dueDate: { lt: today } },
      data: { status: "OVERDUE" },
    }),
    rows.length ? prisma.notification.createMany({ data: rows.map((r) => ({ ...r, userId })) }) : null,
  ]);
}
