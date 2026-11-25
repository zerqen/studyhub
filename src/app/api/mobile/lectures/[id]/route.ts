import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { lectureSchema } from "@/lib/validations";
import { removeUpload } from "@/lib/files";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

const updateLectureSchema = lectureSchema.partial().extend({
  transcript: z.string().max(200_000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const existing = await prisma.lecture.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return mobileError("Лекция не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = updateLectureSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const { subjectId: _ignored, ...data } = parsed.data;
  void _ignored;

  const updated = await prisma.lecture.update({
    where: { id },
    data,
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

  return mobileJson({
    lecture: {
      ...updated,
      date: updated.date ? updated.date.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const lecture = await prisma.lecture.findFirst({
    where: { id, userId: user.id },
    select: { id: true, attachments: { select: { storagePath: true } } },
  });
  if (!lecture) return mobileError("Лекция не найдена", 404);

  await prisma.lecture.delete({ where: { id } });
  await Promise.allSettled(lecture.attachments.map((a) => removeUpload(a.storagePath)));
  return mobileJson({ ok: true });
}
