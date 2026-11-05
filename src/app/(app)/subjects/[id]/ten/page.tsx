import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pickWeakest } from "@/lib/weakest";
import { PageHeader } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { StudyMode } from "@/components/study/study-mode";
import { TenMinutesTimer } from "@/components/study/ten-minutes";

export const metadata = { title: "10 минут" };

export default async function TenMinutesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      emoji: true,
      color: true,
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
          kind: true,
          ticketNo: true,
          ticket: { select: { title: true } },
          lecture: { select: { title: true, number: true } },
          attachments: { select: { id: true, mimeType: true, originalName: true } },
        },
      },
    },
  });
  if (!subject) notFound();
  const weakest = pickWeakest(subject.questions);

  return (
    <div>
      <PageHeader
        back={{ href: `/subjects/${subject.id}`, label: subject.name }}
        title="10 минут к экзамену"
        description={`${subject.emoji} Самые слабые вопросы предмета: ${weakest.length}`}
        actions={weakest.length ? <TenMinutesTimer /> : null}
      />
      {weakest.length ? (
        <StudyMode questions={JSON.parse(JSON.stringify(weakest))} color={subject.color} fixed />
      ) : (
        <div className="card mx-auto max-w-3xl p-10 text-center">
          <p className="font-medium">Пока нечего тренировать</p>
          <p className="mt-1 text-sm text-muted">Нужны теоретические вопросы с ответами.</p>
          <Link href={`/subjects/${subject.id}`} className={buttonClass("secondary", "md", "mt-4")}>
            К предмету
          </Link>
        </div>
      )}
    </div>
  );
}
