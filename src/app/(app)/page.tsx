import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/lib/queries";
import { buildWeekGroups, inDays, subjectShort, todayLine } from "@/lib/home";
import { daysUntil, formatDate } from "@/lib/utils";
import { kindMeta } from "@/lib/schedule";
import { SUBJECT_TYPES } from "@/lib/constants";
import { taskKind } from "@/lib/task-kinds";
import { EmptyState } from "@/components/ui/empty";
import { TodayLessons } from "@/components/dashboard/today-lessons";
import { FocusBar, FocusProvider } from "@/components/dashboard/focus";
import { WeekTasks, type WeekGroup } from "@/components/dashboard/week-tasks";
import { QuickAddBar } from "@/components/tasks/quick-add";

/** Сколько задач видно сразу; остальные — по «Показать ещё» */
const WEEK_LIMIT = 12;

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("ru-RU", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Moscow" }).format(now));
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/** Подпись под предметом: ближайший срок, иначе экзамен или тип отчётности */
function nextLabel(s: { next: { kind: string; title: string; dueDate: Date | null } | null; examDate: Date | null; type: string }) {
  if (s.next?.dueDate) {
    const d = daysUntil(s.next.dueDate) ?? 99;
    const what = s.next.kind === "TASK" ? s.next.title : taskKind(s.next.kind).label;
    const when = d <= 0 ? "сегодня" : d === 1 ? "завтра" : formatDate(s.next.dueDate, "d MMMM");
    return { text: `${what} — ${when}`, urgent: d <= 1 };
  }
  if (s.examDate && (daysUntil(s.examDate) ?? -1) >= 0) return { text: `экзамен ${formatDate(s.examDate, "d MMMM")}`, urgent: false };
  const type = SUBJECT_TYPES.find((t) => t.value === s.type);
  return { text: type && s.type !== "OTHER" ? type.label.toLowerCase() : "без сроков", urgent: false };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user.id);
  const now = new Date();
  const firstName = user.name.split(" ")[0];

  const weekGroups: WeekGroup[] = buildWeekGroups(data.openTasks, now).map((g) => ({
    ...g,
    items: g.items.map((t) => {
      const doneSteps = t.subtasks.filter((x) => x.status === "DONE").length;
      return {
        id: t.id,
        title: t.title,
        kind: t.kind,
        subject: t.subject?.name ?? null,
        steps: t.subtasks.length ? { done: doneSteps, total: t.subtasks.length } : null,
      };
    }),
  }));
  const weekCount = weekGroups.reduce((n, g) => n + g.items.length, 0);

  const exams = data.subjects
    .filter((s) => s.examDate && (daysUntil(s.examDate) ?? -1) >= 0)
    .sort((a, b) => (a.examDate?.getTime() ?? 0) - (b.examDate?.getTime() ?? 0));
  const firstExamDays = exams.length ? daysUntil(exams[0].examDate) : null;

  return (
    <FocusProvider>
      <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-[22px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted">{todayLine(now)}</p>
            <h1 className="heading text-[28px] leading-tight sm:text-[34px]">
              {greeting(now)}, {firstName}
            </h1>
          </div>
          <QuickAddBar subjects={data.subjects.map((s) => ({ id: s.id, name: s.name }))} />
        </div>

        <div className="flex flex-wrap items-start gap-[22px]">
          <section aria-labelledby="week-title" className="card min-w-0 flex-[3_1_560px] overflow-hidden rounded-[14px]">
            <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
              <h2 id="week-title" className="heading text-[22px]">
                На этой неделе
              </h2>
              <span className="text-[13px] text-muted">
                {weekCount} открыт{weekCount % 10 === 1 && weekCount % 100 !== 11 ? "ая" : "ых"} · {data.doneThisWeek} сделано
              </span>
            </div>
            {weekGroups.length ? (
              <WeekTasks groups={weekGroups} limit={WEEK_LIMIT} />
            ) : (
              <div className="border-t border-line px-5 py-8 text-center text-sm text-muted">
                На неделю дел нет. Хорошее время повторить вопросы.{" "}
                <Link href="/review" className="text-accent hover:underline">
                  К повторению →
                </Link>
              </div>
            )}
          </section>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[22px]">
            <section aria-labelledby="session-title" className="card rounded-[14px] px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between gap-2 pb-2">
                <h2 id="session-title" className="heading text-xl">
                  Сессия
                </h2>
                {firstExamDays !== null ? <span className="text-[13px] font-semibold text-urgent">{inDays(firstExamDays)}</span> : null}
              </div>
              {exams.length === 0 ? (
                <p className="border-t border-[#ECE8DF] pt-3 text-sm text-muted dark:border-line">Добавь дату экзамена в карточке предмета — здесь появится обратный отсчёт.</p>
              ) : (
                <ul>
                  {exams.slice(0, 6).map((e) => {
                    const share = e.questionsTotal ? Math.round((e.questionsLearned / e.questionsTotal) * 100) : 0;
                    return (
                      <li key={e.id} className="flex flex-col gap-2 border-t border-[#ECE8DF] py-3 dark:border-line">
                        <div className="flex justify-between gap-3">
                          <Link href={`/subjects/${e.id}`} className="min-w-0 truncate text-sm font-medium hover:text-accent">
                            {e.name}
                          </Link>
                          <span className="heading shrink-0 text-sm">{formatDate(e.examDate, "d MMM").replace(".", "")}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle"
                            role="progressbar"
                            aria-label={`Выучено: ${e.name}`}
                            aria-valuenow={share}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-muted">{e.questionsTotal ? `${e.questionsLearned} / ${e.questionsTotal}` : "нет вопросов"}</span>
                          {e.questionsTotal ? (
                            <Link
                              href={`/subjects/${e.id}/ten`}
                              className="inline-flex h-[30px] shrink-0 items-center rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-accent transition-colors hover:bg-subtle"
                              title="10 минут: самые слабые вопросы к этому экзамену"
                            >
                              10 мин
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {data.todayEvents.length ? (
              <section aria-labelledby="today-title" className="card rounded-[14px] p-1.5">
                <h2 id="today-title" className="heading px-3 pb-1 pt-2.5 text-base">
                  Сегодня по расписанию
                </h2>
                <TodayLessons
                  lessons={data.todayEvents.map((e) => ({
                    key: e.key,
                    title: e.title,
                    kind: e.kind,
                    start: e.start.toISOString(),
                    allDay: e.allDay,
                    location: e.location,
                    color: e.color ?? e.subject?.color ?? kindMeta(e.kind).color,
                    subjectId: e.subjectId,
                  }))}
                  homework={data.homework}
                />
              </section>
            ) : null}
          </div>
        </div>

        <section aria-labelledby="subjects-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="subjects-title" className="heading text-[22px]">
              Предметы
            </h2>
            <Link href="/subjects" className="text-[13px] text-accent hover:underline">
              Все →
            </Link>
          </div>
          {data.subjects.length === 0 ? (
            <EmptyState icon={BookOpen} title="Пока нет предметов" hint="Добавь первый — вокруг него появятся вопросы, задачи и заметки." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-2.5">
              {data.subjects.map((s) => {
                const next = nextLabel(s);
                return (
                  <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover flex items-center gap-3 rounded-xl px-3.5 py-3">
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-xs font-bold" style={{ background: `${s.color}1f`, color: s.color }} aria-hidden>
                      {subjectShort(s.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className={`block truncate text-xs ${next.urgent ? "text-urgent" : "text-muted"}`}>{next.text}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-auto pt-2">
          <FocusBar />
        </div>
      </div>
    </FocusProvider>
  );
}
