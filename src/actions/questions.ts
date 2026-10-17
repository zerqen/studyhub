"use server";

import { prisma } from "@/lib/prisma";
import { questionImportSchema, questionSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { syncTags } from "@/lib/tags";
import { applyGrade } from "@/lib/grade";

export async function createQuestion(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const subject = await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId } });
    if (!subject) throw new Error("Предмет не найден");
    const { tags, ticketId, lectureId, ...rest } = parsed.data;
    await assertLecture(userId, lectureId, subject.id);
    const tagRows = await syncTags(userId, tags);
    const last = await prisma.question.aggregate({
      where: { subjectId: subject.id },
      _max: { sortOrder: true },
    });
    const q = await prisma.question.create({
      data: {
        ...rest,
        userId,
        subjectId: subject.id,
        ticketId: ticketId || null,
        lectureId: lectureId || null,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        tags: { create: tagRows.map((t) => ({ tagId: t.id })) },
      },
    });
    refreshAll();
    return { id: q.id };
  });
}

export async function importQuestions(input: unknown): Promise<ActionResult<{ count: number }>> {
  return withUser(async (userId) => {
    const parsed = questionImportSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректный JSON");
    const subject = await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");
    await assertLecture(userId, parsed.data.lectureId, subject.id);
    const lectureId = parsed.data.lectureId || null;
    const last = await prisma.question.aggregate({ where: { subjectId: subject.id }, _max: { sortOrder: true } });
    let sortOrder = (last._max.sortOrder ?? 0) + 1;
    // Теги синхронизируем один раз на весь импорт, а вопросы создаём одной транзакцией
    const allTags = await syncTags(userId, parsed.data.questions.flatMap((item: { tags?: string[] }) => item.tags ?? []));
    const tagId = new Map(allTags.map((t) => [t.name, t.id]));
    await prisma.$transaction(
      parsed.data.questions.map((item: { text: string; answer?: string | null; explanation?: string | null; difficulty?: string; kind?: string; ticket?: number | null; tags?: string[] }) =>
        prisma.question.create({
          data: {
            userId,
            subjectId: subject.id,
            text: item.text,
            answer: item.answer ?? null,
            explanation: item.explanation ?? null,
            difficulty: item.difficulty ?? "MEDIUM",
            kind: item.kind ?? "THEORY",
            ticketNo: item.ticket ?? null,
            lectureId,
            sortOrder: sortOrder++,
            tags: {
              create: [...new Set<string>((item.tags ?? []).map((n: string) => n.trim()).filter(Boolean))]
                .filter((n) => tagId.has(n))
                .map((n) => ({ tagId: tagId.get(n)! })),
            },
          },
        }),
      ),
    );
    refreshAll();
    return { count: parsed.data.questions.length };
  });
}

export async function updateQuestion(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = questionSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.question.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Вопрос не найден");
    const { tags, ticketId, subjectId, lectureId, ...rest } = parsed.data;
    if (subjectId && !(await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } }))) {
      throw new Error("Предмет не найден");
    }
    if (lectureId) await assertLecture(userId, lectureId, subjectId ?? existing.subjectId);
    if (tags) {
      const tagRows = await syncTags(userId, tags);
      await prisma.questionTag.deleteMany({ where: { questionId: id } });
      await prisma.questionTag.createMany({
        data: tagRows.map((t) => ({ questionId: id, tagId: t.id })),
      });
    }
    await prisma.question.update({ where: { id }, data: { ...rest, ...(subjectId ? { subjectId } : {}), ...(ticketId !== undefined ? { ticketId: ticketId || null } : {}), ...(lectureId !== undefined ? { lectureId: lectureId || null } : {}) } });
    refreshAll();
  });
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.question.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Вопрос не найден");
    refreshAll();
  });
}

export async function recordAttempt(questionId: string, result: boolean | number): Promise<ActionResult<{ status: string; due: string }>> {
  return withUser(async (userId) => {
    // Совместимость: true/false = «хорошо»/«забыл»
    const grade = typeof result === "boolean" ? (result ? 2 : 0) : result;
    const res = await applyGrade(userId, questionId, grade);
    refreshAll();
    return res;
  });
}

/** Новый порядок вопросов предмета (после перетаскивания) */
export async function reorderQuestions(subjectId: string, ids: string[]): Promise<ActionResult> {
  return withUser(async (userId) => {
    const owned = await prisma.question.findMany({ where: { subjectId, userId, id: { in: ids } }, select: { id: true } });
    if (owned.length !== ids.length) throw new Error("Вопросы не найдены");
    await prisma.$transaction(ids.map((id, index) => prisma.question.update({ where: { id }, data: { sortOrder: index + 1 } })));
    refreshAll();
  });
}

async function assertLecture(userId: string, lectureId: string | null | undefined, subjectId: string) {
  if (!lectureId) return;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId, subjectId }, select: { id: true } });
  if (!lecture) throw new Error("Лекция не найдена");
}
