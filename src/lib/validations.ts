import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Имя слишком короткое").max(80),
    email: z.string().trim().email("Некорректный email").max(120),
    password: z.string().min(8, "Минимум 8 символов").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Пароли не совпадают" });

export const loginSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Введите текущий пароль"),
    password: z.string().min(8, "Минимум 8 символов").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Пароли не совпадают" });

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(120),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "Цвет в формате #RRGGBB"),
  emoji: z.string().min(1).max(8),
  teacher: z.string().trim().max(120).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum(["EXAM", "CREDIT", "TEST", "COURSEWORK", "HOMEWORK", "OTHER"]),
  examDate: optionalDate,
  archived: z.boolean().optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Название обязательно").max(200),
  description: z.string().max(8000).optional().nullable(),
  subjectId: z.string().optional().nullable(),
  startDate: optionalDate,
  dueDate: optionalDate,
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "OVERDUE", "CANCELLED"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  questionId: z.string().optional().nullable(),
  // ДЗ, лаба, КР, чертёж, другое
  kind: z.enum(["TASK", "HOMEWORK", "LAB", "TEST", "DRAWING"]).optional(),
  // Этапы-подзадачи (шаблон по типу), даты — по желанию
  stages: z
    .array(
      z.union([
        z.string().trim().min(1).max(200),
        z.object({ title: z.string().trim().min(1).max(200), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")) }),
      ]),
    )
    .max(20)
    .optional(),
});

export const subtaskSchema = z.object({
  taskId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  dueDate: optionalDate,
  note: z.string().max(2000).optional().nullable(),
});

export const ticketSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "LEARNED", "REVIEW"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

export const questionSchema = z.object({
  subjectId: z.string().min(1),
  ticketId: z.string().optional().nullable(),
  lectureId: z.string().optional().nullable(),
  text: z.string().trim().min(1, "Текст вопроса обязателен").max(4000),
  answer: z.string().max(8000).optional().nullable(),
  explanation: z.string().max(8000).optional().nullable(),
  status: z.enum(["UNLEARNED", "IN_PROGRESS", "LEARNED", "REVIEW"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  kind: z.enum(["THEORY", "PROBLEM"]).optional(),
  ticketNo: z.number().int().min(1).max(999).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const questionImportSchema = z.object({
  subjectId: z.string().min(1),
  lectureId: z.string().optional().nullable(),
  questions: z.array(
    z.object({
      text: z.string().trim().min(1).max(4000),
      answer: z.string().max(8000).optional().nullable(),
      explanation: z.string().max(8000).optional().nullable(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
      kind: z.enum(["THEORY", "PROBLEM"]).optional(),
      ticket: z.number().int().min(1).max(999).optional().nullable(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    }),
  ).min(1).max(500),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(50_000).optional().nullable(),
  subjectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
  questionId: z.string().optional().nullable(),
  color: z.string().optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  subjectId: z.string().optional().nullable(),
  startAt: z.string().min(1).transform((v) => new Date(v)),
  endAt: optionalDate,
  allDay: z.boolean().optional(),
  color: z.string().optional().nullable(),
  kind: z.enum(["LECTURE", "SEMINAR", "LAB", "TEST", "CONSULT", "EXAM", "OTHER"]).optional(),
  location: z.string().trim().max(120).optional().nullable(),
  recurrence: z.enum(["WEEKLY", "BIWEEKLY"]).optional().nullable(),
  repeatUntil: optionalDate,
});

export const lectureSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1, "Нужна тема лекции").max(200),
  number: z.number().int().min(0).max(999).optional().nullable(),
  date: optionalDate,
  summary: z.string().max(100_000).optional(),
});

export const commentSchema = z.object({
  taskId: z.string().optional().nullable(),
  questionId: z.string().optional().nullable(),
  content: z.string().trim().min(1).max(2000),
}).refine((value) => Boolean(value.taskId) !== Boolean(value.questionId), "Комментарий должен быть привязан к задаче или вопросу");

export const examConfigSchema = z.object({
  subjectId: z.string().min(1),
  theory: z.number().int().min(0).max(5),
  problems: z.number().int().min(0).max(5),
  extra: z.number().int().min(0).max(8),
  prepMinutes: z.number().int().min(0).max(180),
  // null — случайный билет, число — конкретный билет из списка, 0 — случайный из реальных
  ticketNo: z.number().int().min(0).max(999).optional().nullable(),
  weak: z.boolean().optional(),
});

export const homeworkSchema = z.object({
  subjectId: z.string().min(1),
  lessonAt: z.string().min(1).transform((v) => new Date(v)),
  lessonKind: z.string().max(20).optional().nullable(),
  title: z.string().trim().min(1, "Напиши, что задали").max(200),
  description: z.string().max(8000).optional().nullable(),
  // next — к следующей паре предмета, same — к следующей паре того же типа, date — своя дата
  due: z.enum(["next", "same", "date"]),
  dueDate: z.string().optional().nullable(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});
