import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { QuestionDetail } from "@/components/questions/question-detail";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const question = await prisma.question.findFirst({
    where: { id, userId: user.id },
    include: {
      subject: { select: { id: true, name: true, color: true, emoji: true } },
      lecture: { select: { id: true, title: true, number: true } },
      tags: { include: { tag: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
      notes: { orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true, content: true, color: true } },
      comments: { include: { attachments: { select: { id: true, originalName: true, mimeType: true, size: true } } }, orderBy: { createdAt: "asc" } },
      attempts: { orderBy: { createdAt: "desc" }, take: 12, select: { id: true, knew: true, createdAt: true } },
      tasks: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!question) notFound();
  return <QuestionDetail question={JSON.parse(JSON.stringify(question))} />;
}
