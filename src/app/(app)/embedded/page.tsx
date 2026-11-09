import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { blocks, tasks, tasksOfBlock } from "@/content/embedded";

export const metadata = { title: "Embedded" };

export default async function EmbeddedPage() {
  const user = await requireUser();
  const rows = await prisma.embeddedProgress.findMany({ where: { userId: user.id, solved: true }, select: { taskSlug: true } });
  const solved = new Set(rows.map((r) => r.taskSlug));
  const done = tasks.filter((t) => solved.has(t.slug)).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Embedded" description={`Тренажёр C и C++ для микроконтроллеров. Решено ${done} из ${tasks.length}.`} />
      <div className="space-y-4">
        {blocks.map((block) => (
          <section key={block.id} className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">{block.title}</h2>
              <p className="mt-0.5 text-sm text-muted">{block.description}</p>
            </div>
            <ul className="divide-y divide-line">
              {tasksOfBlock(block.id).map((task) => (
                <li key={task.slug}>
                  <Link href={`/embedded/${task.slug}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    {solved.has(task.slug) ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{task.title}</span>
                      <span className="block text-[13px] text-muted">{task.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {block.plannedTopics.map((topic) => (
                <li key={topic} className="px-4 py-2.5 text-sm text-muted">
                  {topic}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
