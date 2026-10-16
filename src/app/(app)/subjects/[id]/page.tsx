import { notFound } from "next/navigation";
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
          ticket: { select: { title: true } },
          attachments: { select: { id: true, mimeType: true, originalName: true } },
        },
      },
      tasks: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
      },
      notes: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, content: true, color: true, updatedAt: true } },
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  });
  if (!subject) notFound();

  const data: SubjectData = {
    ...subject,
    examDate: subject.examDate ? format(subject.examDate, "yyyy-MM-dd") : "",
    tasks: subject.tasks.map((t) => ({ ...t, dueDate: t.dueDate ? t.dueDate.toISOString() : null })),
    notes: subject.notes.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() })),
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
