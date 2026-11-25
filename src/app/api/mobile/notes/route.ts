import { prisma } from "@/lib/prisma";
import { noteSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = noteSchema.safeParse(body);
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

  const note = await prisma.note.create({
    data: {
      userId: user.id,
      title,
      content: content ?? "",
      subjectId: subjectId || null,
      color: color ?? "#fde68a",
      pinned: pinned ?? false,
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

  return mobileJson(
    {
      note: {
        ...note,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    },
    201,
  );
}
