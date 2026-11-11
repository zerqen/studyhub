"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { subjectShort } from "@/lib/home";
import { todayCount, type Deck } from "@/lib/review-view";
import { plural, untilText } from "@/lib/subject-view";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { NEW_PER_SESSION, StudyMode, type StudyQuestion } from "./study-mode";

type View = "cards" | "defs" | "list";
const VIEWS: [View, string][] = [
  ["cards", "Карточки"],
  ["defs", "Определения"],
  ["list", "Шпаргалка"],
];

function examLine(d: Deck) {
  if (!d.examDate) return "без даты сдачи";
  return `Экзамен ${formatDate(d.examDate, "d MMMM")} · ${untilText(daysUntil(d.examDate))}`;
}

/** «Повторение»: стартовый экран с колодами; сессия открывается здесь же */
export function ReviewHome({ decks, empty, questions }: { decks: Deck[]; empty: Deck[]; questions: StudyQuestion[] }) {
  const [view, setView] = useState<View>("cards");
  const [session, setSession] = useState<null | { subjectId: string | null; name: string }>(null);
  const router = useRouter();
  const today = todayCount(decks, NEW_PER_SESSION);
  const todayDecks = decks.filter((d) => d.due > 0);
  const subjectsLine = todayDecks.length
    ? todayDecks.length === 1
      ? `всё из «${todayDecks[0].name}»`
      : todayDecks
          .slice(0, 3)
          .map((d) => d.name)
          .join(", ") + (todayDecks.length > 3 ? ` и ещё ${todayDecks.length - 3}` : "")
    : null;

  function start(subjectId: string | null, name: string) {
    setSession({ subjectId, name });
    window.scrollTo({ top: 0 });
  }

  if (session) {
    const pool = session.subjectId ? questions.filter((q) => q.subject?.id === session.subjectId) : questions;
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-[18px]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="heading text-[26px]">Повторение</h1>
          <span className="text-[13px] text-muted">К повторению · {session.name}</span>
          <button
            type="button"
            onClick={() => {
              setSession(null);
              router.refresh();
            }}
            className="ml-auto inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] text-[#424655] transition-colors hover:bg-subtle dark:text-muted"
          >
            Завершить
          </button>
        </div>
        <StudyMode questions={pool} showSubject={!session.subjectId} color={decks.find((d) => d.id === session.subjectId)?.color} initialView={view} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="heading text-[28px] sm:text-[34px]">Повторение</h1>
        <p className="text-sm text-muted">Каждый вопрос возвращается тогда, когда начинает забываться</p>
      </div>

      <section aria-label="На сегодня" className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-fg px-6 py-5 text-bg sm:px-7">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] opacity-70">На сегодня</span>
          {today.total ? (
            <>
              <span className="heading text-[26px] sm:text-[30px]">
                {today.total} {plural(today.total, "карточка", "карточки", "карточек")}{" "}
                <span className="font-sans text-base font-normal opacity-70">≈ {today.minutes} мин</span>
              </span>
              <span className="text-[13px] opacity-75">
                {[subjectsLine, today.fresh ? `${today.fresh} ${plural(today.fresh, "новый вопрос", "новых вопроса", "новых вопросов")}` : null].filter(Boolean).join(" · ")}
              </span>
            </>
          ) : (
            <>
              <span className="heading text-[26px]">Всё повторено</span>
              <span className="text-[13px] opacity-75">Следующие вопросы вернутся по расписанию</span>
            </>
          )}
        </div>
        {today.total ? (
          <button
            type="button"
            onClick={() => start(null, "все предметы")}
            className="inline-flex h-[46px] items-center rounded-[11px] bg-surface px-6 text-[15px] font-bold text-fg transition-opacity hover:opacity-90"
          >
            Начать
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="heading text-[22px]">По предметам</h2>
        <div role="group" aria-label="Режим" className="flex gap-1 rounded-[10px] bg-[#E9E5DC] p-[3px] dark:bg-subtle">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors", view === id ? "bg-surface shadow-sm" : "text-fg/75 hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {decks.length || empty.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3.5">
          {decks.map((d) => (
            <section key={d.id} aria-label={d.name} className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-[18px]">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-sm font-bold" style={{ background: `${d.color}1f`, color: d.color }}>
                  {subjectShort(d.name)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <Link href={`/subjects/${d.id}`} className="truncate text-[15px] font-semibold hover:text-accent">
                    {d.name}
                  </Link>
                  <span className="truncate text-xs text-muted">{examLine(d)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                {(
                  [
                    [d.due, "к повторению", d.due > 0],
                    [d.fresh, "новых", false],
                    [d.learned, "выучено", false],
                  ] as const
                ).map(([n, label, hot]) => (
                  <span key={label} className="flex flex-col">
                    <b className={cn("heading text-[22px] font-bold tabular-nums", hot ? "text-accent" : "text-fg")}>{n}</b>
                    {label}
                  </span>
                ))}
              </div>
              <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle">
                <span className="bg-accent" style={{ width: `${(d.learned / d.total) * 100}%` }} />
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => start(d.id, d.name)}
                  disabled={!d.due && !d.fresh && view === "cards"}
                  className={cn(
                    "h-10 flex-1 rounded-[10px] px-3 text-sm font-semibold transition-colors disabled:opacity-50",
                    d.due ? "bg-accent text-white hover:bg-accent/90" : "border border-line bg-surface hover:bg-subtle",
                  )}
                >
                  {view === "list" ? "Открыть шпаргалку" : view === "defs" ? "Учить определения" : d.due ? `Повторить ${d.due}` : d.fresh ? "Учить новые" : "Всё повторено"}
                </button>
                <Link
                  href={`/subjects/${d.id}/ten`}
                  title="10 минут: самые слабые вопросы к экзамену"
                  className="inline-flex h-10 items-center rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-[#234AB0] transition-colors hover:bg-subtle dark:text-accent"
                >
                  10 мин
                </Link>
              </div>
            </section>
          ))}
          {empty.map((d) => (
            <section key={d.id} aria-label={`${d.name}: вопросов нет`} className="flex flex-col items-start gap-2 rounded-[14px] border border-dashed border-[#CFC9B8] bg-[#F8F6F1] p-[18px] dark:border-line dark:bg-subtle/40">
              <span className="text-[15px] font-semibold">{d.name} — вопросов пока нет</span>
              <span className="text-[13px] text-muted">
                {d.examDate ? `Экзамен ${formatDate(d.examDate, "d MMMM")}. ` : ""}Импортируй билеты или добавь вопросы вручную.
              </span>
              <Link href={`/subjects/${d.id}?tab=questions`} className="mt-1 inline-flex h-9 items-center rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold text-[#234AB0] hover:bg-subtle dark:text-accent">
                + Добавить билеты
              </Link>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-[14px] border border-line bg-surface p-8 text-center text-sm text-muted">Добавь вопросы к предметам — и здесь появятся колоды для повторения.</p>
      )}

      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-medium text-fg/80">Как это работает</summary>
        <div className="mt-2 flex max-w-3xl flex-col gap-1.5 leading-relaxed">
          <p>После ответа оцени, как вспомнил: «Не вспомнил», «С трудом», «Вспомнил» или «Легко». Под кнопкой видно, когда вопрос вернётся.</p>
          <p>Невспомненный вопрос повторится в этой же сессии и снова через 10 минут. Остальные — через 1, 3, 7, 16… дней: чем лучше помнишь, тем дальше интервал.</p>
          <p>Вопрос считается выученным, когда интервал дорос до недели. В колоду на день попадает всё, что пора повторить, и до {NEW_PER_SESSION} новых.</p>
        </div>
      </details>
    </div>
  );
}
