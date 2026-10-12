"use server";

import { prisma } from "@/lib/prisma";
import { subtaskSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

async function wouldCycle(userId: string, movingId: string, newParentId: string | null) {
  if (!newParentId) return false;
  if (movingId === newParentId) return true;
  let cursor: string | null = newParentId;
  const guard = new Set<string>();
  while (cursor) {
    if (cursor === movingId) return true;
    if (guard.has(cursor)) return true;
    guard.add(cursor);
    const node: { parentId: string | null } | null = await prisma.subtask.findFirst({
      where: { id: cursor, userId },
      select: { parentId: true },
    });
    cursor = node?.parentId ?? null;
  }
  return false;
}

export async function createSubtask(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = subtaskSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const task = await prisma.task.findFirst({ where: { id: parsed.data.taskId, userId } });
    if (!task) throw new Error("Задача не найдена");
    if (parsed.data.parentId) {
      const parent = await prisma.subtask.findFirst({
        where: { id: parsed.data.parentId, userId, taskId: task.id },
      });
      if (!parent) throw new Error("Родительская подзадача не найдена");
    }
    const last = await prisma.subtask.aggregate({
      where: { taskId: task.id, parentId: parsed.data.parentId ?? null },
      _max: { sortOrder: true },
    });
    const sub = await prisma.subtask.create({
      data: {
        userId,
        taskId: task.id,
        parentId: parsed.data.parentId ?? null,
        title: parsed.data.title,
        status: parsed.data.status ?? "PLANNED",
        dueDate: parsed.data.dueDate,
        note: parsed.data.note,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    refreshAll();
    return { id: sub.id };
  });
}

export async function updateSubtask(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = subtaskSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.subtask.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Подзадача не найдена");
    if (parsed.data.parentId !== undefined) {
      if (await wouldCycle(userId, id, parsed.data.parentId ?? null)) {
        throw new Error("Нельзя сделать подзадачу потомком самой себя");
      }
      if (parsed.data.parentId) {
        const parent = await prisma.subtask.findFirst({
          where: { id: parsed.data.parentId, userId, taskId: existing.taskId },
          select: { id: true },
        });
        if (!parent) throw new Error("Родительская подзадача не найдена");
      }
    }
    await prisma.subtask.update({
      where: { id },
      data: {
        title: parsed.data.title,
        status: parsed.data.status,
        dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate,
        note: parsed.data.note,
        parentId: parsed.data.parentId === undefined ? undefined : parsed.data.parentId,
      },
    });
    refreshAll();
  });
}

export async function deleteSubtask(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.subtask.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Подзадача не найдена");
    refreshAll();
  });
}
