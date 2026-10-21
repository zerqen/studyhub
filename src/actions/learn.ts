"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

/** Направление «Изучаю» хранится как предмет с selfStudy = true; его темы — лекции */
const trackSchema = z.object({
  name: z.string().trim().min(1, "Нужно название").max(120),
  emoji: z.string().min(1).max(8),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "Цвет в формате #RRGGBB"),
  description: z.string().trim().max(4000).optional().nullable(),
  linkedSubjectId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null),
});

async function checkLinked(userId: string, linkedSubjectId: string | null, selfId?: string) {
  if (!linkedSubjectId) return null;
  if (linkedSubjectId === selfId) throw new Error("Нельзя связать направление с самим собой");
  const s = await prisma.subject.findFirst({ where: { id: linkedSubjectId, userId, selfStudy: false }, select: { id: true } });
  if (!s) throw new Error("Предмет не найден");
  return s.id;
}

export async function createTrack(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = trackSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const linkedSubjectId = await checkLinked(userId, parsed.data.linkedSubjectId);
    const track = await prisma.subject.create({
      data: {
        userId,
        selfStudy: true,
        type: "OTHER",
        name: parsed.data.name,
        emoji: parsed.data.emoji,
        color: parsed.data.color,
        description: parsed.data.description || null,
        linkedSubjectId,
      },
      select: { id: true },
    });
    refreshAll();
    return { id: track.id };
  });
}

export async function updateTrack(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = trackSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const linkedSubjectId = await checkLinked(userId, parsed.data.linkedSubjectId, id);
    const r = await prisma.subject.updateMany({
      where: { id, userId, selfStudy: true },
      data: { name: parsed.data.name, emoji: parsed.data.emoji, color: parsed.data.color, description: parsed.data.description || null, linkedSubjectId },
    });
    if (!r.count) throw new Error("Направление не найдено");
    refreshAll();
  });
}

export async function archiveTrack(id: string, archived: boolean): Promise<ActionResult> {
  return withUser(async (userId) => {
    const r = await prisma.subject.updateMany({ where: { id, userId, selfStudy: true }, data: { archived } });
    if (!r.count) throw new Error("Направление не найдено");
    refreshAll();
  });
}

export async function deleteTrack(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const r = await prisma.subject.deleteMany({ where: { id, userId, selfStudy: true } });
    if (!r.count) throw new Error("Направление не найдено");
    refreshAll();
  });
}
