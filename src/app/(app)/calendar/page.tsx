import { addMonths, subMonths } from "date-fns";
import { requireUser } from "@/lib/session";
import { getCalendarData } from "@/lib/queries";
import { CalendarApp } from "@/components/calendar/calendar-app";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Календарь" };

export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const [data, subjects] = await Promise.all([
    getCalendarData(user.id, subMonths(now, 6), addMonths(now, 12)),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <CalendarApp
      tasks={data.tasks.map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null }))}
      exams={data.subjects.map((subject) => ({ ...subject, examDate: subject.examDate?.toISOString() ?? null }))}
      events={data.events.map((event) => ({ ...event, startAt: event.startAt.toISOString() }))}
      subjects={subjects}
    />
  );
}
