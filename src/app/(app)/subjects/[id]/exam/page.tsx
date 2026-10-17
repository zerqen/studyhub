import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ticketNumbers } from "@/lib/exam";
import { ExamSetup } from "@/components/exam/exam-setup";

export const metadata = { title: "Режим экзамена" };

export default async function SubjectExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      emoji: true,
      color: true,
      examDate: true,
      questions: { select: { kind: true, ticketNo: true, status: true } },
      examSessions: {
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          id: true,
          ticketNo: true,
          phase: true,
          grade: true,
          score: true,
          startedAt: true,
          finishedAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!subject) notFound();
  const theory = subject.questions.filter((q) => q.kind !== "PROBLEM").length;
  const problems = subject.questions.length - theory;
  return (
    <ExamSetup
      subject={{ id: subject.id, name: subject.name, emoji: subject.emoji, color: subject.color, examDate: subject.examDate?.toISOString() ?? null }}
      stats={{ theory, problems, tickets: ticketNumbers(subject.questions) }}
      history={subject.examSessions.map((s) => ({
        id: s.id,
        ticketNo: s.ticketNo,
        phase: s.phase,
        grade: s.grade,
        score: s.score,
        items: s._count.items,
        startedAt: s.startedAt.toISOString(),
        finishedAt: s.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
