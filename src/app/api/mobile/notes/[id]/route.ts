import { prisma } from "@/lib/prisma";
import { noteSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const existing = await prisma.note.findFirst({ where: { id, userId: user.id } });
  if (!existing) return mobileError("Заметка не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = noteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const { tags: _tags, subjectId, taskId: _taskId, ticketId: _ticketId, questionId: _questionId, content, color, pinned, title } =
    parsed.data;
  void _tags;
  void _taskId;
  void _ticketId;
  void _questionId;

  if (subjectId) {
    const owned = await prisma.subject.findFirst({
      where: { id: subjectId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return mobileError("Предмет не найден", 404);
  }

  const updated = await prisma.note.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content: content ?? "" } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
      ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
    },
    select: {
      id: true,
      title: true,
      content: true,
      subjectId: true,
      color: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mobileJson({
    note: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const res = await prisma.note.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return mobileError("Заметка не найдена", 404);
  return mobileJson({ ok: true });
}
