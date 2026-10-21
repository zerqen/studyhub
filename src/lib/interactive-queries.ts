import { prisma } from "./prisma";
import type { SubjectOption } from "@/components/interactive/interactive-form";

/** Предметы с лекциями — для выбора, куда прикрепить схему */
export async function subjectOptions(userId: string): Promise<SubjectOption[]> {
  return prisma.subject.findMany({
    where: { userId, archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      emoji: true,
      lectures: { orderBy: [{ number: "asc" }, { date: "asc" }], select: { id: true, title: true, number: true } },
    },
  });
}

/** Поля карточки схемы (без самого HTML — он тяжёлый и отдаётся отдельно) */
export const interactiveCardSelect = {
  id: true,
  title: true,
  description: true,
  updatedAt: true,
  lecture: { select: { title: true, number: true } },
  subject: { select: { id: true, name: true, emoji: true, color: true } },
} as const;
