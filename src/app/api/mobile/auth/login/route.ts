import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { consumeLoginAttempt } from "@/lib/rate-limit";
import { PENDING_ERROR } from "@/lib/auth";
import { mobileError, mobileJson, signMobileToken } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "mobile";

  if (!(await consumeLoginAttempt(`${ip}:${email}`))) {
    return mobileError("Слишком много попыток. Подождите минуту.", 429);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return mobileError("Неверный email или пароль", 401);
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return mobileError("Неверный email или пароль", 401);
  }

  if (!user.approved) {
    return mobileError(PENDING_ERROR, 403);
  }

  const { token, expiresAt } = signMobileToken(user.id);
  return mobileJson({
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarPath: user.avatarPath,
    },
  });
}
