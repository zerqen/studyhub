import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Brain, CalendarClock, CheckCircle2, GraduationCap, Pin } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/lib/queries";
import { daysUntil, formatDate, formatRelative } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { QuickCreate } from "@/components/dashboard/quick-create";
import { Section } from "@/components/ui/page";
import { ActivityHeatmap } from "@/components/dashboard/activity";
import { TodayLessons } from "@/components/dashboard/today-lessons";
import { kindMeta } from "@/lib/schedule";
import { KindChip } from "@/components/tasks/kind-chip";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("ru-RU", { hour: "numeric", timeZone: "Europe/Moscow" }).format(new Date()));
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function examLabel(d: number | null) {
  if (d === null) return "без даты";
  if (d < 0) return "дата прошла";
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  return `через ${d} дн.`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user.id);
  const firstName = user.name.split(" ")[0];
  const nextExam = data.exams[0];
  const nextExamDays = nextExam ? daysUntil(nextExam.examDate) : null;
  const focusCount = data.todayTasks.length + data.overdue.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted">{formatDate(new Date(), "EEEE, d MMMM")}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
        </div>
        <QuickCreate subjects={data.subjects.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={GraduationCap}
          label="Выучено вопросов"
          value={data.learnedQuestions}
          total={data.totalQuestions}
          progress={data.totalQuestions ? (data.learnedQuestions / data.totalQuestions) * 100 : 0}
        />
        <Stat
          icon={CheckCircle2}
          label="Задач закрыто"
          value={data.doneTasks}
          total={data.totalTasks}
          progress={data.totalTasks ? (data.doneTasks / data.totalTasks) * 100 : 0}
        />
        <Link href="/review" className="card card-hover p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Brain className="h-4 w-4" /> К повторению
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-semibold tabular-nums tracking-tight ${data.dueCount ? "text-accent" : ""}`}>{data.dueCount}</span>
            <span className="text-sm text-muted">{data.newCount ? `+ ${data.newCount} новых` : "сегодня"}</span>
          </div>
          <div className="mt-1 text-xs font-medium text-accent">{data.dueCount || data.newCount ? "Начать →" : "всё повторено"}</div>
        </Link>
        {nextExam ? (
          <Link href={`/subjects/${nextExam.id}`} className="card card-hover p-4">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <CalendarClock className="h-4 w-4" /> Ближайший экзамен
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{examLabel(nextExamDays)}</div>
            <div className="mt-1 truncate text-xs text-muted">
              {nextExam.emoji} {nextExam.name}
            </div>
          </Link>
        ) : (
          <Stat icon={CalendarClock} label="Ближайший экзамен" value="—" hint="даты не указаны" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section
          title={
            <span className="flex items-center gap-2">
              Фокус на сегодня
              {focusCount ? <span className="rounded-full bg-subtle px-1.5 text-xs font-medium text-muted">{focusCount}</span> : null}
            </span>
          }
          action={
            <Link href="/tasks" className="text-xs font-medium text-muted hover:text-fg">
              Все задачи
            </Link>
          }
          bodyClassName="p-1.5"
        >
          {focusCount === 0 ? (
            <div className="flex items-center gap-3 px-3 py-5 text-sm text-muted">
              <CheckCircle2 className="h-5 w-5 text-success" />
              На сегодня всё чисто. Хорошее время повторить вопросы.
            </div>
          ) : (
            <ul>
              {data.overdue.map((t) => (
                <TaskRow key={t.id} task={t} overdue />
              ))}
              {data.todayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
          {data.upcoming.length ? (
            <>
              <div className="label-xs px-3 pb-1 pt-4">Дальше</div>
              <ul>
                {data.upcoming.map((t) => (
                  <TaskRow key={t.id} task={t} showDate />
                ))}
              </ul>
            </>
          ) : null}
        </Section>

        <div className="space-y-4">
          {data.todayEvents.length ? (
            <Section title="Сегодня по расписанию" bodyClassName="p-1.5">
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
            </Section>
          ) : null}
          <Section title="Экзамены" bodyClassName="p-1.5">
            {data.exams.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Добавь дату экзамена в карточке предмета — здесь появится обратный отсчёт.</p>
            ) : (
              <ul>
                {data.exams.map((s) => {
                  const d = daysUntil(s.examDate);
                  return (
                    <li key={s.id}>
                      <Link href={`/subjects/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-subtle">
                        <span className="text-lg">{s.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.name}</span>
                          <span className="block text-xs text-muted">{formatDate(s.examDate, "d MMMM")}</span>
                        </span>
                        <span className={`text-xs font-medium ${d !== null && d <= 3 ? "text-danger" : "text-muted"}`}>{examLabel(d)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {data.recentTopics.length ? (
            <Section
              title="Изучаю"
              action={
                <Link href="/learn" className="text-xs font-medium text-muted hover:text-fg">
                  Все
                </Link>
              }
              bodyClassName="p-1.5"
            >
              <ul>
                {data.recentTopics.map((t) => (
                  <li key={t.id}>
                    <Link href={`/lectures/${t.id}`} className="flex gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-subtle">
                      <span className="text-base leading-6">{t.subject.emoji}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {t.subject.name} · {formatRelative(t.updatedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.notes.length ? (
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <Pin className="h-3.5 w-3.5" /> Закреплённые заметки
                </span>
              }
              bodyClassName="p-1.5"
            >
              <ul>
                {data.notes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes?open=${n.id}`} className="flex gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-subtle">
                      <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: n.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        {n.content ? <span className="block truncate text-xs text-muted">{n.content.slice(0, 120)}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      <ActivityHeatmap activity={data.activity} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Предметы</h2>
          <Link href="/subjects" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
            Все <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {data.subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="Пока нет предметов" hint="Добавь первый — вокруг него появятся вопросы, задачи и заметки." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: `${s.color}1a` }}>
                    {s.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-muted">
                      {s.questionsTotal ? `осталось ${s.questionsLeft} из ${s.questionsTotal} вопросов` : "вопросов пока нет"}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{s.progress}%</span>
                </div>
                <ProgressBar value={s.progress} color={s.color} className="mt-3" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  total,
  hint,
  progress,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  total?: number;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {total !== undefined ? <span className="text-sm text-muted">/ {total}</span> : null}
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </div>
      {progress !== undefined ? <ProgressBar value={progress} className="mt-2.5" /> : null}
    </div>
  );
}

function TaskRow({
  task,
  overdue,
  showDate,
}: {
  task: { id: string; title: string; dueDate: Date | null; dueTime: string | null; kind?: string; subject: { name: string; color: string } | null };
  overdue?: boolean;
  showDate?: boolean;
}) {
  return (
    <li>
      <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-subtle">
        {overdue ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: task.subject?.color ?? "rgb(var(--muted))" }} />
        )}
        <KindChip kind={task.kind} />
        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
        {task.subject ? <span className="hidden truncate text-xs text-muted sm:block sm:max-w-[10rem]">{task.subject.name}</span> : null}
        <span className={`shrink-0 text-xs tabular-nums ${overdue ? "font-medium text-danger" : "text-muted"}`}>
          {overdue ? formatDate(task.dueDate, "d MMM") : showDate ? formatDate(task.dueDate, "d MMM") : task.dueTime ?? "сегодня"}
        </span>
      </Link>
    </li>
  );
}
