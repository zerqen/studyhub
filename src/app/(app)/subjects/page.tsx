import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectProgress } from "@/lib/progress";
import { labelOf, SUBJECT_TYPES } from "@/lib/constants";
import { daysUntil, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty";
import { ProgressRing } from "@/components/ui/badge";
import { SubjectsHeader } from "@/components/subjects/subjects-header";

export const metadata = { title: "Предметы" };

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, archived },
    select: {
      id: true,
      name: true,
      emoji: true,
      color: true,
      type: true,
      teacher: true,
      examDate: true,
      questions: { select: { status: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <SubjectsHeader archived={archived} count={subjects.length} />
      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={archived ? "Архив пуст" : "Нет предметов"}
          hint={archived ? "Сюда попадают предметы, которые уже сданы." : "Создай предмет — это главная единица подготовки."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const p = subjectProgress({ questions: s.questions, tasks: s.tasks });
            const learned = s.questions.filter((q) => q.status === "LEARNED").length;
            const d = daysUntil(s.examDate);
            return (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${s.color}1a` }}>
                    {s.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted">
                      {labelOf(SUBJECT_TYPES, s.type)}
                      {s.teacher ? ` · ${s.teacher}` : ""}
                    </div>
                  </div>
                  <div className="relative">
                    <ProgressRing value={p} color={s.color} size={40} />
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">{p}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span>
                    {s.questions.length ? `${learned}/${s.questions.length} вопросов` : "нет вопросов"}
                    {s.tasks.length ? ` · ${s.tasks.length} задач` : ""}
                  </span>
                  <span className={d !== null && d >= 0 && d <= 3 ? "font-medium text-danger" : ""}>
                    {s.examDate ? formatDate(s.examDate, "d MMM") : "без даты"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
