"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, PenLine, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { recordAttempt } from "@/actions/questions";
import { DIFFICULTIES, labelOf } from "@/lib/constants";
import { GRADES, isDue, previewLabel, schedule, type Grade, type SrsState } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Segmented } from "../ui/page";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";
import { Pomodoro } from "./pomodoro";
import { AnswerCheck } from "../ai/answer-check";
import { useAiEnabled } from "../ai/use-ai";

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

const NEW_PER_SESSION = 20;

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

const gradeStyle: Record<Grade, string> = {
  0: "text-danger hover:bg-danger/10",
  1: "text-warning hover:bg-warning/10",
  2: "text-success hover:bg-success/10",
  3: "text-accent hover:bg-accent/10",
};

export function StudyMode({ questions, color, showSubject }: { questions: StudyQuestion[]; color?: string; showSubject?: boolean }) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [filter, setFilter] = useState<Filter>(() => (pick(questions, "due").length ? "due" : "all"));
  const [random, setRandom] = useState(false);
  // Колода фиксируется на время сессии — оценки не «перемешивают» её на ходу
  const [deck, setDeck] = useState<StudyQuestion[]>(() => pick(questions, filter));
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [results, setResults] = useState<Record<string, Grade>>({});
  const [srs, setSrs] = useState<Record<string, SrsState>>({});
  // «Своими словами»: поле ответа и оценка, которую предложил ИИ
  const [writing, setWriting] = useState(false);
  const [suggested, setSuggested] = useState<Grade | null>(null);
  const ai = useAiEnabled();
  const toast = useToast();

  const restart = useCallback(
    (nextFilter: Filter = filter, nextRandom = random, only?: StudyQuestion[]) => {
      const base = only ?? pick(questions, nextFilter);
      setDeck(nextRandom ? shuffled(base) : base);
      setIndex(0);
      setShow(false);
      setWriting(false);
      setSuggested(null);
      setResults({});
    },
    [filter, random, questions],
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
      setWriting(false);
      setSuggested(null);
    },
    [deck.length],
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={filter}
          options={filters.map(([id, label]) => [id, id === "due" && counts.due ? `${label} · ${counts.due}` : id === "new" && counts.new ? `${label} · ${counts.new}` : label] as const)}
          onChange={(f) => {
            setFilter(f);
            restart(f);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <Pomodoro />
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
              ["list", "Шпаргалка"],
            ]}
            onChange={setView}
          />
        </div>
      </div>

      {view === "list" ? (
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
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(index / deck.length) * 100}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {index + 1} / {deck.length}
            </span>
          </div>

          <div key={`${current.id}-${index}`} className="card animate-slide-up overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: current.subject?.color ?? color ?? "rgb(var(--accent))" }} />
              <span className="truncate">
                {showSubject && current.subject ? (
                  <Link href={`/subjects/${current.subject.id}`} className="hover:text-fg">
                    {current.subject.emoji} {current.subject.name}
                  </Link>
                ) : current.lecture ? (
                  `Лекция ${current.lecture.number ?? ""} · ${current.lecture.title}`
                ) : (
                  current.ticket?.title ?? "Вопрос"
                )}
              </span>
              <span className="ml-auto shrink-0">
                {current.srsReps === 0 ? "новый" : `повтор ${current.srsReps}`} · {labelOf(DIFFICULTIES, current.difficulty)}
              </span>
            </div>

            <button className="block w-full px-5 py-8 text-left sm:px-8 sm:py-10" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть ответ" : "Показать ответ"}>
              <div className="text-lg font-semibold leading-relaxed sm:text-xl">
                <Markdown>{current.text}</Markdown>
              </div>
              {current.attachments
                .filter((a) => a.mimeType.startsWith("image/"))
                .map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} loading="lazy" className="mt-5 max-h-64 rounded-xl border border-line object-contain" />
                ))}
            </button>

            {writing ? (
              <div className="border-t border-line px-5 py-4 sm:px-8">
                <AnswerCheck
                  questionId={current.id}
                  autoFocus
                  onChecked={(fb) => {
                    setSuggested(fb.grade);
                    setShow(true);
                  }}
                />
              </div>
            ) : null}

            {show ? (
              <div className="animate-slide-up border-t border-line bg-subtle/50 px-5 py-5 sm:px-8">
                <div className="label-xs mb-2 text-accent">Ответ</div>
                {current.answer ? <Markdown>{current.answer}</Markdown> : <span className="text-muted">Ответа пока нет — его можно добавить на странице вопроса.</span>}
                {current.explanation ? (
                  <div className="mt-3 text-sm text-muted">
                    <Markdown>{current.explanation}</Markdown>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-line p-3">
              {show ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {GRADES.map((g) => (
                    <button
                      key={g.grade}
                      onClick={() => mark(g.grade)}
                      className={cn(
                        "flex flex-col items-center rounded-xl border border-line px-1 py-2 transition-colors",
                        gradeStyle[g.grade],
                        suggested === g.grade && "ring-2 ring-accent/50",
                      )}
                      title={suggested === g.grade ? "Так оценил ИИ" : undefined}
                    >
                      <span className="text-sm font-medium">{g.label}</span>
                      <span className="text-[11px] text-muted">
                        {previewLabel(stateOf(current), g.grade)}
                        <kbd className="ml-1 hidden sm:inline">· {g.key}</kbd>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => go(-1)} disabled={index === 0} aria-label="Назад">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  {ai && !writing ? (
                    <Button variant="secondary" size="lg" onClick={() => setWriting(true)} title="Ответить своими словами — ИИ проверит">
                      <PenLine className="h-4 w-4" /> <span className="hidden sm:inline">Своими словами</span>
                    </Button>
                  ) : null}
                  <Button size="lg" className="flex-1" onClick={() => setShow(true)}>
                    <Eye className="h-4 w-4" /> Показать ответ
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Пропустить">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 hidden text-center text-xs text-muted sm:block">Пробел — ответ · 1–4 — оценка · ← → — листать</p>
        </>
      ) : null}
    </div>
  );
}
