"use server";

import { prisma } from "@/lib/prisma";
import { subjectSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

export async function createSubject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = subjectSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const subject = await prisma.subject.create({ data: { ...parsed.data, userId } });
    refreshAll();
    return { id: subject.id };
  });
}

export async function updateSubject(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = subjectSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const res = await prisma.subject.updateMany({ where: { id, userId }, data: parsed.data });
    if (!res.count) throw new Error("Предмет не найден");
    refreshAll();
  });
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.subject.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Предмет не найден");
    refreshAll();
  });
}

export async function archiveSubject(id: string, archived: boolean): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.subject.updateMany({ where: { id, userId }, data: { archived } });
    if (!res.count) throw new Error("Предмет не найден");
    refreshAll();
  });
}
