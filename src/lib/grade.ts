import { prisma } from "./prisma";
import { dueDate, schedule, statusFor, type Grade } from "./srs";

/** Записывает ответ на вопрос и пересчитывает интервальное повторение. Владельца проверяет сам. */
export async function applyGrade(userId: string, questionId: string, raw: number) {
  const grade = Math.max(0, Math.min(3, Math.round(raw))) as Grade;
  const q = await prisma.question.findFirst({
    where: { id: questionId, userId },
    select: { subjectId: true, srsInterval: true, srsEase: true, srsReps: true, srsLapses: true },
  });
  if (!q) throw new Error("Вопрос не найден");
  const next = schedule({ interval: q.srsInterval, ease: q.srsEase, reps: q.srsReps, lapses: q.srsLapses }, grade);
  const due = dueDate(next);
  const status = statusFor(next, grade);
  const knew = grade >= 2;
  await prisma.$transaction([
    prisma.questionAttempt.create({ data: { userId, questionId, knew, grade } }),
    prisma.question.update({
      where: { id: questionId },
      data: { status, srsInterval: next.interval, srsEase: next.ease, srsReps: next.reps, srsLapses: next.lapses, srsDue: due },
    }),
    prisma.progressLog.create({
      data: { userId, subjectId: q.subjectId, type: knew ? "QUESTION_KNOWN" : "QUESTION_UNKNOWN", value: questionId },
    }),
  ]);
  return { status, due: due.toISOString() };
}
