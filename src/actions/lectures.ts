"use server";

import { prisma } from "@/lib/prisma";
import { lectureSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { removeUpload } from "@/lib/files";

export async function createLecture(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = lectureSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const subject = await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");
    // Номер по умолчанию — следующий по порядку
    let number = parsed.data.number ?? null;
    if (number === null) {
      const last = await prisma.lecture.aggregate({ where: { subjectId: subject.id }, _max: { number: true } });
      number = (last._max.number ?? 0) + 1;
    }
    const lecture = await prisma.lecture.create({
      data: {
        userId,
        subjectId: subject.id,
        title: parsed.data.title,
        number,
        date: parsed.data.date ?? null,
        summary: parsed.data.summary ?? "",
      },
    });
    refreshAll();
    return { id: lecture.id };
  });
}

export async function updateLecture(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = lectureSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.lecture.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new Error("Лекция не найдена");
    const { subjectId: _ignored, ...data } = parsed.data;
    void _ignored;
    await prisma.lecture.update({ where: { id }, data });
    refreshAll();
  });
}

/** Автосохранение конспекта без перерисовки страницы */
export async function saveLectureSummary(id: string, summary: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.lecture.updateMany({ where: { id, userId }, data: { summary: summary.slice(0, 100_000) } });
    if (!res.count) throw new Error("Лекция не найдена");
  });
}

export async function deleteLecture(id: string): Promise<ActionResult<{ subjectId: string }>> {
  return withUser(async (userId) => {
    const lecture = await prisma.lecture.findFirst({
      where: { id, userId },
      select: { subjectId: true, attachments: { select: { storagePath: true } } },
    });
    if (!lecture) throw new Error("Лекция не найдена");
    // Вопросы лекции остаются в предмете (lectureId → null), файлы удаляются вместе с лекцией
    await prisma.lecture.delete({ where: { id } });
    await Promise.allSettled(lecture.attachments.map((a) => removeUpload(a.storagePath)));
    refreshAll();
    return { subjectId: lecture.subjectId };
  });
}
