import { addMonths, subMonths } from "date-fns";
import { requireUser } from "@/lib/session";
import { getCalendarData, getScheduleEvents } from "@/lib/queries";
import { CalendarApp } from "@/components/calendar/calendar-app";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Календарь" };

export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const from = subMonths(now, 6);
  const to = addMonths(now, 12);
  const [data, events, subjects, sync] = await Promise.all([
    getCalendarData(user.id, from, to),
    getScheduleEvents(user.id, from, to),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { scheduleUrl: true, scheduleSyncedAt: true } }),
  ]);
  return (
    <CalendarApp
      tasks={data.tasks.map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null, lessonAt: task.lessonAt?.toISOString() ?? null }))}
      exams={data.subjects.map((subject) => ({ ...subject, examDate: subject.examDate?.toISOString() ?? null }))}
      events={JSON.parse(JSON.stringify(events))}
      subjects={subjects}
      sync={{ url: sync?.scheduleUrl ?? null, syncedAt: sync?.scheduleSyncedAt?.toISOString() ?? null }}
    />
  );
}
