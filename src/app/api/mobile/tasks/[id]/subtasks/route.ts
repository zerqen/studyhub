import { prisma } from "@/lib/prisma";
import { subtaskSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id: taskId } = await ctx.params;
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    select: { id: true },
  });
  if (!task) return mobileError("Задача не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = subtaskSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    taskId,
  });
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const last = await prisma.subtask.aggregate({
    where: { taskId, parentId: parsed.data.parentId ?? null },
    _max: { sortOrder: true },
  });

  const sub = await prisma.subtask.create({
    data: {
      userId: user.id,
      taskId,
      parentId: parsed.data.parentId ?? null,
      title: parsed.data.title,
      status: parsed.data.status ?? "PLANNED",
      dueDate: parsed.data.dueDate,
      note: parsed.data.note,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
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

  return mobileJson(
    {
      subtask: {
        ...sub,
        dueDate: sub.dueDate ? sub.dueDate.toISOString() : null,
        updatedAt: sub.updatedAt.toISOString(),
      },
    },
    201,
  );
}
