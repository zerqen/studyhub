import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TaskDetail } from "@/components/tasks/task-detail";

const fileSelect = { select: { id: true, originalName: true, mimeType: true, size: true } } as const;

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [task, subjects, questions] = await Promise.all([
    prisma.task.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        subtasks: { orderBy: { sortOrder: "asc" } },
        attachments: fileSelect,
        notes: { orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true, content: true, color: true } },
        tags: { include: { tag: true } },
        questions: { select: { id: true, text: true, status: true } },
        contextualComments: { include: { attachments: fileSelect }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false, selfStudy: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.question.findMany({ where: { userId: user.id }, select: { id: true, text: true, subjectId: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!task) notFound();
  return <TaskDetail task={JSON.parse(JSON.stringify(task))} subjects={subjects} questions={questions} />;
}
