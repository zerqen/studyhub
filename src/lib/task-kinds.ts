/** Типы задач и шаблоны этапов. Даты этапов пользователь ставит сам. */

export const TASK_KINDS = [
  { value: "HOMEWORK", label: "ДЗ", full: "Домашка", className: "bg-accent/10 text-accent" },
  { value: "LAB", label: "Лаба", full: "Лабораторная", className: "bg-[#14b8a6]/15 text-[#0f8f7f] dark:text-[#2dd4bf]" },
  { value: "TEST", label: "КР", full: "Контрольная", className: "bg-warning/15 text-warning" },
  { value: "DRAWING", label: "Чертёж", full: "Чертёж", className: "bg-[#a855f7]/12 text-[#9333ea] dark:text-[#c084fc]" },
  { value: "TASK", label: "Другое", full: "Другое", className: "bg-subtle text-muted" },
] as const;

export type TaskKind = (typeof TASK_KINDS)[number]["value"];
export const TASK_KIND_VALUES = TASK_KINDS.map((k) => k.value) as [TaskKind, ...TaskKind[]];

export function taskKind(value?: string | null) {
  return TASK_KINDS.find((k) => k.value === value) ?? TASK_KINDS[TASK_KINDS.length - 1];
}

/** Шаблоны этапов — их можно поправить в форме перед созданием */
export const KIND_STAGES: Partial<Record<TaskKind, string[]>> = {
  LAB: [
    "Прочитать методичку",
    "Теория в конспект",
    "Подготовить таблицы",
    "Выполнить на паре",
    "Расчёты и графики",
    "Оформить отчёт",
    "Выучить вопросы к защите",
    "Защитить",
  ],
  TEST: ["Составить список тем", "Повторить конспекты", "Прорешать типовые задачи", "Решить пробный вариант", "Разобрать ошибки"],
  DRAWING: ["Получить вариант и задание", "Эскиз", "Чертёж", "Проверить по методичке", "Сдать"],
};
