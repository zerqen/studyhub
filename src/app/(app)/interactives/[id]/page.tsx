import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subjectOptions } from "@/lib/interactive-queries";
import { InteractiveView } from "@/components/interactive/interactive-view";

export default async function InteractivePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [item, subjects] = await Promise.all([
    prisma.interactive.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        size: true,
        updatedAt: true,
        subjectId: true,
        lectureId: true,
        subject: { select: { id: true, name: true, emoji: true, color: true } },
        lecture: { select: { id: true, title: true, number: true } },
      },
    }),
    subjectOptions(user.id),
  ]);
  if (!item) notFound();
  return <InteractiveView item={JSON.parse(JSON.stringify(item))} subjects={subjects} />;
}
