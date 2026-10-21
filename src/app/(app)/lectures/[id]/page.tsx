import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { LectureView } from "@/components/lectures/lecture-view";

// Распознавание фото тетради (ИИ со зрением) может занять до минуты
export const maxDuration = 120;

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lecture = await prisma.lecture.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      number: true,
      title: true,
      date: true,
      summary: true,
      transcript: true,
      subject: { select: { id: true, name: true, emoji: true, color: true, selfStudy: true } },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mimeType: true, size: true } },
      interactives: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, description: true, updatedAt: true } },
      questions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          text: true,
          answer: true,
          explanation: true,
          status: true,
          difficulty: true,
          srsDue: true,
          srsInterval: true,
          srsEase: true,
          srsReps: true,
          srsLapses: true,
          attachments: { select: { id: true, mimeType: true, originalName: true } },
        },
      },
    },
  });
  if (!lecture) notFound();
  const [prev, next] = await Promise.all([
    prisma.lecture.findFirst({
      where: { subjectId: lecture.subject.id, userId: user.id, number: { lt: lecture.number ?? 0 } },
      orderBy: { number: "desc" },
      select: { id: true, number: true, title: true },
    }),
    prisma.lecture.findFirst({
      where: { subjectId: lecture.subject.id, userId: user.id, number: { gt: lecture.number ?? 0 } },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true },
    }),
  ]);
  return (
    <LectureView
      lecture={JSON.parse(JSON.stringify({ ...lecture, date: lecture.date ? format(lecture.date, "yyyy-MM-dd") : "" }))}
      prev={prev}
      next={next}
    />
  );
}
