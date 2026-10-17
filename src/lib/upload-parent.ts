import { prisma } from "./prisma";

export const PARENT_KEYS = ["subjectId", "taskId", "subtaskId", "ticketId", "questionId", "noteId", "commentId", "lectureId", "examItemId"] as const;
export type UploadParent = Partial<Record<(typeof PARENT_KEYS)[number], string | null>>;

export function parentFrom(get: (key: string) => unknown): UploadParent {
  const out: UploadParent = {};
  for (const key of PARENT_KEYS) {
    const v = get(key);
    out[key] = typeof v === "string" && v ? v : null;
  }
  return out;
}

/** Проверяет, что все объекты, к которым крепится файл, принадлежат пользователю */
export async function assertParentOwned(userId: string, p: UploadParent) {
  const where = (id: string) => ({ where: { id, userId }, select: { id: true } });
  const checks = await Promise.all([
    p.subjectId ? prisma.subject.findFirst(where(p.subjectId)) : true,
    p.taskId ? prisma.task.findFirst(where(p.taskId)) : true,
    p.subtaskId ? prisma.subtask.findFirst(where(p.subtaskId)) : true,
    p.ticketId ? prisma.ticket.findFirst(where(p.ticketId)) : true,
    p.questionId ? prisma.question.findFirst(where(p.questionId)) : true,
    p.noteId ? prisma.note.findFirst(where(p.noteId)) : true,
    p.commentId ? prisma.comment.findFirst(where(p.commentId)) : true,
    p.lectureId ? prisma.lecture.findFirst(where(p.lectureId)) : true,
    p.examItemId ? prisma.examItem.findFirst({ where: { id: p.examItemId, exam: { userId } }, select: { id: true } }) : true,
  ]);
  if (checks.some((c) => !c)) throw new Error("Объект для файла не найден");
}
