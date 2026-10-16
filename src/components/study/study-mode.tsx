"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, Shuffle, Trophy, X } from "lucide-react";
import { recordAttempt } from "@/actions/questions";
import { DIFFICULTIES, labelOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";

export type StudyQuestion = {
  id: string;
  text: string;
  answer: string | null;
  explanation: string | null;
  status: string;
  difficulty: string;
  ticket: { title: string } | null;
  attachments: { id: string; mimeType: string; originalName: string }[];
};

const filters = [
  ["todo", "Невыученные"],
  ["review", "На повтор"],
  ["hard", "Сложные"],
  ["all", "Все"],
] as const;
type Filter = (typeof filters)[number][0];

function pick(questions: StudyQuestion[], filter: Filter) {
  if (filter === "todo") return questions.filter((q) => q.status !== "LEARNED");
  if (filter === "review") return questions.filter((q) => q.status === "REVIEW");
  if (filter === "hard") return questions.filter((q) => q.difficulty === "HARD");
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

export function StudyMode({ questions, color }: { questions: StudyQuestion[]; color?: string }) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [filter, setFilter] = useState<Filter>(() => (questions.some((q) => q.status !== "LEARNED") ? "todo" : "all"));
  const [random, setRandom] = useState(false);
  // Набор вопросов фиксируется на время сессии — оценка ответа не «перемешивает» колоду
  const [deck, setDeck] = useState<StudyQuestion[]>(() => pick(questions, filter));
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const restart = useCallback(
    (nextFilter: Filter = filter, nextRandom = random, only?: StudyQuestion[]) => {
      const base = only ?? pick(questions, nextFilter);
      setDeck(nextRandom ? shuffled(base) : base);
      setIndex(0);
      setShow(false);
      setResults({});
    },
    [filter, random, questions],
  );

  const current = deck[index];
  const done = index >= deck.length && deck.length > 0;
  const known = Object.values(results).filter(Boolean).length;
  const unknown = Object.values(results).length - known;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length));
      setShow(false);
    },
    [deck.length],
  );

  const mark = useCallback(
    (knew: boolean) => {
      if (!current) return;
      setResults((r) => ({ ...r, [current.id]: knew }));
      go(1);
      // Ответ сохраняется в фоне — не ждём сервер, чтобы карточки листались мгновенно
      void recordAttempt(current.id, knew).then((res) => {
        if (!res.ok) toast.push(res.error, "err");
      });
    },
    [current, go, toast],
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
      if (show && event.key === "1") mark(true);
      if (show && event.key === "2") mark(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, show, mark, go]);

  const listItems = useMemo(() => pick(questions, filter), [questions, filter]);

  if (questions.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">Добавь вопросы во вкладке «Вопросы» — и здесь можно будет тренироваться.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={filter}
          options={filters}
          onChange={(f) => {
            setFilter(f);
            restart(f);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          {view === "cards" ? (
            <Button
              variant={random ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setRandom(!random);
                restart(filter, !random);
              }}
              title="Перемешать"
            >
              <Shuffle className="h-3.5 w-3.5" /> Перемешать
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
                <span className="flex-1 text-sm font-medium leading-snug">{q.text}</span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-line px-4 py-3 pl-12 text-sm leading-relaxed">
                <p className="whitespace-pre-wrap">{q.answer || <span className="text-muted">Ответа пока нет</span>}</p>
                {q.explanation ? <p className="mt-2 whitespace-pre-wrap text-muted">{q.explanation}</p> : null}
              </div>
            </details>
          ))}
        </div>
      ) : deck.length === 0 ? (
        <div className="card p-10 text-center">
          <Trophy className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 font-medium">По этому фильтру вопросов нет</p>
          <p className="mt-1 text-sm text-muted">Попробуй «Все», чтобы повторить пройденное.</p>
        </div>
      ) : done ? (
        <div className="card animate-pop-in p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-warning" />
          <h3 className="mt-3 text-lg font-semibold">Сессия завершена</h3>
          <p className="mt-1 text-sm text-muted">Пройдено карточек: {deck.length}</p>
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
            <div className="rounded-xl bg-success/10 p-3">
              <div className="text-2xl font-semibold tabular-nums text-success">{known}</div>
              <div className="text-xs text-muted">знал</div>
            </div>
            <div className="rounded-xl bg-danger/10 p-3">
              <div className="text-2xl font-semibold tabular-nums text-danger">{unknown}</div>
              <div className="text-xs text-muted">не знал</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {unknown > 0 ? (
              <Button onClick={() => restart(filter, random, deck.filter((q) => results[q.id] === false))}>
                <RotateCcw className="h-4 w-4" /> Повторить ошибки ({unknown})
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => restart()}>
              Начать заново
            </Button>
          </div>
        </div>
      ) : current ? (
        <>
          {/* Прогресс сессии */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full">
              {deck.length <= 60 ? (
                deck.map((q, i) => (
                  <span
                    key={q.id}
                    className={cn(
                      "h-full flex-1 transition-colors",
                      results[q.id] === true ? "bg-success" : results[q.id] === false ? "bg-danger" : i === index ? "bg-fg/40" : "bg-subtle",
                    )}
                  />
                ))
              ) : (
                <span className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(index / deck.length) * 100}%` }} />
              )}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {index + 1} / {deck.length}
            </span>
          </div>

          <div key={current.id} className="card animate-slide-up overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: color ?? "rgb(var(--accent))" }} />
              <span className="truncate">{current.ticket?.title ?? "Вопрос"}</span>
              <span className="ml-auto">{labelOf(DIFFICULTIES, current.difficulty)}</span>
            </div>

            <button
              className="block w-full px-5 py-8 text-left sm:px-8 sm:py-10"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Скрыть ответ" : "Показать ответ"}
            >
              <h2 className="text-lg font-semibold leading-relaxed sm:text-xl">{current.text}</h2>
              {current.attachments
                .filter((a) => a.mimeType.startsWith("image/"))
                .map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} loading="lazy" className="mt-5 max-h-64 rounded-xl border border-line object-contain" />
                ))}
            </button>

            {show ? (
              <div className="animate-slide-up border-t border-line bg-subtle/50 px-5 py-5 sm:px-8">
                <div className="label-xs mb-2 text-accent">Ответ</div>
                <div className="whitespace-pre-wrap leading-relaxed">{current.answer || <span className="text-muted">Ответа пока нет — его можно добавить на странице вопроса.</span>}</div>
                {current.explanation ? <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{current.explanation}</div> : null}
              </div>
            ) : null}

            <div className="flex items-center gap-2 border-t border-line p-3">
              <Button variant="ghost" size="icon" onClick={() => go(-1)} disabled={index === 0} aria-label="Назад">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-1 justify-center gap-2">
                {show ? (
                  <>
                    <Button variant="secondary" size="lg" className="flex-1 text-danger sm:flex-none sm:px-6" onClick={() => mark(false)}>
                      <X className="h-4 w-4" /> Не знал
                      <kbd className="ml-1 hidden text-[11px] text-muted sm:inline">2</kbd>
                    </Button>
                    <Button variant="secondary" size="lg" className="flex-1 text-success sm:flex-none sm:px-6" onClick={() => mark(true)}>
                      <Check className="h-4 w-4" /> Знал
                      <kbd className="ml-1 hidden text-[11px] text-muted sm:inline">1</kbd>
                    </Button>
                  </>
                ) : (
                  <Button size="lg" className="flex-1 sm:flex-none sm:px-8" onClick={() => setShow(true)}>
                    <Eye className="h-4 w-4" /> Показать ответ
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Пропустить">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 hidden text-center text-xs text-muted sm:block">Пробел — ответ · ← → — листать · 1 — знал · 2 — не знал</p>
        </>
      ) : null}
    </div>
  );
}
