"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw, Shuffle, Sparkles, Trophy } from "lucide-react";
import { recordAttempt } from "@/actions/questions";
import { DIFFICULTIES, labelOf } from "@/lib/constants";
import { GRADES, isDue, schedule, whenLabel, type Grade, type SrsState } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Segmented } from "../ui/page";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";
import { Pomodoro } from "./pomodoro";
import { useAnswerCheck } from "../ai/answer-check";
import { useAiEnabled } from "../ai/use-ai";
import { DefinitionDrill } from "./definition-drill";
import { gradeStyle } from "./grade-style";

export type StudyQuestion = {
  id: string;
  text: string;
  answer: string | null;
  explanation: string | null;
  status: string;
  difficulty: string;
  srsDue: string | Date | null;
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsLapses: number;
  kind?: string;
  ticketNo?: number | null;
  ticket?: { title: string } | null;
  lecture?: { title: string; number: number | null } | null;
  subject?: { id: string; name: string; emoji: string; color: string } | null;
  attachments: { id: string; mimeType: string; originalName: string }[];
};

const filters = [
  ["due", "К повторению"],
  ["new", "Новые"],
  ["hard", "Сложные"],
  ["all", "Все"],
] as const;
type Filter = (typeof filters)[number][0];

/** Сколько новых вопросов добавляется в колоду «К повторению» */
export const NEW_PER_SESSION = 20;

function pick(questions: StudyQuestion[], filter: Filter) {
  if (filter === "due") {
    // Сначала те, что пора повторить, потом немного новых
    const due = questions.filter((q) => q.srsReps > 0 && isDue(q.srsDue));
    const fresh = questions.filter((q) => q.srsReps === 0 && isDue(q.srsDue)).slice(0, NEW_PER_SESSION);
    return [...due, ...fresh];
  }
  if (filter === "new") return questions.filter((q) => q.srsReps === 0);
  if (filter === "hard") return questions.filter((q) => q.difficulty === "HARD" || q.srsLapses >= 2 || q.status === "REVIEW");
  return questions;
}

function shuffled<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function StudyMode({
  questions,
  color,
  showSubject,
  fixed,
  first,
  initialView,
}: {
  questions: StudyQuestion[];
  color?: string;
  showSubject?: boolean;
  /** Готовая колода («10 минут»): без фильтров и помодоро */
  fixed?: boolean;
  /** Начать с этого вопроса (кнопка «Учить» в списке): колода «Все», он первый */
  first?: string;
  /** С какого режима начать: карточки, определения или шпаргалка */
  initialView?: "cards" | "defs" | "list";
}) {
  const [view, setView] = useState<"cards" | "defs" | "list">(initialView ?? "cards");
  const [filter, setFilter] = useState<Filter>(() => (first ? "all" : !fixed && pick(questions, "due").length ? "due" : "all"));
  const [random, setRandom] = useState(false);
  // Колода фиксируется на время сессии — оценки не «перемешивают» её на ходу
  const [deck, setDeck] = useState<StudyQuestion[]>(() => {
    const base = pick(questions, filter);
    const i = first ? base.findIndex((q) => q.id === first) : -1;
    return i > 0 ? [...base.slice(i), ...base.slice(0, i)] : base;
  });
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [results, setResults] = useState<Record<string, Grade>>({});
  const [srs, setSrs] = useState<Record<string, SrsState>>({});
  // «Своими словами»: поле ответа и оценка, которую предложил ИИ
  // «Своими словами» — свой ответ к текущей карточке и проверка ассистентом
  const [own, setOwn] = useState("");
  const ai = useAiEnabled();
  const toast = useToast();
  const check = useAnswerCheck(deck[index]?.id ?? "");
  const resetCheck = check.setFb;

  const restart = useCallback(
    (nextFilter: Filter = filter, nextRandom = random, only?: StudyQuestion[]) => {
      const base = only ?? pick(questions, nextFilter);
      setDeck(nextRandom ? shuffled(base) : base);
      setIndex(0);
      setShow(false);
      setOwn("");
      resetCheck(null);
      setResults({});
    },
    [filter, random, questions, resetCheck],
  );

  const current = deck[index];
  const done = index >= deck.length && deck.length > 0;
  const graded = Object.values(results);
  const forgot = graded.filter((g) => g === 0).length;
  const stateOf = (q: StudyQuestion): SrsState => srs[q.id] ?? { interval: q.srsInterval, ease: q.srsEase, reps: q.srsReps, lapses: q.srsLapses };

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length));
      setShow(false);
      setOwn("");
      resetCheck(null);
    },
    [deck.length, resetCheck],
  );

  const mark = useCallback(
    (grade: Grade) => {
      if (!current) return;
      const prev = srs[current.id] ?? { interval: current.srsInterval, ease: current.srsEase, reps: current.srsReps, lapses: current.srsLapses };
      setSrs((s) => ({ ...s, [current.id]: schedule(prev, grade) }));
      setResults((r) => ({ ...r, [current.id]: grade }));
      // «Забыл» — вопрос вернётся в конец этой же сессии
      if (grade === 0 && !deck.slice(index + 1).some((q) => q.id === current.id)) setDeck((d) => [...d, current]);
      go(1);
      // Сохраняем в фоне — карточки листаются мгновенно
      void recordAttempt(current.id, grade).then((res) => {
        if (!res.ok) toast.push(res.error, "err");
      });
    },
    [current, deck, index, go, srs, toast],
  );

  async function compare() {
    if (!current || !own.trim()) return;
    const fb = await check.run(own);
    if (fb) setShow(true);
  }

  useEffect(() => {
    if (view !== "cards") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const t = event.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setShow((v) => !v);
      }
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (show && ["1", "2", "3", "4"].includes(event.key)) mark((Number(event.key) - 1) as Grade);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, show, mark, go]);

  const listItems = useMemo(() => pick(questions, filter), [questions, filter]);
  const counts = useMemo(() => ({ due: pick(questions, "due").length, new: pick(questions, "new").length }), [questions]);

  if (questions.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">Добавь вопросы — и здесь можно будет тренироваться.</p>;
  }

  return (
    <div className={cn("mx-auto", view === "cards" ? "max-w-5xl" : "max-w-3xl")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {fixed ? null : (
          <Segmented
            value={filter}
            options={filters.map(([id, label]) => [id, id === "due" && counts.due ? `${label} · ${counts.due}` : id === "new" && counts.new ? `${label} · ${counts.new}` : label] as const)}
            onChange={(f) => {
              setFilter(f);
              restart(f);
            }}
          />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {fixed ? null : <Pomodoro />}
          {view === "cards" ? (
            <Button
              variant={random ? "primary" : "secondary"}
              size="icon-sm"
              onClick={() => {
                setRandom(!random);
                restart(filter, !random);
              }}
              title="Перемешать"
              aria-label="Перемешать"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Segmented
            value={view}
            options={[
              ["cards", "Карточки"],
              ["defs", "Определения"],
              ["list", "Шпаргалка"],
            ]}
            onChange={setView}
          />
        </div>
      </div>

      {view === "defs" ? (
        <DefinitionDrill key={filter} pool={listItems} all={questions} color={color} showSubject={showSubject} />
      ) : view === "list" ? (
        <div className="space-y-2">
          {listItems.length === 0 ? <p className="card p-6 text-center text-sm text-muted">Нет вопросов по этому фильтру</p> : null}
          {listItems.map((q, i) => (
            <details key={q.id} className="card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                <span className="flex-1 text-sm font-medium leading-snug">
                  <Markdown inline>{q.text}</Markdown>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-line px-4 py-3 pl-12 text-sm">
                {q.answer ? <Markdown>{q.answer}</Markdown> : <span className="text-muted">Ответа пока нет</span>}
                {q.explanation ? (
                  <div className="mt-2 text-muted">
                    <Markdown>{q.explanation}</Markdown>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : deck.length === 0 ? (
        <div className="card p-10 text-center">
          <Trophy className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 font-medium">{filter === "due" ? "На сегодня всё повторено" : "По этому фильтру вопросов нет"}</p>
          <p className="mt-1 text-sm text-muted">{filter === "due" ? "Следующие вопросы вернутся по расписанию. Можно пройти «Все»." : "Попробуй другой фильтр."}</p>
        </div>
      ) : done ? (
        <div className="card animate-pop-in p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-warning" />
          <h3 className="mt-3 text-lg font-semibold">Сессия завершена</h3>
          <p className="mt-1 text-sm text-muted">Ответов: {graded.length}</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <div key={g.grade} className="rounded-xl bg-subtle p-2.5">
                <div className={cn("text-xl font-semibold tabular-nums", gradeStyle[g.grade].split(" ")[0])}>{graded.filter((x) => x === g.grade).length}</div>
                <div className="text-[11px] text-muted">{g.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {forgot > 0 ? (
              <Button onClick={() => restart(filter, random, questions.filter((q) => results[q.id] === 0))}>
                <RotateCcw className="h-4 w-4" /> Ещё раз забытые ({forgot})
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => restart()}>
              Начать заново
            </Button>
          </div>
        </div>
      ) : current ? (
        <>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
            </div>
            <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-muted">
              {index + 1} из {deck.length}
            </span>
          </div>

          <section key={`${current.id}-${index}`} aria-label="Вопрос" className="animate-slide-up overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex flex-col gap-2 border-b border-[#ECE8DF] px-5 py-5 dark:border-line sm:px-7">
              <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                {showSubject && current.subject ? (
                  <>
                    <span className="h-2 w-2 rounded-full" style={{ background: current.subject.color }} />
                    <Link href={`/subjects/${current.subject.id}`} className="hover:text-fg">
                      {current.subject.name}
                    </Link>
                    <span>·</span>
                  </>
                ) : null}
                {[
                  current.ticketNo ? `билет ${current.ticketNo}` : current.lecture ? `лекция ${current.lecture.number ?? ""}`.trim() : null,
                  current.srsReps === 0 ? "новый" : `повтор ${current.srsReps}`,
                  labelOf(DIFFICULTIES, current.difficulty).toLowerCase(),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <div className="heading text-[19px] leading-[1.45] sm:text-[21px]">
                <Markdown>{current.text}</Markdown>
              </div>
              {current.attachments
                .filter((a) => a.mimeType.startsWith("image/"))
                .map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} loading="lazy" className="mt-2 max-h-64 self-start rounded-xl border border-line object-contain" />
                ))}
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))]">
              <div className="flex flex-col gap-2.5 border-[#ECE8DF] px-5 py-5 dark:border-line max-[759px]:border-b min-[760px]:border-r sm:px-7">
                <label htmlFor={`own-${current.id}`} className="text-xs font-semibold uppercase tracking-[0.06em] text-muted/90">
                  Своими словами
                </label>
                <textarea
                  id={`own-${current.id}`}
                  rows={6}
                  value={own}
                  onChange={(e) => setOwn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (ai && own.trim()) void compare();
                      else setShow(true);
                    }
                  }}
                  placeholder="Напиши, что помнишь. Можно коротко и с формулами $A_{m\times n}$"
                  className="resize-y rounded-[10px] border border-line bg-[#F8F6F1] px-3.5 py-3 text-[15px] leading-[1.55] outline-none transition-shadow placeholder:text-muted/60 focus:border-[#9DB4EE] focus:ring-[3px] focus:ring-accent-soft dark:bg-subtle/40"
                />
                <div className="flex flex-wrap gap-2">
                  {ai ? (
                    <button
                      type="button"
                      onClick={() => void compare()}
                      disabled={!own.trim() || check.busy}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-45"
                    >
                      {check.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {check.busy ? (check.wait ? `Лимит, жду ${check.wait} с` : "Сравниваю…") : "Сравнить ответы"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className={cn(
                      "h-11 rounded-[10px] px-4 text-sm font-medium transition-colors",
                      ai ? "border border-line bg-surface hover:bg-subtle" : "bg-accent font-semibold text-white hover:bg-accent/90",
                    )}
                  >
                    {show ? "Скрыть ответ" : "Показать ответ"}
                  </button>
                </div>
                <span className="text-xs text-muted">
                  {ai
                    ? own.trim()
                      ? "Ассистент сверит твой текст с билетом и покажет, что упущено · Ctrl + Enter"
                      : "«Сравнить ответы» заработает, когда напишешь свой вариант"
                    : "Можно и не писать — просто вспомни и открой ответ (пробел)"}
                </span>
              </div>

              <div className="relative flex flex-col gap-2.5 px-5 py-5 sm:px-7">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted/90">Ответ из билета</span>
                <div
                  aria-hidden={!show}
                  className={cn("text-[15px] leading-relaxed transition-[filter] duration-200", !show && "pointer-events-none select-none blur-[7px]")}
                >
                  {current.answer ? <Markdown>{current.answer}</Markdown> : <span className="text-muted">Ответа пока нет — его можно добавить на странице вопроса.</span>}
                  {current.explanation ? (
                    <div className="mt-3 text-sm text-muted">
                      <Markdown>{current.explanation}</Markdown>
                    </div>
                  ) : null}
                </div>
                {!show ? (
                  <button
                    type="button"
                    onClick={() => setShow(true)}
                    className="absolute inset-x-5 bottom-5 top-12 flex items-center justify-center sm:inset-x-7"
                    aria-label="Показать ответ"
                  >
                    <span className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold shadow-[0_4px_14px_rgba(29,33,48,0.10)]">
                      Ответ скрыт — сначала ответь сам
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            {check.fb && show ? (
              <div aria-label="Разбор ассистента" className="mx-5 mb-5 flex animate-slide-up flex-col gap-2.5 rounded-xl border border-[#C9D6F6] bg-[#F4F7FE] px-[18px] py-4 dark:border-accent/30 dark:bg-accent/10 sm:mx-7">
                <span className="text-sm font-semibold">Разбор ассистента</span>
                {check.fb.verdict ? (
                  <p className="text-sm">
                    <Markdown inline>{check.fb.verdict}</Markdown>
                  </p>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-x-6 gap-y-2.5 text-sm leading-normal">
                  {(
                    [
                      ["Есть в твоём ответе", check.fb.good, "text-[#256445] dark:text-success"],
                      ["Не хватает", check.fb.missing, "text-urgent"],
                      ["Ошибки", check.fb.mistakes, "text-danger"],
                    ] as const
                  ).map(([title, items, tone]) =>
                    items.length ? (
                      <div key={title} className="flex flex-col gap-1">
                        <span className={cn("text-xs font-semibold", tone)}>{title}</span>
                        {items.map((x, k) => (
                          <span key={k}>
                            <Markdown inline>{x}</Markdown>
                          </span>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
                <span className="text-[13px] text-[#424655] dark:text-muted">
                  Предлагаю оценку «{GRADES[check.fb.grade].label}» — подсветил её ниже, но решаешь ты.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2.5 border-t border-[#ECE8DF] bg-[#F8F6F1] px-5 pb-5 pt-4 dark:border-line dark:bg-subtle/40 sm:px-7">
              <span className="text-[13px] text-[#424655] dark:text-muted">{show ? "Насколько легко вспомнил?" : "Оценка откроется после ответа"}</span>
              <div className={cn("grid grid-cols-2 gap-2 transition-opacity sm:grid-cols-4", !show && "opacity-50")}>
                {GRADES.map((g) => {
                  const picked = check.fb && check.fb.grade === g.grade;
                  return (
                    <button
                      key={g.grade}
                      type="button"
                      disabled={!show}
                      onClick={() => mark(g.grade)}
                      className={cn(
                        "flex min-h-[60px] flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed",
                        gradeStyle[g.grade],
                        picked && "border-2 border-accent bg-accent-soft",
                      )}
                      title={picked ? "Так предложил ассистент" : undefined}
                    >
                      <span className="text-[15px] font-semibold text-fg">
                        <span className="mr-1.5 text-xs font-normal text-muted">{g.key}</span>
                        {g.label}
                      </span>
                      <span className="text-xs">{whenLabel(stateOf(current), g.grade)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-muted">
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Назад" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-subtle disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Пропустить" title="Пропустить" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-subtle">
                <ArrowRight className="h-4 w-4" />
              </button>
              <span className="ml-1">
                {deck[index + 1] ? `Дальше — ${deck[index + 1].ticketNo ? `билет ${deck[index + 1].ticketNo}` : "следующий вопрос"} · осталось ${deck.length - index - 1}` : "Это последний вопрос"}
              </span>
            </span>
            <Link href={`/questions/${current.id}`} className="text-[#234AB0] hover:underline dark:text-accent">
              Редактировать ответ в билете
            </Link>
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted sm:block">Пробел — показать ответ · 1–4 — оценка · ← → — листать</p>
        </>
      ) : null}
    </div>
  );
}
