import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectProgress } from "@/lib/progress";
import { labelOf, SUBJECT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty";
import { ProgressBar } from "@/components/ui/badge";
import Link from "next/link";
import { SubjectsHeader } from "@/components/subjects/subjects-header";

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, archived },
    include: { questions: true, tasks: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <SubjectsHeader archived={archived} />
      {subjects.length === 0 ? (
        <EmptyState title={archived ? "Архив пуст" : "Нет предметов"} hint="Создай предмет — это главная единица подготовки." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => {
            const p = subjectProgress({ questions: s.questions, tasks: s.tasks });
            return (
              <Link key={s.id} href={`/subjects/${s.id}`} className="rounded-2xl bg-[var(--bg-elev)] p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{s.emoji}</span>
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {labelOf(SUBJECT_TYPES, s.type)}
                      {s.teacher ? ` · ${s.teacher}` : ""}
                    </div>
                  </div>
                  <span className="ml-auto h-3 w-3 rounded-full" style={{ background: s.color }} />
                </div>
                <ProgressBar value={p} color={s.color} />
                <div className="mt-3 text-xs text-[var(--muted)]">
                  {p}% · {s.questions.length} вопросов · {formatDate(s.examDate)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
