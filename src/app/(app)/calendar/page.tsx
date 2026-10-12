import { addMonths, subMonths } from "date-fns";
import { requireUser } from "@/lib/session";
import { getCalendarData } from "@/lib/queries";
import { CalendarApp } from "@/components/calendar/calendar-app";
import { prisma } from "@/lib/prisma";

export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const [data, subjects] = await Promise.all([
    getCalendarData(user.id, subMonths(now, 12), addMonths(now, 12)),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <CalendarApp
      tasks={data.tasks.map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null, subject: task.subject ? { id: task.subject.id, name: task.subject.name, color: task.subject.color } : null }))}
      exams={data.subjects.map((subject) => ({ id: subject.id, name: subject.name, color: subject.color, examDate: subject.examDate?.toISOString() ?? null }))}
      events={data.events.map((event) => ({ id: event.id, title: event.title, startAt: event.startAt.toISOString(), color: event.color, subject: event.subject ? { color: event.subject.color } : null }))}
      subjects={subjects}
    />
  );
}
