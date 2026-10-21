import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { interactiveCardSelect, subjectOptions } from "@/lib/interactive-queries";
import { InteractivesGallery } from "@/components/interactive/interactives-gallery";

export const metadata = { title: "Интерактивы" };

export default async function InteractivesPage() {
  const user = await requireUser();
  const [items, subjects] = await Promise.all([
    prisma.interactive.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: interactiveCardSelect }),
    subjectOptions(user.id),
  ]);
  return <InteractivesGallery items={JSON.parse(JSON.stringify(items))} subjects={subjects} />;
}
