import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { refreshDeadlineNotifications } from "@/lib/notify";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await refreshDeadlineNotifications(user.id);
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return <AppShell user={user} notifications={notifications}>{children}</AppShell>;
}
