import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { StudyMode } from "@/components/study/study-mode";

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
  ticket: { select: { title: true } },
  lecture: { select: { title: true, number: true } },
  subject: { select: { id: true, name: true, emoji: true, color: true } },
  attachments: { select: { id: true, mimeType: true, originalName: true } },
} as const;

export default async function ReviewPage() {
  const user = await requireUser();
  const now = new Date();
  // Всё, что пора повторить, по всем предметам + новые вопросы (их StudyMode ограничит)
  const questions = await prisma.question.findMany({
    where: { userId: user.id, subject: { archived: false }, OR: [{ srsDue: null }, { srsDue: { lte: now } }] },
    select: studySelect,
    orderBy: [{ srsDue: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    take: 400,
  });
  const due = questions.filter((q) => q.srsReps > 0).length;

  return (
    <div>
      <PageHeader
        title="Повторение"
        description={
          due
            ? `${due} вопросов пора повторить по всем предметам`
            : "Интервальное повторение: каждый вопрос возвращается ровно тогда, когда начинает забываться"
        }
      />
      <StudyMode questions={JSON.parse(JSON.stringify(questions))} showSubject />
      <details className="mx-auto mt-8 max-w-3xl text-sm text-muted">
        <summary className="cursor-pointer font-medium text-fg/80">Как это работает</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>После ответа оцени, как вспомнил: «Забыл», «Трудно», «Хорошо» или «Легко». На кнопке видно, через сколько вопрос вернётся.</p>
          <p>Забытый вопрос повторится в этой же сессии и снова через 10 минут. Остальные — через 1, 3, 7, 16… дней: чем лучше помнишь, тем дальше интервал.</p>
          <p>Вопрос считается выученным, когда интервал дорос до недели. 10–15 минут в день хватает, чтобы к сессии помнить почти всё.</p>
        </div>
      </details>
    </div>
  );
}
