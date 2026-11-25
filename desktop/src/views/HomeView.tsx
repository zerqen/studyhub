import { AlertTriangle, ArrowRight, CalendarClock, Check, Plus, School } from "lucide-react";
import type { DesktopState, TaskDto } from "../../electron/types";
import { QuickAddBar } from "../components/QuickAddBar";
import { diffDays, formatDueBadge, formatEventTime, formatShortDate, greetingRu, isDueThisWeek, isLessonEvent, isOverdue, parseDateOnly, todayLocalDate } from "../lib/date";
import type { QuickTaskParsed } from "../lib/quick-task";
import { isSrsDue } from "../lib/srs";

export function HomeView({
  state,
  onToggleTask,
  onPostponeTask,
  onQuickCreate,
  onOpenTask,
  onOpenCreateTask,
  onOpenTab,
  onOpenSubject,
}: {
  state: DesktopState;
  onToggleTask: (id: string) => void;
  onPostponeTask: (id: string) => void;
  onQuickCreate: (parsed: QuickTaskParsed) => void;
  onOpenTask: (task: TaskDto) => void;
  onOpenCreateTask: () => void;
  onOpenTab: (tab: "tasks" | "review" | "calendar") => void;
  onOpenSubject: (id: string) => void;
}) {
  const { snapshot, prefs, session } = state;
  const today = todayLocalDate();
  const subjectsById = new Map(snapshot.subjects.map((s) => [s.id, s]));

  const openTasks = snapshot.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const overdueTasks = openTasks.filter((t) => isOverdue(t, today));
  const weekTasks = openTasks.filter((t) => isOverdue(t, today) || isDueThisWeek(t, today));
  const dueReviewCount = snapshot.questions.filter((q) => q.srsReps > 0 && isSrsDue(q.srsDue)).length;

  const visibleEvents = snapshot.todayEvents.filter((ev) => prefs.showLessons || !isLessonEvent(ev));
  const upcomingExams = snapshot.subjects
    .map((s) => ({ subject: s, d: parseDateOnly(s.examDate) }))
    .filter((x): x is { subject: typeof x.subject; d: Date } => x.d !== null && diffDays(x.d, today) >= 0)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading text-3xl text-fg">
            {greetingRu()}, {session.user?.name?.split(" ")[0] || "студент"}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Открыто задач: {openTasks.length} · Выполнено на неделе: {session.doneThisWeek}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateTask}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          Новая задача
        </button>
      </div>

      <QuickAddBar subjects={snapshot.subjects} onCreate={onQuickCreate} />

      {overdueTasks.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-urgent/30 bg-urgent-soft/70 px-4 py-3 text-sm text-urgent">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Просрочено задач: {overdueTasks.length}
          </div>
          <button type="button" onClick={() => onOpenTab("tasks")} className="inline-flex items-center gap-1 font-semibold hover:underline">
            Открыть <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="heading text-xl">Ближайшие дедлайны</h2>
              <button type="button" onClick={() => onOpenTab("tasks")} className="text-xs font-medium text-accent hover:underline">
                Все задачи ({openTasks.length})
              </button>
            </div>
            {weekTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">На ближайшие 7 дней срочных задач нет</p>
            ) : (
              <div className="divide-y divide-line">
                {weekTasks.slice(0, 12).map((task) => {
                  const sub = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
                  const due = formatDueBadge(task.dueDate, task.dueTime, today);
                  const done = task.status === "DONE";
                  return (
                    <div key={task.id} className="group flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          done ? "border-accent bg-accent text-white" : "border-muted hover:border-accent"
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" /> : null}
                      </button>
                      <button type="button" onClick={() => onOpenTask(task)} className="min-w-0 flex-1 text-left">
                        <div className={`truncate text-sm font-medium ${done ? "text-muted line-through" : "text-fg hover:text-accent"}`}>
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {sub ? <span>{sub.emoji} {sub.name}</span> : null}
                          <span className={due.urgent ? "font-medium text-urgent" : ""}>{due.label}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPostponeTask(task.id)}
                        title="Перенести на завтра"
                        className="rounded-lg border border-line px-2 py-1 text-xs text-muted opacity-0 transition-opacity hover:border-accent hover:text-accent group-hover:opacity-100"
                      >
                        На завтра
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {visibleEvents.length > 0 ? (
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="heading text-xl">Сегодня в расписании</h2>
                <button type="button" onClick={() => onOpenTab("calendar")} className="text-xs font-medium text-accent hover:underline">
                  Календарь
                </button>
              </div>
              <div className="space-y-2">
                {visibleEvents.map((ev) => (
                  <div key={ev.key} className="flex items-center gap-3 rounded-xl bg-subtle/60 px-3 py-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ev.color }} />
                    <span className="w-12 shrink-0 tabular-nums text-xs font-medium text-muted">
                      {ev.allDay ? "день" : formatEventTime(ev.start)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
                    {ev.location ? <span className="text-xs text-muted">{ev.location}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-accent">
              <School className="h-5 w-5" />
              <h2 className="heading text-xl text-fg">Повторение (SRS)</h2>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {dueReviewCount > 0 ? `К повторению готовы ${dueReviewCount} карт.` : "На сегодня все запланированные карточки пройдены."}
            </p>
            <button
              type="button"
              onClick={() => onOpenTab("review")}
              className="mt-3 h-9 w-full rounded-xl bg-accent-soft text-sm font-medium text-accent hover:opacity-90"
            >
              Перейти к карточкам
            </button>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent" />
              <h2 className="heading text-xl">Ближайшие экзамены</h2>
            </div>
            {upcomingExams.length === 0 ? (
              <p className="text-sm text-muted">Даты экзаменов не указаны</p>
            ) : (
              <div className="space-y-2">
                {upcomingExams.map(({ subject, d }) => {
                  const days = diffDays(d, today);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => onOpenSubject(subject.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-left hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{subject.emoji} {subject.name}</div>
                        <div className="text-xs text-muted">{formatShortDate(subject.examDate)}</div>
                      </div>
                      <span className={`text-xs font-semibold ${days <= 7 ? "text-urgent" : "text-muted"}`}>
                        {days === 0 ? "Сегодня" : `через ${days} дн.`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
