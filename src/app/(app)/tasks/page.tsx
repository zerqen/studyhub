import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TasksBoard } from "@/components/tasks/tasks-board";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; tag?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [tasks, subjects, questions] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      include: {
        subject: true,
        subtasks: { orderBy: { sortOrder: "asc" } },
        attachments: true,
        tags: { include: { tag: true } },
        questions: { select: { id: true, text: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, orderBy: { name: "asc" } }),
    prisma.question.findMany({ where: { userId: user.id }, select: { id: true, text: true, subjectId: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <TasksBoard
      openId={sp.open}
      tag={sp.tag}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      questions={questions}
      tasks={JSON.parse(JSON.stringify(tasks))}
    />
  );
}
