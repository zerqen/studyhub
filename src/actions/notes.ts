"use server";

import { prisma } from "@/lib/prisma";
import { noteSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { syncTags } from "@/lib/tags";

export async function createNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const { tags, ...rest } = parsed.data;
    await validateNoteLinks(userId, rest);
    const tagRows = await syncTags(userId, tags);
    const note = await prisma.note.create({
      data: {
        ...rest,
        content: rest.content ?? "",
        userId,
        tags: { create: tagRows.map((t) => ({ tagId: t.id })) },
      },
    });
    refreshAll();
    return { id: note.id };
  });
}

export async function updateNote(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = noteSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.note.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Заметка не найдена");
    const { tags, subjectId, taskId, ticketId, questionId, content, ...rest } = parsed.data;
    await validateNoteLinks(userId, { subjectId, taskId, ticketId, questionId });
    if (tags) {
      const tagRows = await syncTags(userId, tags);
      await prisma.noteTag.deleteMany({ where: { noteId: id } });
      await prisma.noteTag.createMany({ data: tagRows.map((t) => ({ noteId: id, tagId: t.id })) });
    }
    await prisma.note.update({
      where: { id },
      data: {
        ...rest,
        ...(content !== undefined ? { content: content ?? "" } : {}),
        ...(subjectId !== undefined ? { subject: subjectId ? { connect: { id: subjectId } } : { disconnect: true } } : {}),
        ...(taskId !== undefined ? { task: taskId ? { connect: { id: taskId } } : { disconnect: true } } : {}),
        ...(ticketId !== undefined ? { ticket: ticketId ? { connect: { id: ticketId } } : { disconnect: true } } : {}),
        ...(questionId !== undefined ? { question: questionId ? { connect: { id: questionId } } : { disconnect: true } } : {}),
      },
    });
    refreshAll();
  });
}

async function validateNoteLinks(
  userId: string,
  links: { subjectId?: string | null; taskId?: string | null; ticketId?: string | null; questionId?: string | null },
) {
  if (links.subjectId && !(await prisma.subject.findFirst({ where: { id: links.subjectId, userId }, select: { id: true } }))) {
    throw new Error("Предмет не найден");
  }
  if (links.taskId && !(await prisma.task.findFirst({ where: { id: links.taskId, userId }, select: { id: true } }))) {
    throw new Error("Задача не найдена");
  }
  if (links.ticketId && !(await prisma.ticket.findFirst({ where: { id: links.ticketId, userId }, select: { id: true } }))) {
    throw new Error("Билет не найден");
  }
  if (links.questionId && !(await prisma.question.findFirst({ where: { id: links.questionId, userId }, select: { id: true } }))) {
    throw new Error("Вопрос не найден");
  }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.note.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Заметка не найдена");
    refreshAll();
  });
}

export async function autosaveNote(id: string, title: string, content: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.note.updateMany({
      where: { id, userId },
      data: { title: title.slice(0, 200) || "Без названия", content: content.slice(0, 50_000) },
    });
    if (!res.count) throw new Error("Заметка не найдена");
  });
}
