import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TaskDetail } from "@/components/tasks/task-detail";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [task, subjects, questions] = await Promise.all([
    prisma.task.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: true,
        subtasks: { orderBy: { sortOrder: "asc" } },
        attachments: true,
        notes: { orderBy: { updatedAt: "desc" }, take: 6 },
        tags: { include: { tag: true } },
        questions: { select: { id: true, text: true, status: true } },
        contextualComments: { include: { attachments: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, orderBy: { name: "asc" } }),
    prisma.question.findMany({ where: { userId: user.id }, select: { id: true, text: true, subjectId: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!task) notFound();
  return <TaskDetail task={JSON.parse(JSON.stringify(task))} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} questions={questions} />;
}
