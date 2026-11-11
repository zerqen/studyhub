import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { refreshDeadlineNotifications } from "@/lib/notify";
import { autoSyncSchedule } from "@/lib/schedule-import";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const [notifications, subjects, reviewDue, tasksSoon] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, href: true, read: true, kind: true, createdAt: true },
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false, selfStudy: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // Счётчики в меню: карточки к повторению и открытые задачи на ближайшую неделю (с просроченными)
    prisma.question.count({ where: { userId: user.id, srsReps: { gt: 0 }, srsDue: { lte: now } } }),
    prisma.task.count({ where: { userId: user.id, status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { lt: weekAhead } } }),
  ]);
  // Пересчёт дедлайнов и уведомлений — уже ПОСЛЕ отправки страницы, не задерживает её
  after(() => refreshDeadlineNotifications(user.id).catch(() => undefined));
  // Расписание по ссылке (если подключено) обновляется само раз в 6 часов
  after(() => autoSyncSchedule(user.id).catch(() => undefined));
  return (
    <AppShell user={user} notifications={notifications} subjects={subjects} counts={{ review: reviewDue, tasks: tasksSoon }}>
      {children}
    </AppShell>
  );
}
