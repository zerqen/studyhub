import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export const getSession = cache(() => getServerSession(authOptions));

/**
 * Пользователь из сессии — только если аккаунт существует и подтверждён.
 * Проверяется по базе на каждый запрос: снятый approved закрывает доступ сразу,
 * даже если токен входа ещё действует. Обёрнуто в React cache — один запрос к базе на запрос страницы.
 */
const sessionUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, avatarPath: true, createdAt: true, approved: true },
  });
});

export const requireUser = cache(async () => {
  const user = await sessionUser();
  if (!user) redirect("/login");
  if (!user.approved) redirect("/pending");
  return { id: user.id, email: user.email, name: user.name, avatarPath: user.avatarPath, createdAt: user.createdAt };
});

/** id подтверждённого пользователя или null — для API-маршрутов */
export async function activeUserId() {
  const user = await sessionUser();
  return user?.approved ? user.id : null;
}

export async function getUserId() {
  const id = await activeUserId();
  if (!id) throw new Error("unauthorized");
  return id;
}
