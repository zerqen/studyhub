import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/lib/queries";
import { daysUntil, formatDate } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { QuickCreate } from "@/components/dashboard/quick-create";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user.id);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Study flow</p>
            <p className="text-sm text-[var(--muted)]">Привет, {user.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Сегодняшняя сессия</h1>
            <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">Небольшие шаги каждый день — и подготовка не давит.</p>
          </div>
          <QuickCreate />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Вопросы" value={`${data.learnedQuestions}/${data.totalQuestions}`} hint="выучено" />
        <Stat label="Предметы" value={String(data.subjects.length)} hint="в работе" />
        <Stat label="Задачи" value={`${data.doneTasks}/${data.totalTasks}`} hint="закрыто" />
        <Stat label="Просрочено" value={String(data.overdue.length)} hint="нужно закрыть" danger={data.overdue.length > 0} />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="На сегодня">
          {data.todayTasks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">На сегодня задач нет — можно повторить вопросы.</p>
          ) : (
            data.todayTasks.map((t) => (
              <Link key={t.id} href={`/tasks?open=${t.id}`} className="block rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5">
                {t.title}
              </Link>
            ))
          )}
        </Card>
        <Card title="Просроченные">
          {data.overdue.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Просрочек нет. Красиво.</p>
          ) : (
            data.overdue.map((t) => (
              <Link key={t.id} href={`/tasks?open=${t.id}`} className="block rounded-xl px-2 py-1.5 text-rose-700 hover:bg-rose-50 dark:text-rose-300">
                {t.title}
              </Link>
            ))
          )}
        </Card>
        <Card title="Ближайшие дедлайны">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Пусто.</p>
          ) : (
            data.upcoming.map((t) => (
              <Link key={t.id} href={`/tasks?open=${t.id}`} className="flex justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-black/5">
                <span>{t.title}</span>
                <span className="text-[var(--muted)]">{formatDate(t.dueDate)}</span>
              </Link>
            ))
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Прогресс по предметам</h2>
        {data.subjects.length === 0 ? (
          <EmptyState title="Пока нет предметов" hint="Добавь первый — вокруг него появятся вопросы и задачи." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.subjects.map((s) => {
              const d = daysUntil(s.examDate);
              return (
                <Link key={s.id} href={`/subjects/${s.id}`} className="rounded-2xl bg-[var(--bg-elev)] p-4 shadow-card">
                  <div className="mb-2 flex items-center gap-2">
                    <span>{s.emoji}</span>
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-auto text-sm text-[var(--muted)]">{s.progress}%</span>
                  </div>
                  <ProgressBar value={s.progress} color={s.color} />
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {d === null
                      ? "Дата ещё не указана"
                      : d < 0
                        ? "Дата уже прошла"
                        : d === 0
                          ? "Сегодня экзамен"
                          : `Осталось ${d} дн. до экзамена`}
                    {s.questions.length ? ` · Осталось ${s.questions.filter((q) => q.status !== "LEARNED").length} вопросов` : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Ближайшие экзамены">
          {data.exams.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Нет дат.</p>
          ) : (
            data.exams.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="flex justify-between py-1.5 text-sm">
                <span>
                  {s.emoji} {s.name}
                </span>
                <span>{formatDate(s.examDate)}</span>
              </Link>
            ))
          )}
        </Card>
        <Card title="Закреплённые заметки">
          {data.notes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ничего не закреплено.</p>
          ) : (
            data.notes.map((n) => (
              <Link key={n.id} href={`/notes?open=${n.id}`} className="block py-1.5 text-sm">
                {n.title}
              </Link>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-elev)] p-4 shadow-card">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className={`text-2xl font-semibold ${danger ? "text-rose-600" : ""}`}>{value}</div>
      <div className="text-xs text-[var(--muted)]">{hint}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-elev)] p-4 shadow-card">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </div>
  );
}
