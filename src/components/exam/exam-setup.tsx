"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, GraduationCap, Info, Play, Timer, Trash2 } from "lucide-react";
import { deleteExam, startExam } from "@/actions/exams";
import { gradeLabel } from "@/lib/exam";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Select } from "../ui/field";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";

type HistoryItem = {
  id: string;
  ticketNo: number | null;
  phase: string;
  grade: number | null;
  score: number | null;
  items: number;
  startedAt: string;
  finishedAt: string | null;
};

type Config = { theory: number; problems: number; extra: number; prepMinutes: number; source: "random" | "real"; ticketNo: number; weak: boolean };

const DEFAULTS: Config = { theory: 2, problems: 3, extra: 3, prepMinutes: 40, source: "random", ticketNo: 0, weak: true };

export function gradeTone(grade: number | null | undefined) {
  if (grade === 5) return "text-success";
  if (grade === 4) return "text-accent";
  if (grade === 3) return "text-warning";
  if (grade === 2) return "text-danger";
  return "text-muted";
}

export function ExamSetup({
  subject,
  stats,
  history,
}: {
  subject: { id: string; name: string; emoji: string; color: string; examDate: string | null };
  stats: { theory: number; problems: number; tickets: number[] };
  history: HistoryItem[];
}) {
  const storageKey = `studyhub:exam:${subject.id}`;
  const [c, setC] = useState<Config>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const router = useRouter();
  const toast = useToast();

  // Настройки запоминаются для каждого предмета (только в этом браузере)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setC({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {
      /* нет доступа к хранилищу — работаем с настройками по умолчанию */
    }
  }, [storageKey]);
  const set = (patch: Partial<Config>) =>
    setC((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* не страшно */
      }
      return next;
    });

  const hasTickets = stats.tickets.length > 0;
  const real = hasTickets && c.source === "real";
  const finished = history.filter((h) => h.phase === "DONE" && h.grade !== null && !hidden.has(h.id));
  const avg = finished.length ? finished.slice(0, 5).reduce((a, h) => a + (h.grade ?? 0), 0) / Math.min(5, finished.length) : null;
  const d = daysUntil(subject.examDate);
  const empty = stats.theory + stats.problems === 0;

  async function start() {
    setBusy(true);
    const res = await startExam({
      subjectId: subject.id,
      theory: c.theory,
      problems: c.problems,
      extra: c.extra,
      prepMinutes: c.prepMinutes,
      ticketNo: real ? c.ticketNo : null,
      weak: c.weak,
    });
    if (!res.ok) {
      setBusy(false);
      toast.push(res.error, "err");
      return;
    }
    router.push(`/exams/${res.data!.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/subjects/${subject.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {subject.emoji} {subject.name}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Пробный экзамен</h1>
          <p className="mt-1 text-sm text-muted">
            Билет, время на подготовку, потом ответ и вопросы препода — как на настоящем экзамене.
            {d !== null && d >= 0 ? ` До экзамена ${d === 0 ? "— сегодня" : `${d} дн.`}` : ""}
          </p>
        </div>
        {avg !== null ? (
          <div className="text-right">
            <div className={cn("text-2xl font-semibold tabular-nums", gradeTone(Math.round(avg)))}>{avg.toFixed(1)}</div>
            <div className="text-xs text-muted">средняя за последние {Math.min(5, finished.length)}</div>
          </div>
        ) : null}
      </div>

      <div className="card animate-fade-in space-y-5 p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatBox label="теория" value={stats.theory} />
          <StatBox label="задачи" value={stats.problems} />
          <StatBox label="билеты" value={stats.tickets.length || "—"} />
        </div>

        {stats.problems === 0 && !empty ? (
          <p className="flex gap-2 rounded-xl bg-subtle px-3 py-2.5 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Задач пока нет. Добавь вопрос с типом «Задача» или при импорте JSON укажи <code className="rounded bg-surface px-1">&quot;kind&quot;: &quot;PROBLEM&quot;</code> — тогда в билет попадут 3 задачки.
            </span>
          </p>
        ) : null}

        {hasTickets ? (
          <Row label="Билет">
            <Segmented
              value={c.source}
              onChange={(source) => set({ source })}
              options={[
                ["random", "Собрать случайно"],
                ["real", "Из списка билетов"],
              ]}
            />
            {real ? (
              <Select value={String(c.ticketNo)} onChange={(e) => set({ ticketNo: Number(e.target.value) })} className="h-8 w-auto text-[13px]">
                <option value="0">Любой</option>
                {stats.tickets.map((n) => (
                  <option key={n} value={n}>
                    Билет {n}
                  </option>
                ))}
              </Select>
            ) : null}
          </Row>
        ) : null}

        {!real ? (
          <>
            <Row label="Теория в билете">
              <Segmented value={String(c.theory)} onChange={(v) => set({ theory: Number(v) })} options={[["1", "1"], ["2", "2"], ["3", "3"]] as const} />
            </Row>
            <Row label="Задачи">
              <Segmented value={String(c.problems)} onChange={(v) => set({ problems: Number(v) })} options={[["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]] as const} />
            </Row>
          </>
        ) : null}
        <Row label="Вопросы препода" hint="половина — по теме билета, остальные — по всему курсу">
          <Segmented value={String(c.extra)} onChange={(v) => set({ extra: Number(v) })} options={[["0", "Нет"], ["2", "2"], ["3", "3"], ["5", "5"]] as const} />
        </Row>
        <Row label="Подготовка">
          <Segmented
            value={String(c.prepMinutes)}
            onChange={(v) => set({ prepMinutes: Number(v) })}
            options={[["0", "Без"], ["20", "20 мин"], ["30", "30"], ["40", "40"], ["60", "60"]] as const}
          />
        </Row>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.weak} onChange={(e) => set({ weak: e.target.checked })} />
          Чаще попадаются слабые вопросы (забытые, сложные, ещё не выученные)
        </label>

        <Button size="lg" className="w-full" loading={busy} disabled={empty} onClick={() => void start()}>
          <Play className="h-4 w-4" /> Тянуть билет
        </Button>
        {empty ? <p className="text-center text-sm text-muted">Сначала добавь вопросы в предмет.</p> : null}
      </div>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="h-4 w-4 text-muted" /> История
        </h2>
        {history.filter((h) => !hidden.has(h.id)).length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">Здесь появятся пробные экзамены и оценки.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {history
              .filter((h) => !hidden.has(h.id))
              .map((h) => (
                <li key={h.id} className="group flex items-center">
                  <Link href={`/exams/${h.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-subtle text-lg font-semibold tabular-nums", gradeTone(h.grade))}>
                      {h.phase === "DONE" ? h.grade ?? "—" : <Timer className="h-4 w-4 text-accent" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {h.ticketNo ? `Билет ${h.ticketNo}` : "Случайный билет"}
                        {h.phase !== "DONE" ? <span className="ml-2 text-xs font-normal text-accent">не закончен — продолжить</span> : null}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatDate(h.startedAt, "d MMMM, HH:mm")} · {h.items} вопр.
                        {h.phase === "DONE" ? ` · ${gradeLabel(h.grade)}` : ""}
                      </span>
                    </span>
                  </Link>
                  <button
                    className="mr-2 rounded-lg p-2 text-muted opacity-0 transition-opacity hover:bg-subtle hover:text-danger focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                    aria-label="Удалить"
                    onClick={() =>
                      toast.undoable({
                        text: "Попытка удалена",
                        hide: () => setHidden((s) => new Set(s).add(h.id)),
                        restore: () =>
                          setHidden((s) => {
                            const n = new Set(s);
                            n.delete(h.id);
                            return n;
                          }),
                        commit: () => deleteExam(h.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      <details className="mt-6 text-sm text-muted">
        <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-fg/80">
          <GraduationCap className="h-4 w-4" /> Как ставится оценка
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>Каждый пункт оцениваешь сам, сверившись с эталонным ответом: «не смог», «с трудом», «хорошо», «отлично».</p>
          <p>Билет весит 70%, вопросы препода — 30%. Если больше половины билета — «не смог», выйдет двойка, как бы ни ответил на дополнительные.</p>
          <p>Всё, на что ответил слабо, само попадает в «Повторение» на ближайшие дни.</p>
        </div>
      </details>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-subtle px-2 py-2.5">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="w-40 shrink-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-muted">{hint}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
