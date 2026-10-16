import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { refreshDeadlineNotifications } from "@/lib/notify";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, title: true, body: true, href: true, read: true, createdAt: true },
  });
  // Пересчёт дедлайнов и уведомлений — уже ПОСЛЕ отправки страницы, не задерживает её
  after(() => refreshDeadlineNotifications(user.id).catch(() => undefined));
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
