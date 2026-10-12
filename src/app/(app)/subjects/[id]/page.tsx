import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectProgress, learnedShare, taskShare } from "@/lib/progress";
import { SubjectWorkspace } from "@/components/subjects/subject-workspace";
import { format } from "date-fns";

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
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { attachments: true, tags: { include: { tag: true } } },
      },
      tasks: { include: { subtasks: true, tags: { include: { tag: true } } }, orderBy: { dueDate: "asc" } },
      notes: { orderBy: { updatedAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!subject) notFound();

  const progress = subjectProgress({
    questions: subject.questions,
    tasks: subject.tasks,
  });

  return (
    <SubjectWorkspace
      tab={tab ?? "questions"}
      progress={progress}
      qProgress={learnedShare(subject.questions)}
      taskProgress={taskShare(subject.tasks)}
      subject={{
        ...subject,
        examDate: subject.examDate ? format(subject.examDate, "yyyy-MM-dd") : "",
        createdAt: subject.createdAt.toISOString(),
        questions: subject.questions.map((q) => ({
          ...q,
          createdAt: q.createdAt.toISOString(),
          tags: q.tags.map((x) => x.tag.name),
        })),
        tasks: subject.tasks.map((t) => ({
          ...t,
          dueDate: t.dueDate ? format(t.dueDate, "yyyy-MM-dd") : "",
          startDate: t.startDate ? format(t.startDate, "yyyy-MM-dd") : "",
          tags: t.tags.map((x) => x.tag.name),
        })),
        notes: subject.notes.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() })),
      }}
    />
  );
}
