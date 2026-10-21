import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { LearnHome } from "@/components/learn/learn-home";

export const metadata = { title: "Изучаю" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const archived = (await searchParams).archived === "1";
  const [tracks, recent, subjects, archivedCount] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id, selfStudy: true, archived },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        description: true,
        updatedAt: true,
        linkedSubject: { select: { id: true, name: true, emoji: true } },
        _count: { select: { lectures: true, questions: true, interactives: true } },
        lectures: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      },
    }),
    archived
      ? Promise.resolve([])
      : prisma.lecture.findMany({
          where: { userId: user.id, subject: { selfStudy: true, archived: false } },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, title: true, number: true, updatedAt: true, subject: { select: { id: true, name: true, emoji: true, color: true } } },
        }),
    prisma.subject.findMany({ where: { userId: user.id, selfStudy: false, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, emoji: true } }),
    prisma.subject.count({ where: { userId: user.id, selfStudy: true, archived: true } }),
  ]);

  // Свежесть направления — по последней правке темы
  const items = tracks
    .map((t) => {
      const last = t.lectures[0]?.updatedAt && t.lectures[0].updatedAt > t.updatedAt ? t.lectures[0].updatedAt : t.updatedAt;
      return {
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        color: t.color,
        description: t.description,
        linkedSubject: t.linkedSubject,
        topics: t._count.lectures,
        questions: t._count.questions,
        interactives: t._count.interactives,
        lastAt: last.toISOString(),
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <LearnHome
      archived={archived}
      archivedCount={archivedCount}
      tracks={items}
      recent={recent.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))}
      subjects={subjects}
    />
  );
}
