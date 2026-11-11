import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectShort } from "@/lib/home";
import { plural, semesterText, untilText } from "@/lib/subject-view";
import { taskKind } from "@/lib/task-kinds";
import { daysUntil, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty";
import { SubjectsHeader } from "@/components/subjects/subjects-header";

export const metadata = { title: "Предметы" };

type Row = {
  id: string;
  name: string;
  color: string;
  type: string;
  teacher: string | null;
  examDate: Date | null;
  questions: { status: string }[];
  tasks: { status: string; kind: string; title: string; dueDate: Date | null }[];
};

const SECTIONS: { id: string; label: string; types: string[] }[] = [
  { id: "exam", label: "Экзамены", types: ["EXAM"] },
  { id: "credit", label: "Зачёты", types: ["CREDIT"] },
  { id: "other", label: "Остальное", types: ["TEST", "COURSEWORK", "HOMEWORK", "OTHER"] },
];

/** Ближайший открытый срок: «ДЗ — чт 12», «КР — завтра» */
function nextDue(tasks: Row["tasks"]) {
  const open = tasks
    .filter((t) => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && (daysUntil(t.dueDate) ?? -1) >= 0)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const t = open[0];
  if (!t?.dueDate) return null;
  const d = daysUntil(t.dueDate) ?? 0;
  const what = t.kind === "TASK" ? t.title : taskKind(t.kind).label;
  const when = d === 0 ? "сегодня" : d === 1 ? "завтра" : d < 7 ? formatDate(t.dueDate, "EEEEEE d") : formatDate(t.dueDate, "d MMMM");
  return { text: `${what} — ${when}`, urgent: d <= 1 };
}

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string; new?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const subjects: Row[] = await prisma.subject.findMany({
    where: { userId: user.id, archived, selfStudy: false },
    select: {
      id: true,
      name: true,
      color: true,
      type: true,
      teacher: true,
      examDate: true,
      questions: { select: { status: true } },
      tasks: { select: { status: true, kind: true, title: true, dueDate: true } },
    },
    orderBy: [{ examDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  const sections = archived
    ? [{ id: "all", label: "", items: subjects }]
    : SECTIONS.map((s) => ({ ...s, items: subjects.filter((x) => s.types.includes(x.type)) })).filter((s) => s.items.length);

  return (
    <div>
      <SubjectsHeader archived={archived} count={subjects.length} semester={semesterText(new Date())} startOpen={sp.new === "1"} />
      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={archived ? "Архив пуст" : "Нет предметов"}
          hint={archived ? "Сюда попадают предметы, которые уже сданы." : "Создай предмет — это главная единица подготовки."}
        />
      ) : (
        <div className="space-y-6">
          {sections.map((sec) => {
            const firstExam = sec.id === "exam" ? sec.items.map((s) => daysUntil(s.examDate)).find((d) => d !== null && d >= 0) : undefined;
            const note = sec.id === "exam" && firstExam !== undefined && firstExam !== null ? `первый — ${untilText(firstExam)}` : `${sec.items.length} ${plural(sec.items.length, "предмет", "предмета", "предметов")}`;
            return (
              <section key={sec.id} aria-label={sec.label || "Предметы"} className="flex flex-col gap-3">
                {sec.label ? (
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="heading text-[22px]">{sec.label}</h2>
                    <span className="text-[13px] text-muted">{note}</span>
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-3">
                  {sec.items.map((s) => {
                    const learned = s.questions.filter((q) => q.status === "LEARNED").length;
                    const openTasks = s.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length;
                    const next = nextDue(s.tasks);
                    const share = s.questions.length ? Math.round((learned / s.questions.length) * 100) : 0;
                    const examSoon = s.examDate ? daysUntil(s.examDate) : null;
                    return (
                      <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover flex flex-col gap-3 rounded-[14px] px-[18px] py-4">
                        <div className="flex items-start gap-3">
                          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] text-[13px] font-bold" style={{ background: `${s.color}1f`, color: s.color }} aria-hidden>
                            {subjectShort(s.name)}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[15px] font-semibold leading-snug">{s.name}</span>
                            <span className="truncate text-xs text-muted">{s.teacher || "преподаватель не указан"}</span>
                          </span>
                          {s.examDate ? (
                            <span className={`heading shrink-0 whitespace-nowrap text-sm ${examSoon !== null && examSoon >= 0 && examSoon <= 3 ? "text-urgent" : ""}`}>
                              {formatDate(s.examDate, "d MMM").replace(".", "")}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted">
                          <span>{s.questions.length ? `вопросы ${learned} / ${s.questions.length}` : "вопросов нет"}</span>
                          <span>{openTasks ? `${openTasks} ${plural(openTasks, "задача", "задачи", "задач")}` : "задач нет"}</span>
                          {next ? <span className={next.urgent ? "font-semibold text-urgent" : ""}>{next.text}</span> : null}
                        </div>
                        <div
                          className="h-1 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle"
                          role="progressbar"
                          aria-label={`Выучено вопросов: ${s.name}`}
                          aria-valuenow={share}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: s.color }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
