"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema, profileSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    await prisma.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
    refreshAll();
  });
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = passwordChangeSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Пользователь не найден");
    const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
    if (!ok) throw new Error("Текущий пароль неверный");
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    });
  });
}

export async function markNotificationsRead(): Promise<ActionResult> {
  return withUser(async (userId) => {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    refreshAll();
  });
}
