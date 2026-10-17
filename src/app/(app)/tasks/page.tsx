import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TasksBoard } from "@/components/tasks/tasks-board";

export const metadata = { title: "Задачи" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ open?: string; tag?: string }> }) {
  const sp = await searchParams;
  // старые ссылки вида /tasks?open=ID (уведомления, календарь) ведут на страницу задачи
  if (sp.open) redirect(`/tasks/${sp.open}`);
  const user = await requireUser();
  const [tasks, subjects, questions] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        subjectId: true,
        startDate: true,
        dueDate: true,
        dueTime: true,
        kind: true,
        priority: true,
        status: true,
        subject: { select: { id: true, name: true, color: true } },
        subtasks: { select: { status: true } },
        tags: { select: { tag: { select: { name: true } } } },
        questions: { select: { id: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.question.findMany({ where: { userId: user.id }, select: { id: true, text: true, subjectId: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <TasksBoard tag={sp.tag} subjects={subjects} questions={questions} tasks={JSON.parse(JSON.stringify(tasks))} />;
}
