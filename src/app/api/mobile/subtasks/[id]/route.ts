import { prisma } from "@/lib/prisma";
import { subtaskSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const existing = await prisma.subtask.findFirst({ where: { id, userId: user.id } });
  if (!existing) return mobileError("Подзадача не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = subtaskSchema.partial().safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const sub = await prisma.subtask.update({
    where: { id },
    data: {
      title: parsed.data.title,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate,
      note: parsed.data.note,
    },
    select: {
      id: true,
      taskId: true,
      parentId: true,
      title: true,
      status: true,
      dueDate: true,
      note: true,
      sortOrder: true,
      updatedAt: true,
    },
  });

  return mobileJson({
    subtask: {
      ...sub,
      dueDate: sub.dueDate ? sub.dueDate.toISOString() : null,
      updatedAt: sub.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const res = await prisma.subtask.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return mobileError("Подзадача не найдена", 404);
  return mobileJson({ ok: true });
}
