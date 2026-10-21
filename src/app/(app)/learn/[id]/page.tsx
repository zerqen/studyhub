import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TrackView } from "@/components/learn/track-view";

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [track, subjects] = await Promise.all([
    prisma.subject.findFirst({
      where: { id, userId: user.id, selfStudy: true },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        description: true,
        archived: true,
        linkedSubjectId: true,
        linkedSubject: { select: { id: true, name: true, emoji: true } },
        lectures: {
          orderBy: [{ number: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            number: true,
            title: true,
            summary: true,
            updatedAt: true,
            _count: { select: { questions: true, interactives: true, attachments: true } },
          },
        },
        interactives: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, description: true, updatedAt: true, lecture: { select: { title: true, number: true } } },
        },
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
            lecture: { select: { title: true, number: true } },
            attachments: { select: { id: true, mimeType: true, originalName: true } },
          },
        },
      },
    }),
    prisma.subject.findMany({ where: { userId: user.id, selfStudy: false, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, emoji: true } }),
  ]);
  if (!track) notFound();

  // Конспект целиком не нужен — только есть ли он и сколько в нём текста
  const topics = track.lectures.map((l) => ({
    id: l.id,
    number: l.number,
    title: l.title,
    words: l.summary.trim() ? l.summary.trim().split(/\s+/).length : 0,
    questions: l._count.questions,
    interactives: l._count.interactives,
    files: l._count.attachments,
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <TrackView
      track={{
        id: track.id,
        name: track.name,
        emoji: track.emoji,
        color: track.color,
        description: track.description,
        archived: track.archived,
        linkedSubjectId: track.linkedSubjectId,
        linkedSubject: track.linkedSubject,
      }}
      topics={topics}
      interactives={track.interactives.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() }))}
      questions={JSON.parse(JSON.stringify(track.questions))}
      subjects={subjects}
    />
  );
}
