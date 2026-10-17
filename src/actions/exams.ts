"use server";

import { prisma } from "@/lib/prisma";
import { examConfigSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { buildExam, examScore } from "@/lib/exam";
import { applyGrade } from "@/lib/grade";
import { removeUpload } from "@/lib/files";

export async function startExam(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = examConfigSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные настройки");
    const c = parsed.data;
    const subject = await prisma.subject.findFirst({ where: { id: c.subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");
    const pool = await prisma.question.findMany({
      where: { subjectId: subject.id, userId },
      select: {
        id: true,
        kind: true,
        ticketNo: true,
        lectureId: true,
        status: true,
        difficulty: true,
        srsLapses: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
    if (!pool.length) throw new Error("В предмете пока нет вопросов");
    const { ticketNo, items } = buildExam(
      pool.map((q) => ({ ...q, tags: q.tags.map((t) => t.tag.name) })),
      { theory: c.theory, problems: c.problems, extra: c.extra, ticketNo: c.ticketNo ?? null, weak: Boolean(c.weak) },
    );
    if (!items.some((i) => i.role !== "EXTRA")) throw new Error("Не из чего собрать билет: добавь вопросы или задачи");
    const exam = await prisma.examSession.create({
      data: {
        userId,
        subjectId: subject.id,
        ticketNo,
        prepMinutes: c.prepMinutes,
        // Без подготовки — сразу к ответу
        phase: c.prepMinutes ? "PREP" : "ANSWER",
        answerAt: c.prepMinutes ? null : new Date(),
        items: { create: items.map((it, position) => ({ ...it, position })) },
      },
      select: { id: true },
    });
    return { id: exam.id };
  });
}

const PHASES = ["PREP", "ANSWER", "EXTRA", "DONE"] as const;

export async function setExamPhase(id: string, phase: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    if (!PHASES.includes(phase as (typeof PHASES)[number]) || phase === "DONE") throw new Error("Неизвестный этап");
    const exam = await prisma.examSession.findFirst({ where: { id, userId }, select: { phase: true, answerAt: true } });
    if (!exam) throw new Error("Экзамен не найден");
    if (exam.phase === "DONE") throw new Error("Экзамен уже завершён");
    await prisma.examSession.update({
      where: { id },
      data: { phase, ...(phase !== "PREP" && !exam.answerAt ? { answerAt: new Date() } : {}) },
    });
  });
}

async function ownedItem(userId: string, itemId: string) {
  const item = await prisma.examItem.findFirst({
    where: { id: itemId, exam: { userId } },
    select: { id: true, grade: true, questionId: true, exam: { select: { id: true, phase: true } } },
  });
  if (!item) throw new Error("Вопрос экзамена не найден");
  return item;
}

/** Самооценка ответа. Первая оценка идёт и в интервальное повторение: слабое вернётся на повтор. */
export async function gradeExamItem(itemId: string, grade: number): Promise<ActionResult> {
  return withUser(async (userId) => {
    const g = Math.max(0, Math.min(3, Math.round(grade)));
    const item = await ownedItem(userId, itemId);
    if (item.exam.phase === "DONE") throw new Error("Экзамен уже завершён");
    await prisma.examItem.update({ where: { id: item.id }, data: { grade: g } });
    if (item.grade === null) await applyGrade(userId, item.questionId, g);
  });
}

export async function saveExamNote(itemId: string, note: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const item = await ownedItem(userId, itemId);
    await prisma.examItem.update({ where: { id: item.id }, data: { note: note.slice(0, 20_000) || null } });
  });
}

export async function finishExam(id: string): Promise<ActionResult<{ grade: number; score: number }>> {
  return withUser(async (userId) => {
    const exam = await prisma.examSession.findFirst({
      where: { id, userId },
      select: { subjectId: true, phase: true, items: { select: { role: true, grade: true } } },
    });
    if (!exam) throw new Error("Экзамен не найден");
    const { score, grade } = examScore(exam.items);
    await prisma.$transaction([
      prisma.examSession.update({ where: { id }, data: { phase: "DONE", score, grade, finishedAt: new Date() } }),
      prisma.progressLog.create({ data: { userId, subjectId: exam.subjectId, type: "EXAM_MOCK", value: String(grade) } }),
    ]);
    refreshAll();
    return { grade, score };
  });
}

export async function deleteExam(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const exam = await prisma.examSession.findFirst({
      where: { id, userId },
      select: { items: { select: { attachments: { select: { storagePath: true } } } } },
    });
    if (!exam) throw new Error("Экзамен не найден");
    await prisma.examSession.delete({ where: { id } });
    await Promise.all(exam.items.flatMap((i) => i.attachments).map((a) => removeUpload(a.storagePath).catch(() => undefined)));
    refreshAll();
  });
}
