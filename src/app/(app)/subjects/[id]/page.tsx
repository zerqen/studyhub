import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectProgress, learnedShare, taskShare } from "@/lib/progress";
import { SubjectWorkspace, type SubjectData } from "@/components/subjects/subject-workspace";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      selfStudy: true,
      tracks: { where: { archived: false }, select: { id: true, name: true, emoji: true, color: true, _count: { select: { lectures: true } } } },
      name: true,
      emoji: true,
      color: true,
      teacher: true,
      description: true,
      type: true,
      examDate: true,
      archived: true,
      questions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          text: true,
          answer: true,
          explanation: true,
          status: true,
          difficulty: true,
          srsDue: true,
          srsInterval: true,
          srsEase: true,
          srsReps: true,
          srsLapses: true,
          kind: true,
          ticketNo: true,
          ticket: { select: { title: true } },
          lecture: { select: { title: true, number: true } },
          attachments: { select: { id: true, mimeType: true, originalName: true } },
        },
      },
      tasks: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
      },
      notes: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, content: true, color: true, updatedAt: true } },
      attachments: { where: { lectureId: null }, orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true, size: true } },
      interactives: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, description: true, updatedAt: true, lecture: { select: { title: true, number: true } } },
      },
      lectures: {
        orderBy: [{ number: "asc" }, { date: "asc" }],
        select: {
          id: true,
          number: true,
          title: true,
          date: true,
          _count: { select: { questions: true } },
          attachments: { select: { mimeType: true } },
        },
      },
    },
  });
  if (!subject) notFound();
  // Направление саморазвития живёт в разделе «Изучаю»
  if (subject.selfStudy) redirect(`/learn/${subject.id}`);

  const data: SubjectData = {
    ...subject,
    examDate: subject.examDate ? format(subject.examDate, "yyyy-MM-dd") : "",
    tasks: subject.tasks.map((t) => ({ ...t, dueDate: t.dueDate ? t.dueDate.toISOString() : null })),
    notes: subject.notes.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() })),
    tracks: subject.tracks.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, color: t.color, topics: t._count.lectures })),
    interactives: subject.interactives.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() })),
    questions: subject.questions.map((q) => ({ ...q, srsDue: q.srsDue ? q.srsDue.toISOString() : null })),
    lectures: subject.lectures.map((l) => ({
      id: l.id,
      number: l.number,
      title: l.title,
      date: l.date ? l.date.toISOString() : null,
      questions: l._count.questions,
      photos: l.attachments.filter((a) => a.mimeType.startsWith("image/")).length,
      media: l.attachments.filter((a) => a.mimeType.startsWith("audio/") || a.mimeType.startsWith("video/")).length,
    })),
  };

  return (
    <SubjectWorkspace
      initialTab={tab ?? "questions"}
      progress={subjectProgress({ questions: subject.questions, tasks: subject.tasks })}
      qProgress={learnedShare(subject.questions)}
      taskProgress={taskShare(subject.tasks)}
      subject={data}
    />
  );
}
