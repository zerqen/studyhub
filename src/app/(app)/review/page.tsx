import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildDecks } from "@/lib/review-view";
import { ReviewHome } from "@/components/study/review-home";

export const metadata = { title: "Повторение" };

const studySelect = {
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
  kind: true,
  ticketNo: true,
  ticket: { select: { title: true } },
  lecture: { select: { title: true, number: true } },
  subject: { select: { id: true, name: true, emoji: true, color: true } },
  attachments: { select: { id: true, mimeType: true, originalName: true } },
} as const;

export default async function ReviewPage() {
  const user = await requireUser();
  const now = new Date();
  const [subjects, stats, questions] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id, archived: false },
      select: { id: true, name: true, color: true, type: true, examDate: true, selfStudy: true },
    }),
    // Лёгкая выборка по всем вопросам — для чисел на карточках предметов
    prisma.question.findMany({
      where: { userId: user.id, subject: { archived: false } },
      select: { subjectId: true, status: true, srsReps: true, srsDue: true },
    }),
    // Всё, что пора повторить, + новые (их StudyMode ограничит)
    prisma.question.findMany({
      where: { userId: user.id, subject: { archived: false }, OR: [{ srsDue: null }, { srsDue: { lte: now } }] },
      select: studySelect,
      orderBy: [{ srsDue: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      take: 600,
    }),
  ]);
  const { decks, empty } = buildDecks(subjects, stats, now);

  return <ReviewHome decks={decks} empty={empty} questions={JSON.parse(JSON.stringify(questions))} />;
}
