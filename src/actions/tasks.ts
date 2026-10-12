"use server";

import { prisma } from "@/lib/prisma";
import { commentSchema, taskSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { syncTags } from "@/lib/tags";
import { removeUpload } from "@/lib/files";

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const { tags, dueTime, subjectId, questionId, ...rest } = parsed.data;
    if (subjectId) {
      const owned = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
      if (!owned) throw new Error("Предмет не найден");
    }
    if (questionId && !(await prisma.question.findFirst({ where: { id: questionId, userId }, select: { id: true } }))) {
      throw new Error("Вопрос не найден");
    }
    const tagRows = await syncTags(userId, tags);
    const task = await prisma.task.create({
      data: {
        ...rest,
        dueTime: dueTime || null,
        subjectId: subjectId || null,
        ...(questionId ? { questions: { connect: { id: questionId } } } : {}),
        userId,
        tags: { create: tagRows.map((t) => ({ tagId: t.id })) },
      },
    });
    refreshAll();
    return { id: task.id };
  });
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = taskSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Задача не найдена");
    const { tags, dueTime, subjectId, questionId, ...rest } = parsed.data;
    if (subjectId) {
      const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
      if (!subject) throw new Error("Предмет не найден");
    }
    if (questionId && !(await prisma.question.findFirst({ where: { id: questionId, userId }, select: { id: true } }))) {
      throw new Error("Вопрос не найден");
    }
    if (tags) {
      const tagRows = await syncTags(userId, tags);
      await prisma.taskTag.deleteMany({ where: { taskId: id } });
      await prisma.taskTag.createMany({ data: tagRows.map((t) => ({ taskId: id, tagId: t.id })) });
    }
    await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        ...(dueTime !== undefined ? { dueTime: dueTime || null } : {}),
        ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
        ...(questionId !== undefined ? { questions: questionId ? { set: [{ id: questionId }] } : { set: [] } } : {}),
      },
    });
    refreshAll();
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.task.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Задача не найдена");
    refreshAll();
  });
}

export async function toggleTaskDone(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const task = await prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new Error("Задача не найдена");
    const status = task.status === "DONE" ? "PLANNED" : "DONE";
    await prisma.task.update({ where: { id }, data: { status } });
    refreshAll();
  });
}

export async function moveTaskDate(id: string, dueDate: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.task.updateMany({
      where: { id, userId },
      data: { dueDate: new Date(dueDate), status: "PLANNED" },
    });
    if (!res.count) throw new Error("Задача не найдена");
    refreshAll();
  });
}

export async function addComment(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Комментарий некорректен");
    const { taskId, questionId, content } = parsed.data;
    const task = taskId ? await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } }) : null;
    const question = questionId ? await prisma.question.findFirst({ where: { id: questionId, userId }, select: { id: true } }) : null;
    if ((taskId && !task) || (questionId && !question)) throw new Error("Объект не найден");
    const comment = await prisma.comment.create({ data: { userId, taskId: taskId || null, questionId: questionId || null, content } });
    refreshAll();
    return { id: comment.id };
  });
}

export async function updateComment(id: string, content: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const value = content.trim();
    if (!value || value.length > 2000) throw new Error("Комментарий должен содержать от 1 до 2000 символов");
    const result = await prisma.comment.updateMany({ where: { id, userId }, data: { content: value } });
    if (!result.count) throw new Error("Комментарий не найден");
    refreshAll();
  });
}

export async function deleteComment(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const comment = await prisma.comment.findFirst({ where: { id, userId }, include: { attachments: true } });
    if (!comment) throw new Error("Комментарий не найден");
    await prisma.comment.delete({ where: { id } });
    await Promise.all(comment.attachments.map((file) => removeUpload(file.storagePath)));
    refreshAll();
  });
}
