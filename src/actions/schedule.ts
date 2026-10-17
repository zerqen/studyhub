"use server";

import { prisma } from "@/lib/prisma";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { fetchIcs, importIcsText, type ImportOptions, type ImportResult } from "@/lib/schedule-import";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

/** Импорт из загруженного файла .ics */
export async function importScheduleFile(text: string, options: ImportOptions): Promise<ActionResult<ImportResult>> {
  return withUser(async (userId) => {
    if (typeof text !== "string" || text.length > 5 * 1024 * 1024) throw new Error("Файл слишком большой");
    const result = await importIcsText(userId, text, options);
    refreshAll();
    return result;
  });
}

/** Импорт по ссылке; при autoSync ссылка сохраняется и расписание обновляется само раз в 6 часов */
export async function importScheduleUrl(url: string, options: ImportOptions & { autoSync?: boolean }): Promise<ActionResult<ImportResult>> {
  return withUser(async (userId) => {
    const { url: normalized, text } = await fetchIcs(url);
    const result = await importIcsText(userId, text, options);
    await prisma.user.update({
      where: { id: userId },
      data: options.autoSync ? { scheduleUrl: normalized, scheduleSyncedAt: new Date() } : { scheduleSyncedAt: new Date() },
    });
    refreshAll();
    return result;
  });
}

/** «Обновить сейчас» для сохранённой ссылки */
export async function syncScheduleNow(): Promise<ActionResult<ImportResult>> {
  return withUser(async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { scheduleUrl: true } });
    if (!user?.scheduleUrl) throw new Error("Ссылка на расписание не сохранена");
    const { text } = await fetchIcs(user.scheduleUrl);
    const result = await importIcsText(userId, text, { createSubjects: true, fillSubjects: true, removeMissing: true });
    await prisma.user.update({ where: { id: userId }, data: { scheduleSyncedAt: new Date() } });
    refreshAll();
    return result;
  });
}

/** Отключить автообновление; removeEvents — заодно удалить импортированные пары */
export async function disconnectSchedule(removeEvents: boolean): Promise<ActionResult<{ removed: number }>> {
  return withUser(async (userId) => {
    await prisma.user.update({ where: { id: userId }, data: { scheduleUrl: null, scheduleSyncedAt: null } });
    let removed = 0;
    if (removeEvents) removed = (await prisma.calendarEvent.deleteMany({ where: { userId, externalId: { not: null } } })).count;
    refreshAll();
    return { removed };
  });
}

/** Открыть конспект лекции для пары из расписания: найти лекцию этого дня или создать новую */
export async function openLectureForEvent(subjectId: string, startAt: string): Promise<ActionResult<{ id: string }>> {
  return withUser(async (userId) => {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
    if (!subject) throw new Error("Предмет не найден");
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) throw new Error("Неверная дата");
    // День по Москве
    const msk = new Date(start.getTime() + 3 * 3600_000);
    const dayStart = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - 3 * 3600_000);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const existing = await prisma.lecture.findFirst({
      where: { userId, subjectId, date: { gte: dayStart, lt: dayEnd } },
      select: { id: true },
    });
    if (existing) return { id: existing.id };
    const last = await prisma.lecture.aggregate({ where: { subjectId }, _max: { number: true } });
    const lecture = await prisma.lecture.create({
      data: {
        userId,
        subjectId,
        number: (last._max.number ?? 0) + 1,
        title: `Лекция от ${format(msk, "d MMMM", { locale: ru })}`,
        date: start,
      },
      select: { id: true },
    });
    refreshAll();
    return { id: lecture.id };
  });
}
