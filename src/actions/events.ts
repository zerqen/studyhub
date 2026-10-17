"use server";

import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    if (parsed.data.subjectId && !(await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId }, select: { id: true } }))) {
      throw new Error("Предмет не найден");
    }
    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
        subjectId: parsed.data.subjectId || null,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        allDay: parsed.data.allDay ?? true,
        color: parsed.data.color,
        kind: parsed.data.kind ?? "OTHER",
        location: parsed.data.location || null,
        recurrence: parsed.data.recurrence || null,
        repeatUntil: parsed.data.repeatUntil ?? null,
      },
    });
    refreshAll();
    return { id: event.id };
  });
}

export async function updateEvent(id: string, input: unknown): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = eventSchema.partial().safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Событие не найдено");
    if (parsed.data.subjectId && !(await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId }, select: { id: true } }))) {
      throw new Error("Предмет не найден");
    }
    await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt === undefined ? undefined : parsed.data.endAt,
        allDay: parsed.data.allDay,
        color: parsed.data.color,
        subjectId: parsed.data.subjectId === undefined ? undefined : parsed.data.subjectId || null,
        kind: parsed.data.kind,
        location: parsed.data.location === undefined ? undefined : parsed.data.location || null,
        recurrence: parsed.data.recurrence === undefined ? undefined : parsed.data.recurrence || null,
        repeatUntil: parsed.data.repeatUntil === undefined ? undefined : parsed.data.repeatUntil,
      },
    });
    refreshAll();
  });
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.calendarEvent.deleteMany({ where: { id, userId } });
    if (!res.count) throw new Error("Событие не найдено");
    refreshAll();
  });
}
