import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ExamRun } from "@/components/exam/exam-run";

export const metadata = { title: "Пробный экзамен" };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const exam = await prisma.examSession.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      ticketNo: true,
      prepMinutes: true,
      phase: true,
      grade: true,
      score: true,
      startedAt: true,
      answerAt: true,
      finishedAt: true,
      subject: { select: { id: true, name: true, emoji: true, color: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          role: true,
          related: true,
          grade: true,
          note: true,
          attachments: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mimeType: true, size: true } },
          question: {
            select: {
              id: true,
              text: true,
              answer: true,
              explanation: true,
              lecture: { select: { number: true, title: true } },
              attachments: { where: { mimeType: { startsWith: "image/" } }, select: { id: true, originalName: true } },
            },
          },
        },
      },
    },
  });
  if (!exam) notFound();
  return <ExamRun exam={JSON.parse(JSON.stringify(exam))} />;
}
