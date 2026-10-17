"use server";

import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { homeworkSchema } from "@/lib/validations";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { getScheduleEvents } from "@/lib/queries";
import { expandEvents, kindMeta } from "@/lib/schedule";
import { dueFields, nextLesson } from "@/lib/homework";

type LessonInfo = { start: string; kind: string; label: string; location: string | null } | null;

async function findNext(userId: string, subjectId: string, lessonAt: Date, kind?: string | null) {
  const to = addDays(lessonAt, 150);
  const events = await getScheduleEvents(userId, lessonAt, to);
  return nextLesson(expandEvents(events, lessonAt, to), subjectId, lessonAt, kind);
}

function info(o: { start: Date; kind: string; location?: string | null } | null): LessonInfo {
  return o ? { start: o.start.toISOString(), kind: o.kind, label: kindMeta(o.kind).label, location: o.location ?? null } : null;
}

/** К какой паре будет срок: следующая пара предмета и следующая пара того же типа */
export async function previewHomework(subjectId: string, lessonAt: string, kind?: string | null): Promise<ActionResult<{ next: LessonInfo; same: LessonInfo }>> {
  return withUser(async (userId) => {
    const at = new Date(lessonAt);
    if (Number.isNaN(at.getTime())) throw new Error("Неверная дата пары");
    const [next, same] = await Promise.all([findNext(userId, subjectId, at), kind ? findNext(userId, subjectId, at, kind) : null]);
    return { next: info(next), same: info(same) };
  });
}

export async function createHomework(input: unknown): Promise<ActionResult<{ id: string; dueAt: string | null }>> {
  return withUser(async (userId) => {
    const parsed = homeworkSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
    const h = parsed.data;
    const subject = await prisma.subject.findFirst({ where: { id: h.subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");

    let due: { dueDate: Date; dueTime: string | null } | null = null;
    let dueAt: string | null = null;
    if (h.due === "date") {
      if (!h.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(h.dueDate)) throw new Error("Укажи дату сдачи");
      due = { dueDate: new Date(`${h.dueDate}T00:00:00.000Z`), dueTime: null };
      dueAt = due.dueDate.toISOString();
    } else {
      const lesson = await findNext(userId, subject.id, h.lessonAt, h.due === "same" ? h.lessonKind : null);
      if (lesson) {
        due = dueFields(lesson.start);
        dueAt = lesson.start.toISOString();
      }
    }

    const task = await prisma.task.create({
      data: {
        userId,
        subjectId: subject.id,
        kind: "HOMEWORK",
        lessonAt: h.lessonAt,
        title: h.title,
        description: h.description || null,
        priority: "MEDIUM",
        status: "PLANNED",
        dueDate: due?.dueDate ?? null,
        dueTime: due?.dueTime ?? null,
      },
      select: { id: true },
    });
    refreshAll();
    return { id: task.id, dueAt };
  });
}
