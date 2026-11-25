import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { lectureSchema } from "@/lib/validations";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

const createLectureSchema = lectureSchema.extend({
  transcript: z.string().max(200_000).optional(),
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

  const parsed = createLectureSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const subject = await prisma.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
    select: { id: true },
  });
  if (!subject) return mobileError("Предмет не найден", 404);

  let number = parsed.data.number ?? null;
  if (number === null) {
    const last = await prisma.lecture.aggregate({
      where: { subjectId: subject.id },
      _max: { number: true },
    });
    number = (last._max.number ?? 0) + 1;
  }

  const lecture = await prisma.lecture.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      title: parsed.data.title,
      number,
      date: parsed.data.date ?? null,
      summary: parsed.data.summary ?? "",
      transcript: parsed.data.transcript ?? "",
    },
    select: {
      id: true,
      subjectId: true,
      number: true,
      title: true,
      date: true,
      summary: true,
      transcript: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mobileJson(
    {
      lecture: {
        ...lecture,
        date: lecture.date ? lecture.date.toISOString() : null,
        createdAt: lecture.createdAt.toISOString(),
        updatedAt: lecture.updatedAt.toISOString(),
      },
    },
    201,
  );
}
