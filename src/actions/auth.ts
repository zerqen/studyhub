"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotSchema, registerSchema, resetSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/action";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "Этот email уже зарегистрирован" };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: { email, name: parsed.data.name, passwordHash },
  });
  return { ok: true };
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult<{ resetUrl?: string }>> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте email" };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) {
    return { ok: true };
  }
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashToken(token),
      resetTokenExpires: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${base}/reset-password?token=${token}`;
  // Допущение: без SMTP показываем ссылку на экране (локальная разработка).
  return { ok: true, data: { resetUrl } };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const tokenHash = hashToken(parsed.data.token);
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: tokenHash, resetTokenExpires: { gt: new Date() } },
  });
  if (!user) return { ok: false, error: "Ссылка недействительна или истекла" };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      resetTokenHash: null,
      resetTokenExpires: null,
    },
  });
  return { ok: true };
}
