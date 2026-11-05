import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildFormulaSheet } from "@/lib/formulas";
import { PageHeader } from "@/components/ui/page";
import { FormulaSheet } from "@/components/study/formula-sheet";

export const metadata = { title: "Лист формул" };

export default async function FormulasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      lectures: { orderBy: [{ number: "asc" }, { date: "asc" }], select: { id: true, number: true, title: true, summary: true } },
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, text: true, answer: true, kind: true, lectureId: true } },
    },
  });
  if (!subject) notFound();
  const groups = buildFormulaSheet(subject.lectures, subject.questions);

  return (
    <div>
      <PageHeader back={{ href: `/subjects/${subject.id}`, label: subject.name }} title="Лист формул" description="Собирается сам из ответов на вопросы и конспектов лекций" />
      {groups.length ? <FormulaSheet groups={groups} /> : <p className="card mx-auto max-w-3xl p-10 text-center text-sm text-muted">Формул пока нет. Они появятся, когда в ответах или конспектах будет LaTeX: $$…$$ или $a=b$.</p>}
    </div>
  );
}
