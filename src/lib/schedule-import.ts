import { prisma } from "./prisma";
import { normalizeName, parseIcs, type IcsEvent } from "./ics";
import { SUBJECT_COLORS } from "./constants";

export type ImportOptions = {
  /** Создавать предметы, которых ещё нет */
  createSubjects?: boolean;
  /** Проставлять предметам дату экзамена и преподавателя, если они не заполнены */
  fillSubjects?: boolean;
  /** Удалять ранее импортированные пары, которых больше нет в расписании */
  removeMissing?: boolean;
};

export type ImportResult = {
  calendar: string | null;
  total: number;
  created: number;
  updated: number;
  removed: number;
  subjectsCreated: string[];
  subjectsUpdated: number;
};

const EMOJI_BY_NAME: [RegExp, string][] = [
  [/физик/i, "🔬"],
  [/матем|анализ|алгебр|геометр/i, "📐"],
  [/истор|государств/i, "📜"],
  [/язык/i, "🌍"],
  [/информ|программ|компьют/i, "💻"],
  [/физическ.*культ|спорт/i, "🎯"],
  [/граф|черч/i, "📝"],
  [/радио|электр|схем/i, "🧪"],
  [/прав/i, "⚖️"],
];

function emojiFor(name: string) {
  return EMOJI_BY_NAME.find(([re]) => re.test(name))?.[1] ?? "📘";
}

function mostFrequent(values: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Импорт расписания из текста .ics. Повторный импорт обновляет пары по UID, а не дублирует их. */
export async function importIcsText(userId: string, text: string, options: ImportOptions = {}): Promise<ImportResult> {
  const { createSubjects = true, fillSubjects = true, removeMissing = true } = options;
  const { name, events } = parseIcs(text);
  if (!events.length) throw new Error("В файле нет занятий");
  if (events.length > 3000) throw new Error("Слишком много событий в файле (больше 3000)");

  // 1. Предметы: сопоставляем по названию, недостающие создаём
  const subjects = await prisma.subject.findMany({
    // Направления «Изучаю» в расписании не участвуют
    where: { userId, selfStudy: false },
    select: { id: true, name: true, teacher: true, examDate: true, archived: true },
  });
  type SubjectRow = (typeof subjects)[number];
  const byName = new Map<string, SubjectRow>(subjects.map((s): [string, SubjectRow] => [normalizeName(s.name), s]));
  const groups = new Map<string, IcsEvent[]>();
  for (const e of events) {
    const key = normalizeName(e.title);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const subjectsCreated: string[] = [];
  let subjectsUpdated = 0;
  let colorIndex = subjects.length;
  for (const [key, list] of groups) {
    const title = list[0].title;
    const exam = list.filter((e) => e.kind === "EXAM").sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    const lectureTeacher = mostFrequent(list.filter((e) => e.kind === "LECTURE").map((e) => e.teacher));
    const teacher = lectureTeacher ?? mostFrequent(list.map((e) => e.teacher));
    const existing = byName.get(key);
    if (!existing) {
      if (!createSubjects) continue;
      const created = await prisma.subject.create({
        data: {
          userId,
          name: title.slice(0, 120),
          emoji: emojiFor(title),
          color: SUBJECT_COLORS[colorIndex++ % SUBJECT_COLORS.length],
          type: exam ? "EXAM" : "CREDIT",
          teacher,
          examDate: exam?.start ?? null,
        },
        select: { id: true, name: true, teacher: true, examDate: true, archived: true },
      });
      byName.set(key, created);
      subjectsCreated.push(created.name);
    } else if (fillSubjects) {
      const data: { teacher?: string; examDate?: Date } = {};
      if (!existing.teacher && teacher) data.teacher = teacher;
      if (!existing.examDate && exam) data.examDate = exam.start;
      if (Object.keys(data).length) {
        await prisma.subject.update({ where: { id: existing.id }, data });
        subjectsUpdated++;
      }
    }
  }

  // 2. Пары: создаём новые, обновляем изменившиеся
  const uids = events.map((e) => e.uid);
  const current = await prisma.calendarEvent.findMany({
    where: { userId, externalId: { in: uids } },
    select: { id: true, externalId: true, title: true, startAt: true, endAt: true, location: true, description: true, kind: true, subjectId: true, allDay: true },
  });
  type EventRow = (typeof current)[number];
  const currentByUid = new Map<string, EventRow>(current.map((c): [string, EventRow] => [c.externalId!, c]));

  type Row = {
    title: string;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
    location: string | null;
    description: string | null;
    kind: string;
    subjectId: string | null;
  };
  const toCreate: (Row & { userId: string; externalId: string })[] = [];
  const toUpdate: { id: string; data: Row }[] = [];
  for (const e of events) {
    const subjectId = byName.get(normalizeName(e.title))?.id ?? null;
    const row: Row = {
      title: e.title.slice(0, 200),
      startAt: e.start,
      endAt: e.end,
      allDay: e.allDay,
      location: e.location?.slice(0, 120) ?? null,
      description: e.description?.slice(0, 4000) ?? null,
      kind: e.kind,
      subjectId,
    };
    const prev = currentByUid.get(e.uid);
    if (!prev) {
      toCreate.push({ ...row, userId, externalId: e.uid });
      continue;
    }
    const changed =
      prev.title !== row.title ||
      prev.startAt.getTime() !== row.startAt.getTime() ||
      (prev.endAt?.getTime() ?? null) !== (row.endAt?.getTime() ?? null) ||
      prev.location !== row.location ||
      prev.description !== row.description ||
      prev.kind !== row.kind ||
      prev.allDay !== row.allDay ||
      (row.subjectId && prev.subjectId !== row.subjectId);
    if (changed) toUpdate.push({ id: prev.id, data: row });
  }

  if (toCreate.length) await prisma.calendarEvent.createMany({ data: toCreate, skipDuplicates: true });
  for (let i = 0; i < toUpdate.length; i += 50) {
    await prisma.$transaction(toUpdate.slice(i, i + 50).map((u) => prisma.calendarEvent.update({ where: { id: u.id }, data: u.data })));
  }

  // 3. Пары, которые пропали из расписания (перенесли/отменили), — удаляем в пределах периода файла
  let removed = 0;
  if (removeMissing) {
    const domain = uids[0]?.includes("@") ? uids[0].split("@").pop() : null;
    const from = events[0].start;
    const to = new Date(events[events.length - 1].start.getTime() + 86_400_000);
    const res = await prisma.calendarEvent.deleteMany({
      where: {
        userId,
        externalId: domain ? { endsWith: `@${domain}`, notIn: uids } : { notIn: uids, not: null },
        startAt: { gte: from, lte: to },
      },
    });
    removed = res.count;
  }

  return {
    calendar: name,
    total: events.length,
    created: toCreate.length,
    updated: toUpdate.length,
    removed,
    subjectsCreated,
    subjectsUpdated,
  };
}

const MAX_ICS_BYTES = 5 * 1024 * 1024;

/** Скачивает .ics по ссылке (webcal:// тоже подходит) */
export async function fetchIcs(url: string) {
  let u: URL;
  try {
    u = new URL(url.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new Error("Неверная ссылка");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Нужна ссылка http(s) или webcal");
  const res = await fetch(u, { headers: { Accept: "text/calendar, */*" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Расписание не загрузилось (${res.status})`);
  const text = await res.text();
  if (text.length > MAX_ICS_BYTES) throw new Error("Файл расписания слишком большой");
  return { url: u.toString(), text };
}

const SYNC_INTERVAL = 6 * 60 * 60 * 1000;
const lastSync = new Map<string, number>();

/** Автообновление расписания по ссылке — не чаще раза в 6 часов, вызывается в фоне */
export async function autoSyncSchedule(userId: string) {
  if (Date.now() - (lastSync.get(userId) ?? 0) < 30 * 60 * 1000) return;
  lastSync.set(userId, Date.now());
  const claimed = await prisma.user.updateMany({
    where: {
      id: userId,
      scheduleUrl: { not: null },
      OR: [{ scheduleSyncedAt: null }, { scheduleSyncedAt: { lt: new Date(Date.now() - SYNC_INTERVAL) } }],
    },
    data: { scheduleSyncedAt: new Date() },
  });
  if (!claimed.count) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { scheduleUrl: true } });
  if (!user?.scheduleUrl) return;
  const { text } = await fetchIcs(user.scheduleUrl);
  await importIcsText(userId, text, { createSubjects: false, fillSubjects: false, removeMissing: true });
}
