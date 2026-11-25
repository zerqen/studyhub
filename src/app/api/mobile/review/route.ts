import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyGrade } from "@/lib/grade";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

const reviewBodySchema = z.object({
  questionId: z.string().min(1),
  grade: z.number().int().min(0).max(3),
});

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  try {
    const res = await applyGrade(user.id, parsed.data.questionId, parsed.data.grade);
    const updated = await prisma.question.findUnique({
      where: { id: parsed.data.questionId },
      select: {
        id: true,
        status: true,
        srsDue: true,
        srsInterval: true,
        srsEase: true,
        srsReps: true,
        srsLapses: true,
      },
    });
    return mobileJson({
      status: res.status,
      due: res.due,
      question: updated
        ? {
            ...updated,
            srsDue: updated.srsDue ? updated.srsDue.toISOString() : null,
          }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка повторения";
    if (msg === "Вопрос не найден") return mobileError(msg, 404);
    return mobileError(msg, 400);
  }
}
