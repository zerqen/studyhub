import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { taskBySlug, tasks } from "@/content/embedded";
import { TaskView } from "@/components/embedded/task-view";

export default async function EmbeddedTaskPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const task = taskBySlug(slug);
  if (!task) notFound();
  const row = await prisma.embeddedProgress.findUnique({
    where: { userId_taskSlug: { userId: user.id, taskSlug: slug } },
    select: { code: true, solved: true, hintsShown: true, revealed: true },
  });
  const index = tasks.findIndex((t) => t.slug === slug);
  const nextTask = tasks[index + 1];
  const clientTask = { ...task, wrongSolutions: undefined };
  return (
    <TaskView
      key={slug}
      task={clientTask}
      initial={{ code: row?.code ?? null, solved: row?.solved ?? false, hintsShown: row?.hintsShown ?? 0, revealed: row?.revealed ?? false }}
      next={nextTask ? { slug: nextTask.slug, title: nextTask.title } : null}
    />
  );
}
