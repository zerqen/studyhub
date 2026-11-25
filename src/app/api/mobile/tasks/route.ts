import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";
import { mobileTaskSelect, serializeMobileTask } from "@/lib/mobile-serialize";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = taskSchema.safeParse({
    priority: "MEDIUM",
    status: "PLANNED",
    ...(typeof body === "object" && body !== null ? body : {}),
  });
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const { tags: _tags, dueTime, subjectId, questionId: _questionId, stages, ...rest } = parsed.data;
  void _tags;
  void _questionId;

  if (subjectId) {
    const owned = await prisma.subject.findFirst({
      where: { id: subjectId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return mobileError("Предмет не найден", 404);
  }

  const task = await prisma.task.create({
    data: {
      ...rest,
      dueTime: dueTime || null,
      subjectId: subjectId || null,
      userId: user.id,
      ...(stages?.length
        ? {
            subtasks: {
              create: stages.map((s: string | { title: string; dueDate?: string | null }, i: number) =>
                typeof s === "string"
                  ? { userId: user.id, title: s, sortOrder: i + 1 }
                  : {
                      userId: user.id,
                      title: s.title,
                      sortOrder: i + 1,
                      dueDate: s.dueDate ? new Date(`${s.dueDate}T00:00:00.000Z`) : null,
                    },
              ),
            },
          }
        : {}),
    },
    select: mobileTaskSelect,
  });

  return mobileJson({ task: serializeMobileTask(task) }, 201);
}
