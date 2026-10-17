import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { PrintButton } from "@/components/subjects/print-button";

export const metadata = { title: "Шпаргалка" };

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ only?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { only } = await searchParams;
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
    select: {
      name: true,
      emoji: true,
      examDate: true,
      questions: {
        where: only === "todo" ? { status: { not: "LEARNED" } } : undefined,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, text: true, answer: true, status: true },
      },
    },
  });
  if (!subject) notFound();

  return (
    <div className="mx-auto max-w-4xl print:max-w-none">
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <a href={`/subjects/${id}`} className="mr-auto text-sm text-muted hover:text-fg">
          ← Назад к предмету
        </a>
        <a href={only === "todo" ? "?" : "?only=todo"} className="text-sm text-accent hover:underline">
          {only === "todo" ? "Показать все вопросы" : "Только невыученные"}
        </a>
        <PrintButton />
      </div>
      <header className="mb-5 border-b border-line pb-3 print:mb-3">
        <h1 className="text-xl font-semibold print:text-base">
          {subject.emoji} {subject.name}
        </h1>
        <p className="text-sm text-muted print:text-xs">
          {subject.questions.length} вопросов{subject.examDate ? ` · экзамен ${formatDate(subject.examDate, "d MMMM yyyy")}` : ""}
        </p>
      </header>
      <ol className="columns-1 gap-6 sm:columns-2 print:columns-2 print:gap-4">
        {subject.questions.map((q, i) => (
          <li key={q.id} className="mb-4 break-inside-avoid text-sm print:mb-2 print:text-[10.5px] print:leading-snug">
            <div className="font-semibold">
              {i + 1}.{" "}
              <span className="inline">
                <Markdown inline>{q.text}</Markdown>
              </span>
            </div>
            {q.answer ? <Markdown className="mt-1 text-fg/80 print:text-black">{q.answer}</Markdown> : <p className="mt-1 italic text-muted">нет ответа</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
