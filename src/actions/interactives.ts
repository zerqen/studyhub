"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { MAX_INTERACTIVE_BYTES, byteSize, htmlTitle, looksLikeHtml, normalizeHtml } from "@/lib/interactive";

const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => v || null);

const createSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  html: z.string().min(1, "Пустой файл"),
  subjectId: optionalId,
  lectureId: optionalId,
});

const updateSchema = z.object({
  title: z.string().trim().min(1, "Нужно название").max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  subjectId: optionalId,
  lectureId: optionalId,
  html: z.string().min(1).optional(),
});

/** Проверяет, что предмет и лекция свои; лекция задаёт предмет */
async function resolveParents(userId: string, subjectId: string | null, lectureId: string | null) {
  if (lectureId) {
    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId }, select: { id: true, subjectId: true } });
    if (!lecture) throw new Error("Лекция не найдена");
    return { subjectId: lecture.subjectId, lectureId: lecture.id };
  }
  if (subjectId) {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");
  }
  return { subjectId, lectureId: null };
}

function prepare(raw: string) {
  if (!looksLikeHtml(raw)) throw new Error("Это не похоже на HTML");
  const html = normalizeHtml(raw);
  const size = byteSize(html);
  if (size > MAX_INTERACTIVE_BYTES) throw new Error("Схема больше 5 МБ");
  return { html, size };
}

export async function createInteractive(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const { html, size } = prepare(parsed.data.html);
    const parents = await resolveParents(userId, parsed.data.subjectId, parsed.data.lectureId);
    const title = parsed.data.title || htmlTitle(html) || "Интерактивная схема";
    const row = await prisma.interactive.create({
      data: { userId, ...parents, title, description: parsed.data.description ?? "", html, size },
      select: { id: true },
    });
    refreshAll();
    return { id: row.id };
  });
}

export async function updateInteractive(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.interactive.findFirst({ where: { id, userId }, select: { id: true, subjectId: true, lectureId: true } });
    if (!existing) throw new Error("Схема не найдена");
    const data: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if ("subjectId" in (input as object) || "lectureId" in (input as object)) {
      Object.assign(data, await resolveParents(userId, parsed.data.subjectId, parsed.data.lectureId));
    }
    if (parsed.data.html !== undefined) Object.assign(data, prepare(parsed.data.html));
    await prisma.interactive.update({ where: { id }, data });
    refreshAll();
  });
}

export async function deleteInteractive(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const r = await prisma.interactive.deleteMany({ where: { id, userId } });
    if (!r.count) throw new Error("Схема не найдена");
    refreshAll();
  });
}
