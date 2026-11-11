import type { Grade } from "@/lib/srs";

/** Кнопки оценок (цвета макета). Первый класс — цвет текста: им же красятся числа в итогах сессии. */
export const gradeStyle: Record<Grade, string> = {
  0: "text-urgent border-[#F3C7A6] bg-[#FDF3EA] hover:bg-urgent-soft dark:border-urgent/40 dark:bg-urgent/10",
  1: "text-muted border-line bg-surface hover:bg-subtle",
  2: "text-muted border-line bg-surface hover:bg-subtle",
  3: "text-[#234AB0] border-[#B7C8F3] bg-[#EEF2FD] hover:bg-accent-soft dark:text-accent dark:border-accent/40 dark:bg-accent/10",
};
