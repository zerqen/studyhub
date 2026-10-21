import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { refreshDeadlineNotifications } from "@/lib/notify";
import { autoSyncSchedule } from "@/lib/schedule-import";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, subjects] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, body: true, href: true, read: true, createdAt: true },
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false, selfStudy: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Пересчёт дедлайнов и уведомлений — уже ПОСЛЕ отправки страницы, не задерживает её
  after(() => refreshDeadlineNotifications(user.id).catch(() => undefined));
  // Расписание по ссылке (если подключено) обновляется само раз в 6 часов
  after(() => autoSyncSchedule(user.id).catch(() => undefined));
  return (
    <AppShell user={user} notifications={notifications} subjects={subjects}>
      {children}
    </AppShell>
  );
}
