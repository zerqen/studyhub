import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export const getSession = cache(() => getServerSession(authOptions));

/**
 * Обёрнуто в React cache: layout и страница в одном запросе
 * больше не ходят в базу за пользователем дважды.
 */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, avatarPath: true, createdAt: true },
  });
  if (!user) redirect("/login");
  return user;
});

export async function getUserId() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}
