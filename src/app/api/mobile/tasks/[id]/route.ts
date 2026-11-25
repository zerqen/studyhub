import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";
import { mobileTaskSelect, serializeMobileTask } from "@/lib/mobile-serialize";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const existing = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!existing) return mobileError("Задача не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = taskSchema.partial().safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const { tags: _tags, dueTime, subjectId, questionId: _questionId, stages: _stages, ...rest } = parsed.data;
  void _tags;
  void _questionId;
  void _stages;

  if (subjectId) {
    const owned = await prisma.subject.findFirst({
      where: { id: subjectId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return mobileError("Предмет не найден", 404);
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(dueTime !== undefined ? { dueTime: dueTime || null } : {}),
      ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
    },
    select: mobileTaskSelect,
  });

  if (existing.status !== "DONE" && updated.status === "DONE") {
    await prisma.progressLog.create({
      data: {
        userId: user.id,
        subjectId: updated.subjectId,
        type: "TASK_DONE",
        value: id,
      },
    });
  }

  return mobileJson({ task: serializeMobileTask(updated) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const res = await prisma.task.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return mobileError("Задача не найдена", 404);
  return mobileJson({ ok: true });
}
