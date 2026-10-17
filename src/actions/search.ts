"use server";

import { prisma } from "@/lib/prisma";
import { withUser, type ActionResult } from "@/lib/action";

export type SearchHit = {
  type: "subject" | "task" | "subtask" | "ticket" | "question" | "note" | "file" | "tag" | "lecture";
  id: string;
  title: string;
  href: string;
  hint?: string;
};

export async function globalSearch(query: string): Promise<ActionResult<SearchHit[]>> {
  return withUser(async (userId) => {
    const q = query.trim();
    if (q.length < 1) return [];
    const contains = { contains: q, mode: "insensitive" as const };
    const [subjects, tasks, subtasks, tickets, questions, notes, files, tags, lectures] = await Promise.all([
      prisma.subject.findMany({ where: { userId, OR: [{ name: contains }, { teacher: contains }] }, take: 8 }),
      prisma.task.findMany({ where: { userId, OR: [{ title: contains }, { description: contains }] }, take: 8 }),
      prisma.subtask.findMany({ where: { userId, title: contains }, take: 8 }),
      prisma.ticket.findMany({
        where: { userId, OR: [{ title: contains }, { description: contains }] },
        include: { subject: true },
        take: 8,
      }),
      prisma.question.findMany({
        where: { userId, OR: [{ text: contains }, { answer: contains }] },
        include: { ticket: true },
        take: 8,
      }),
      prisma.note.findMany({ where: { userId, OR: [{ title: contains }, { content: contains }] }, take: 8 }),
      prisma.attachment.findMany({ where: { userId, originalName: contains }, take: 8 }),
      prisma.tag.findMany({ where: { userId, name: contains }, take: 8 }),
      prisma.lecture.findMany({
        where: { userId, OR: [{ title: contains }, { summary: contains }] },
        select: { id: true, title: true, number: true, subject: { select: { name: true } } },
        take: 8,
      }),
    ]);

    const hits: SearchHit[] = [
      ...subjects.map((s) => ({ type: "subject" as const, id: s.id, title: s.name, href: `/subjects/${s.id}` })),
      ...lectures.map((l) => ({
        type: "lecture" as const,
        id: l.id,
        title: `${l.number ? `${l.number}. ` : ""}${l.title}`,
        href: `/lectures/${l.id}`,
        hint: l.subject.name,
      })),
      ...tasks.map((t) => ({ type: "task" as const, id: t.id, title: t.title, href: `/tasks/${t.id}` })),
      ...subtasks.map((t) => ({
        type: "subtask" as const,
        id: t.id,
        title: t.title,
        href: `/tasks/${t.taskId}`,
        hint: "Подзадача",
      })),
      ...tickets.map((t) => ({
        type: "ticket" as const,
        id: t.id,
        title: t.title,
        href: `/subjects/${t.subjectId}?tab=questions`,
        hint: t.subject.name,
      })),
      ...questions.map((t) => ({
        type: "question" as const,
        id: t.id,
        title: t.text.slice(0, 80),
        href: `/questions/${t.id}`,
        hint: t.ticket?.title ?? "Вопрос",
      })),
      ...notes.map((t) => ({ type: "note" as const, id: t.id, title: t.title, href: `/notes?open=${t.id}` })),
      ...files.map((t) => ({ type: "file" as const, id: t.id, title: t.originalName, href: `/files` })),
      ...tags.map((t) => ({ type: "tag" as const, id: t.id, title: `#${t.name}`, href: `/tasks?tag=${t.name}` })),
    ];
    return hits.slice(0, 30);
  });
}
