"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";
import { aiEnabled, groqAgentStep, groqChat, GroqLimitError, type AgentMessage } from "@/lib/groq";
import { aiQuota } from "@/lib/ai-quota";
import { timeContext, shortDay } from "@/lib/assistant-utils";
import { buildProposal, READ_TOOLS, runReadTool, ToolError, TOOLS, type Proposal } from "@/lib/assistant-tools";
import { parseModelJson } from "@/lib/ai-parse";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantReply = { wait?: number; reply?: string; proposals?: Proposal[] };

const MAX_STEPS = 6;

function systemPrompt(name: string, subjects: { name: string; examDate: Date | null; type: string; teacher: string | null }[]) {
  const t = timeContext();
  const list = subjects
    .map((s) => `- ${s.name}${s.examDate ? ` (${s.type === "EXAM" ? "экзамен" : "зачёт"} ${shortDay(s.examDate)})` : ""}${s.teacher ? `, преп. ${s.teacher}` : ""}`)
    .join("\n");
  return `Ты — ассистент в StudyHub, личном приложении для учёбы. Пользователь — ${name}, студент первого курса МАИ. Отвечай по-русски, коротко и по делу, без воды. Можно Markdown и формулы LaTeX ($…$).

Сейчас: ${t.now}.
Ближайшие дни: ${t.days}.

Предметы пользователя:
${list || "- (пока нет предметов)"}

Как работать:
- Вопросы о дедлайнах, домашке, расписании, экзаменах, прогрессе — сначала вызови инструмент (get_deadlines, get_schedule, get_subject, search). Не выдумывай данные.
- Чтобы добавить или изменить что-то — вызови create_tasks / create_events / add_questions / update_tasks / update_subject. Они НЕ меняют данные сразу: пользователь увидит карточку и сам подтвердит. Поэтому не спрашивай «добавить?» — просто вызывай, если данных хватает. Если не хватает существенного (непонятно, какой предмет или дата), задай один короткий вопрос.
- Даты — YYYY-MM-DD, время — HH:MM по Москве. Слова «завтра», «в среду», «через неделю» переводи по списку ближайших дней выше.
- Тип задачи (type): HOMEWORK — домашка, LAB — лабораторная, TEST — контрольная, DRAWING — чертёж, TASK — прочее. Для LAB/TEST/DRAWING этапы подставятся по шаблону — stages не передавай, если пользователь не перечислил свои. Даты этапов не придумывай — пользователь ставит их сам.
- Домашка с пары («задали…», «к следующей паре…»): create_tasks с type=HOMEWORK и due_next_lesson=true — срок сам встанет на следующую пару предмета. Если пользователь назвал дату — due_date.
- Список вопросов от пользователя — add_questions. Формулировки дословно, без нумерации. Ответы сам не пиши (их допишут автоматически), только если пользователь дал ответы — передай их. Вычислить/найти/решить/доказать с числами — kind=PROBLEM. «Билет 5: …» — ticket=5. Если вопросы к разным предметам — отдельный вызов на каждый предмет.
- Расписание словами («по средам практика по физике в 10:45 в ГУК Б-415, по чётным неделям») — create_events: date = ближайший подходящий день, repeat WEEKLY или BIWEEKLY. Чётность недели смотри в «Сейчас».
- Названия предметов бери из списка выше. id задач пользователю не показывай.
- После вызова изменяющего инструмента не пересказывай карточку целиком — достаточно одной фразы.`;
}

/** Один ход диалога: модель читает данные инструментами и/или готовит предложения изменений */
export async function assistantTurn(history: ChatTurn[], message: string): Promise<ActionResult<AssistantReply>> {
  return withUser(async (userId) => {
    if (!aiEnabled()) throw new Error("ИИ не настроен: добавь GROQ_API_KEY в переменные окружения Vercel");
    const text = String(message ?? "").trim();
    if (!text) throw new Error("Пустое сообщение");
    if (text.length > 16_000) throw new Error("Слишком длинное сообщение — раздели его на части");
    await aiQuota(userId);

    const [user, subjects] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.subject.findMany({
        where: { userId, archived: false },
        select: { id: true, name: true, examDate: true, teacher: true, type: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Держим контекст небольшим: у бесплатных моделей лимит ~8–12 тыс. токенов в минуту
    const past = (Array.isArray(history) ? history : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2500) }) as AgentMessage);
    const messages: AgentMessage[] = [{ role: "system", content: systemPrompt(user?.name?.split(" ")[0] ?? "студент", subjects) }, ...past, { role: "user", content: text }];

    const proposals: Proposal[] = [];
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await groqAgentStep(messages, TOOLS);
        if (!r.toolCalls.length) return { reply: r.content.trim(), proposals };
        messages.push({ role: "assistant", content: r.content || null, tool_calls: r.toolCalls });
        let wrote = false;
        for (const call of r.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
          } catch {
            messages.push({ role: "tool", tool_call_id: call.id, content: "Ошибка: аргументы — невалидный JSON. Повтори вызов." });
            continue;
          }
          const name = call.function.name;
          try {
            if (READ_TOOLS.has(name)) {
              const result = await runReadTool(userId, subjects, name, args);
              messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 7000) });
            } else {
              const p = await buildProposal(userId, subjects, name, args);
              proposals.push(p);
              wrote = true;
              messages.push({ role: "tool", tool_call_id: call.id, content: `Показано пользователю на подтверждение: ${p.summary}. Повторно не вызывай.` });
            }
          } catch (e) {
            const msg = e instanceof ToolError ? e.message : "Внутренняя ошибка инструмента";
            if (!(e instanceof ToolError)) console.error("assistant tool", name, e);
            messages.push({ role: "tool", tool_call_id: call.id, content: `Ошибка: ${msg}` });
          }
        }
        // Изменения подготовлены — ещё один вызов модели ради фразы не тратим
        if (wrote) return { reply: r.content.trim() || "Проверь и подтверди:", proposals };
      }
      return { reply: "Не получилось довести до конца — переформулируй, пожалуйста, попроще.", proposals };
    } catch (e) {
      if (e instanceof GroqLimitError) return { wait: e.retryAfter };
      throw e;
    }
  });
}

// ── Применение подтверждённых изменений ──────────────────────────────────────

const iso = z.string().datetime({ offset: true });
const taskDraft = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable(),
  subjectId: z.string().nullable(),
  kind: z.enum(["TASK", "HOMEWORK", "LAB", "TEST", "DRAWING"]),
  lessonAt: iso.nullable(),
  dueDate: iso.nullable(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  stages: z.array(z.string().max(200)).max(20),
});
const eventDraft = z.object({
  title: z.string().trim().min(1).max(200),
  subjectId: z.string().nullable(),
  kind: z.enum(["LECTURE", "SEMINAR", "LAB", "TEST", "CONSULT", "EXAM", "OTHER"]),
  startAt: iso,
  endAt: iso.nullable(),
  allDay: z.boolean(),
  location: z.string().max(120).nullable(),
  recurrence: z.enum(["WEEKLY", "BIWEEKLY"]).nullable(),
  repeatUntil: iso.nullable(),
});
const questionsData = z.object({
  subjectId: z.string(),
  lectureId: z.string().nullable(),
  fillAnswers: z.boolean(),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(4000),
        answer: z.string().max(8000).nullable(),
        kind: z.enum(["THEORY", "PROBLEM"]),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
        ticketNo: z.number().int().min(1).max(999).nullable(),
      }),
    )
    .min(1)
    .max(150),
});
const taskUpdates = z
  .array(
    z.object({
      id: z.string(),
      status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
      dueDate: iso.optional(),
      dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    }),
  )
  .min(1)
  .max(30);
const subjectUpdate = z.object({ id: z.string(), examDate: iso.optional(), teacher: z.string().max(120).optional() });

async function ownedSubjects(userId: string, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return;
  const count = await prisma.subject.count({ where: { userId, id: { in: unique } } });
  if (count !== unique.length) throw new Error("Предмет не найден");
}

/** Выполняет подтверждённое пользователем предложение. include — какие пункты оставить (по индексам). */
export async function applyProposal(p: { kind: string; data: unknown }, include?: number[]): Promise<ActionResult<{ message: string; fillIds?: string[] }>> {
  return withUser(async (userId) => {
    const keep = <T,>(list: T[]) => (include ? list.filter((_, i) => include.includes(i)) : list);

    if (p.kind === "tasks") {
      const drafts = keep(z.array(taskDraft).min(1).max(30).parse(p.data));
      if (!drafts.length) throw new Error("Ничего не выбрано");
      await ownedSubjects(userId, drafts.map((d) => d.subjectId));
      await prisma.$transaction(
        drafts.map((d) =>
          prisma.task.create({
            data: {
              userId,
              title: d.title,
              description: d.description,
              subjectId: d.subjectId,
              kind: d.kind,
              lessonAt: d.lessonAt ? new Date(d.lessonAt) : null,
              dueDate: d.dueDate ? new Date(d.dueDate) : null,
              dueTime: d.dueTime,
              priority: d.priority,
              status: "PLANNED",
              ...(d.stages.length ? { subtasks: { create: d.stages.map((title, i) => ({ userId, title, sortOrder: i + 1 })) } } : {}),
            },
          }),
        ),
      );
      refreshAll();
      return { message: drafts.length === 1 ? `Добавлена задача «${drafts[0].title}»` : `Добавлено задач: ${drafts.length}` };
    }

    if (p.kind === "events") {
      const drafts = keep(z.array(eventDraft).min(1).max(40).parse(p.data));
      if (!drafts.length) throw new Error("Ничего не выбрано");
      await ownedSubjects(userId, drafts.map((d) => d.subjectId));
      await prisma.calendarEvent.createMany({
        data: drafts.map((d) => ({
          userId,
          title: d.title,
          subjectId: d.subjectId,
          kind: d.kind,
          startAt: new Date(d.startAt),
          endAt: d.endAt ? new Date(d.endAt) : null,
          allDay: d.allDay,
          location: d.location,
          recurrence: d.recurrence,
          repeatUntil: d.repeatUntil ? new Date(d.repeatUntil) : null,
        })),
      });
      refreshAll();
      return { message: drafts.length === 1 ? `В календарь добавлено «${drafts[0].title}»` : `В календарь добавлено событий: ${drafts.length}` };
    }

    if (p.kind === "questions") {
      const data = questionsData.parse(p.data);
      const questions = keep(data.questions);
      if (!questions.length) throw new Error("Ничего не выбрано");
      await ownedSubjects(userId, [data.subjectId]);
      if (data.lectureId && !(await prisma.lecture.findFirst({ where: { id: data.lectureId, userId, subjectId: data.subjectId }, select: { id: true } }))) {
        throw new Error("Лекция не найдена");
      }
      const last = await prisma.question.aggregate({ where: { subjectId: data.subjectId }, _max: { sortOrder: true } });
      let order = (last._max.sortOrder ?? 0) + 1;
      const created = await prisma.question.createManyAndReturn({
        data: questions.map((q) => ({
          userId,
          subjectId: data.subjectId,
          lectureId: data.lectureId,
          text: q.text,
          answer: q.answer,
          kind: q.kind,
          difficulty: q.difficulty,
          ticketNo: q.ticketNo,
          sortOrder: order++,
        })),
        select: { id: true, answer: true },
      });
      refreshAll();
      const fillIds = data.fillAnswers ? created.filter((q) => !q.answer).map((q) => q.id) : [];
      return { message: `Добавлено вопросов: ${created.length}`, fillIds };
    }

    if (p.kind === "task_updates") {
      const updates = keep(taskUpdates.parse(p.data));
      if (!updates.length) throw new Error("Ничего не выбрано");
      const owned = await prisma.task.findMany({ where: { userId, id: { in: updates.map((u) => u.id) } }, select: { id: true, subjectId: true, status: true } });
      if (owned.length !== new Set(updates.map((u) => u.id)).size) throw new Error("Задача не найдена");
      type Row = { id: string; subjectId: string | null; status: string };
      const byId = new Map<string, Row>(owned.map((t: Row): [string, Row] => [t.id, t]));
      await prisma.$transaction([
        ...updates.map((u) =>
          prisma.task.update({
            where: { id: u.id },
            data: {
              ...(u.status ? { status: u.status } : {}),
              ...(u.dueDate ? { dueDate: new Date(u.dueDate), dueTime: u.dueTime ?? null, ...(u.status ? {} : { status: "PLANNED" }) } : {}),
            },
          }),
        ),
        ...updates
          .filter((u) => u.status === "DONE" && byId.get(u.id)?.status !== "DONE")
          .map((u) => prisma.progressLog.create({ data: { userId, subjectId: byId.get(u.id)?.subjectId ?? null, type: "TASK_DONE", value: u.id } })),
      ]);
      refreshAll();
      return { message: updates.length === 1 ? "Задача обновлена" : `Обновлено задач: ${updates.length}` };
    }

    if (p.kind === "subject") {
      const u = subjectUpdate.parse(p.data);
      await ownedSubjects(userId, [u.id]);
      await prisma.subject.update({
        where: { id: u.id },
        data: { ...(u.examDate ? { examDate: new Date(u.examDate) } : {}), ...(u.teacher ? { teacher: u.teacher } : {}) },
      });
      refreshAll();
      return { message: "Предмет обновлён" };
    }
    throw new Error("Неизвестное действие");
  });
}

/** Дописывает ответы к вопросам без ответа (до 8 за раз) */
export async function fillAnswers(ids: string[]): Promise<ActionResult<{ wait?: number; value?: number }>> {
  return withUser(async (userId) => {
    if (!aiEnabled()) throw new Error("ИИ не настроен");
    await aiQuota(userId);
    const list = await prisma.question.findMany({
      where: { userId, id: { in: ids.slice(0, 8) }, OR: [{ answer: null }, { answer: "" }] },
      select: { id: true, text: true, kind: true, subject: { select: { name: true } }, lecture: { select: { summary: true } } },
    });
    if (!list.length) return { value: 0 };
    const subject = list[0].subject.name;
    const context = list.find((q) => q.lecture?.summary)?.lecture?.summary?.slice(0, 3000);
    const prompt = `Ты — преподаватель технического вуза. Предмет: «${subject}». Напиши ответы на экзаменационные вопросы студента.
Ответ — как хороший ответ на экзамене: суть, определения, формулировки, ключевые формулы; 3–8 предложений или пункты. Для задач (PROBLEM) — решение по шагам и ответ. Формулы — LaTeX ($…$, $$…$$).
${context ? `\nКонспект лекции студента (опирайся на его обозначения):\n${context}\n` : ""}
Вопросы:
${list.map((q, i) => `${i + 1}. [${q.kind}] ${q.text}`).join("\n")}

Ответь строго JSON-объектом: {"answers":[{"n":1,"answer":"…"}]}. В JSON обратный слэш LaTeX удвоенный: "\\\\frac".`;
    try {
      const { text } = await groqChat([{ role: "user", content: prompt }], { json: true, maxTokens: 6000, temperature: 0.2 });
      const parsed = parseModelJson<{ answers?: { n?: number; answer?: string }[] }>(text);
      const answers = Array.isArray(parsed.answers) ? parsed.answers : [];
      const updates = answers
        .map((a, i) => ({ q: list[(Number(a.n) || i + 1) - 1], answer: String(a.answer ?? "").trim().slice(0, 8000) }))
        .filter((u) => u.q && u.answer);
      await prisma.$transaction(updates.map((u) => prisma.question.update({ where: { id: u.q.id }, data: { answer: u.answer } })));
      refreshAll();
      return { value: updates.length };
    } catch (e) {
      if (e instanceof GroqLimitError) return { wait: e.retryAfter };
      throw e;
    }
  });
}

