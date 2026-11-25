import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";
import { getScheduleEvents } from "@/lib/queries";
import { expandEvents, kindMeta } from "@/lib/schedule";
import { subjectProgress } from "@/lib/progress";
import { dayKey } from "@/lib/utils";

export async function GET(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const now = new Date();
  const todayKey = dayKey(now);
  const mskStart = new Date(`${todayKey}T00:00:00+03:00`);
  const mskEnd = addDays(mskStart, 1);
  const calFrom = addDays(mskStart, -30);
  const calTo = addDays(mskStart, 90);
  const monday = addDays(
    mskStart,
    -((new Date(mskStart.getTime() + 3 * 3_600_000).getUTCDay() + 6) % 7),
  );

  const [subjects, tasks, rawEvents, calRawEvents, questions, dueReviewCount] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id, archived: false, selfStudy: false },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        type: true,
        examDate: true,
        questions: { select: { status: true } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ examDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      select: {
        id: true,
        title: true,
        description: true,
        subjectId: true,
        startDate: true,
        dueDate: true,
        dueTime: true,
        priority: true,
        status: true,
        kind: true,
        lessonAt: true,
        createdAt: true,
        updatedAt: true,
        subtasks: {
          select: {
            id: true,
            taskId: true,
            parentId: true,
            title: true,
            status: true,
            dueDate: true,
            note: true,
            sortOrder: true,
            updatedAt: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    }),
    getScheduleEvents(user.id, mskStart, mskEnd),
    getScheduleEvents(user.id, calFrom, calTo),
    prisma.question.findMany({
      where: { userId: user.id, subject: { archived: false } },
      select: {
        id: true,
        subjectId: true,
        text: true,
        answer: true,
        explanation: true,
        status: true,
        difficulty: true,
        kind: true,
        ticketNo: true,
        srsDue: true,
        srsInterval: true,
        srsEase: true,
        srsReps: true,
        srsLapses: true,
        sortOrder: true,
        ticket: { select: { title: true } },
        lecture: { select: { title: true, number: true } },
      },
      orderBy: [{ srsDue: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      take: 1500,
    }),
    prisma.question.count({
      where: { userId: user.id, srsReps: { gt: 0 }, srsDue: { lte: now } },
    }),
  ]);

  const serializeEvent = (e: ReturnType<typeof expandEvents<(typeof rawEvents)[number]>>[number]) => ({
    key: e.key,
    title: e.title,
    kind: e.kind,
    kindLabel: kindMeta(e.kind).label,
    start: e.start.toISOString(),
    end: e.end ? e.end.toISOString() : null,
    allDay: e.allDay,
    location: e.location ?? null,
    color: e.color ?? e.subject?.color ?? kindMeta(e.kind).color,
    subjectId: e.subjectId ?? null,
    subjectName: e.subject?.name ?? null,
  });

  const todayEvents = expandEvents(rawEvents, mskStart, mskEnd).map(serializeEvent);
  const calendarEvents = expandEvents(calRawEvents, calFrom, calTo).map(serializeEvent);

  const doneThisWeek = tasks.filter((t) => t.status === "DONE" && t.updatedAt >= monday).length;
  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const overdueCount = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    return t.dueDate.toISOString().slice(0, 10) < todayKey;
  }).length;

  return mobileJson({
    serverTime: now.toISOString(),
    user,
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji,
      color: s.color,
      type: s.type,
      examDate: s.examDate ? s.examDate.toISOString() : null,
      questionsTotal: s.questions.length,
      questionsLearned: s.questions.filter((q) => q.status === "LEARNED").length,
      progress: subjectProgress({ questions: s.questions, tasks: s.tasks }),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      subjectId: t.subjectId,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      dueTime: t.dueTime,
      priority: t.priority,
      status: t.status,
      kind: t.kind,
      lessonAt: t.lessonAt ? t.lessonAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      subtasks: t.subtasks.map((st) => ({
        id: st.id,
        taskId: st.taskId,
        parentId: st.parentId,
        title: st.title,
        status: st.status,
        dueDate: st.dueDate ? st.dueDate.toISOString() : null,
        note: st.note,
        sortOrder: st.sortOrder,
        updatedAt: st.updatedAt.toISOString(),
      })),
    })),
    todayEvents,
    calendarEvents,
    questions: questions.map((q) => ({
      id: q.id,
      subjectId: q.subjectId,
      text: q.text,
      answer: q.answer,
      explanation: q.explanation,
      status: q.status,
      difficulty: q.difficulty,
      kind: q.kind,
      ticketNo: q.ticketNo,
      ticketTitle: q.ticket?.title ?? null,
      lectureTitle: q.lecture
        ? q.lecture.number != null
          ? `Лекция ${q.lecture.number}: ${q.lecture.title}`
          : q.lecture.title
        : null,
      srsDue: q.srsDue ? q.srsDue.toISOString() : null,
      srsInterval: q.srsInterval,
      srsEase: q.srsEase,
      srsReps: q.srsReps,
      srsLapses: q.srsLapses,
      sortOrder: q.sortOrder,
    })),
    stats: {
      doneThisWeek,
      openCount: openTasks.length,
      overdueCount,
      dueReviewCount,
    },
  });
}
