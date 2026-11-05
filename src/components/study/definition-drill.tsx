"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { recordAttempt } from "@/actions/questions";
import { markKeyParts } from "@/actions/ai";
import { gradeFromRecall, hasMarkedParts, hiddenParts, levelFor, maskAnswer, parseKeyParts, partLabel, type DrillLevel } from "@/lib/definitions";
import { GRADES, previewLabel, schedule, type Grade, type SrsState } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { Markdown } from "../ui/markdown";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";
import { callWithWait, useAiEnabled } from "../ai/use-ai";
import { gradeStyle } from "./grade-style";
import type { StudyQuestion } from "./study-mode";

type LevelChoice = "auto" | "1" | "2" | "3";

const LEVELS: readonly (readonly [LevelChoice, string])[] = [
  ["auto", "Авто"],
  ["1", "Пропуски"],
  ["2", "Всё скрыто"],
  ["3", "С нуля"],
];

const LEVEL_HINT: Record<DrillLevel, string> = {
  1: "Вспомни, что скрыто в пропусках",
  2: "Вспомни все ключевые части",
  3: "Сформулируй ответ целиком: вслух или письменно",
};

const isTheory = (q: StudyQuestion) => q.kind !== "PROBLEM" && Boolean(q.answer?.trim());
const stateOf = (q: StudyQuestion, srs: Record<string, SrsState>): SrsState => srs[q.id] ?? { interval: q.srsInterval, ease: q.srsEase, reps: q.srsReps, lapses: q.srsLapses };

export function DefinitionDrill({ pool, all, color, showSubject }: { pool: StudyQuestion[]; all: StudyQuestion[]; color?: string; showSubject?: boolean }) {
  // Ответы, размеченные ИИ в этой сессии: страница обновится позже, а тренироваться можно сразу
  const [marked, setMarked] = useState<Record<string, string>>({});
  const answerOf = useCallback((q: StudyQuestion) => marked[q.id] ?? q.answer ?? "", [marked]);

  const build = useCallback((items: StudyQuestion[], answers: Record<string, string> = {}) => items.filter((q) => isTheory(q) && parseKeyParts(answers[q.id] ?? q.answer).length > 0), []);
  const [deck, setDeck] = useState<StudyQuestion[]>(() => build(pool));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"recall" | "check">("recall");
  const [choice, setChoice] = useState<LevelChoice>("auto");
  const [offset, setOffset] = useState(0);
  const [peeked, setPeeked] = useState<ReadonlySet<number>>(new Set());
  const [recalled, setRecalled] = useState<ReadonlySet<number>>(new Set());
  const [draft, setDraft] = useState("");
  const [srs, setSrs] = useState<Record<string, SrsState>>({});
  const [results, setResults] = useState<Record<string, Grade>>({});
  const [missed, setMissed] = useState<Record<string, string[]>>({});
  const [marking, setMarking] = useState<{ done: number; total: number; wait: number } | null>(null);
  const ai = useAiEnabled();
  const toast = useToast();
  const router = useRouter();

  const current = deck[index];
  const done = deck.length > 0 && index >= deck.length;
  const answer = current ? answerOf(current) : "";
  const parts = useMemo(() => parseKeyParts(answer), [answer]);
  const level: DrillLevel = choice === "auto" ? (current ? levelFor(stateOf(current, srs).reps) : 1) : (Number(choice) as DrillLevel);
  const hidden = useMemo(() => hiddenParts(parts.length, level, offset), [parts.length, level, offset]);
  const stillHidden = useMemo(() => new Set(hidden.filter((i) => !peeked.has(i))), [hidden, peeked]);
  const suggested = gradeFromRecall(hidden.filter((i) => recalled.has(i)).length, hidden.length, level);

  const unmarked = useMemo(() => all.filter((q) => isTheory(q) && !hasMarkedParts(answerOf(q))), [all, answerOf]);

  const resetCard = () => {
    setPhase("recall");
    setOffset(Math.floor(Math.random() * 2));
    setPeeked(new Set());
    setRecalled(new Set());
    setDraft("");
  };

  function restart(items: StudyQuestion[], answers = marked) {
    setDeck(build(items, answers));
    setIndex(0);
    setResults({});
    setMissed({});
    resetCard();
  }

  function grade(g: Grade) {
    if (!current) return;
    setSrs((s) => ({ ...s, [current.id]: schedule(stateOf(current, s), g) }));
    setResults((r) => ({ ...r, [current.id]: g }));
    const lost = hidden.filter((i) => !recalled.has(i)).map((i) => partLabel(parts[i]));
    setMissed((m) => ({ ...m, [current.id]: lost }));
    // «Забыл» — вернётся в конец этой же сессии, и уже на первом уровне
    if (g === 0 && !deck.slice(index + 1).some((q) => q.id === current.id)) setDeck((d) => [...d, current]);
    setIndex((i) => i + 1);
    resetCard();
    void recordAttempt(current.id, g).then((res) => {
      if (!res.ok) toast.push(res.error, "err");
    });
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const t = event.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t instanceof HTMLButtonElement) return;
      if (!current) return;
      if (phase === "recall" && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setPhase("check");
      }
      if (phase === "check" && ["1", "2", "3", "4"].includes(event.key)) grade((Number(event.key) - 1) as Grade);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function markAll() {
    const queue = unmarked;
    const answers = { ...marked };
    let failed = 0;
    setMarking({ done: 0, total: queue.length, wait: 0 });
    for (const [i, q] of queue.entries()) {
      try {
        const next = await callWithWait(() => markKeyParts(q.id), (wait) => setMarking({ done: i, total: queue.length, wait }));
        answers[q.id] = next;
        setMarked({ ...answers });
      } catch {
        failed++;
      }
      setMarking({ done: i + 1, total: queue.length, wait: 0 });
    }
    setMarking(null);
    if (failed) toast.push(`Не удалось разметить: ${failed}. Их можно выделить вручную в форме вопроса`, "err");
    else toast.push("Ключевые части выделены");
    router.refresh();
    if (!current || done) restart(pool, answers);
    else setDeck((d) => [...d, ...build(pool, answers).filter((q) => !d.some((x) => x.id === q.id))]);
  }

  const banner =
    unmarked.length > 0 ? (
      <div className="card mb-3 flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1 text-muted">
          {marking
            ? marking.wait
              ? `Лимит Groq: продолжу через ${marking.wait} с`
              : `Размечаю ответы: ${marking.done} из ${marking.total}`
            : `Без выделенных частей: ${unmarked.length}. ${ai ? "ИИ выделит их, не меняя текст, или это можно сделать вручную" : "Выдели их жирным в форме вопроса"}`}
        </span>
        {ai ? (
          <Button variant="secondary" size="sm" loading={Boolean(marking)} onClick={markAll}>
            {marking ? null : <Sparkles className="h-3.5 w-3.5" />} Выделить ИИ
          </Button>
        ) : null}
      </div>
    ) : null;

  if (deck.length === 0) {
    return (
      <>
        {banner}
        <div className="card p-10 text-center">
          <p className="font-medium">Здесь пока нечего тренировать</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Нужны теоретические вопросы с выделенными в ответе частями. Попробуй фильтр «Все» или выдели термины, условия и формулы, которые нельзя упустить.</p>
        </div>
      </>
    );
  }

  if (done) {
    const lost = deck.filter((q, i) => deck.findIndex((x) => x.id === q.id) === i && missed[q.id]?.length);
    return (
      <div className="card animate-pop-in p-6 sm:p-8">
        <div className="text-center">
          <Trophy className="mx-auto h-10 w-10 text-warning" />
          <h3 className="mt-3 text-lg font-semibold">Сессия завершена</h3>
          <p className="mt-1 text-sm text-muted">{lost.length ? "Вот что стоит подтянуть" : "Ни одной упущенной части"}</p>
        </div>
        {lost.length ? (
          <ul className="mt-5 divide-y divide-line">
            {lost.map((q) => (
              <li key={q.id} className="py-3 text-sm">
                <div className="font-medium">
                  <Markdown inline>{q.text}</Markdown>
                </div>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {missed[q.id].map((label, i) => (
                    <li key={i}>
                      <Markdown inline>{label}</Markdown>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {lost.length ? (
            <Button onClick={() => restart(lost)}>
              <RotateCcw className="h-4 w-4" /> Ещё раз упущенное ({lost.length})
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => restart(pool)}>
            Начать заново
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <>
      {banner}
      <Segmented value={choice} options={LEVELS} onChange={setChoice} className="mb-3 w-full [&>button]:flex-1 [&>button]:px-1" />
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
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: current.subject?.color ?? color ?? "rgb(var(--accent))" }} />
          <span className="truncate">{showSubject && current.subject ? `${current.subject.emoji} ${current.subject.name}` : current.lecture ? `Лекция ${current.lecture.number ?? ""} · ${current.lecture.title}` : "Определение"}</span>
          <span className="ml-auto shrink-0">Уровень {level}</span>
        </div>

        <div className="px-5 py-6 sm:px-8">
          <div className="text-lg font-semibold leading-relaxed">
            <Markdown>{current.text}</Markdown>
          </div>
          {current.attachments
            .filter((a) => a.mimeType.startsWith("image/"))
            .map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} loading="lazy" className="mt-4 max-h-64 rounded-xl border border-line object-contain" />
            ))}
          {phase === "recall" ? <p className="mt-2 text-sm text-muted">{LEVEL_HINT[level]}</p> : null}
        </div>

        {phase === "recall" ? (
          level === 3 ? (
            <div className="border-t border-line px-5 py-4 sm:px-8">
              <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Можно написать, а можно проговорить вслух. Записи никуда не сохраняются" aria-label="Твой ответ" />
            </div>
          ) : (
            <div className="border-t border-line bg-subtle/50 px-5 py-5 sm:px-8">
              <Markdown
                gap={(i) => (
                  <button
                    type="button"
                    onClick={() => setPeeked((p) => new Set(p).add(i))}
                    title="Подсмотреть: часть не засчитается"
                    aria-label="Подсмотреть скрытую часть"
                    className="mx-0.5 inline-flex h-6 min-w-14 items-center justify-center rounded-md border border-dashed border-accent/50 bg-accent/10 px-2 align-baseline text-xs text-accent transition-colors hover:bg-accent/20"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                )}
              >
                {maskAnswer(answer, stillHidden)}
              </Markdown>
            </div>
          )
        ) : (
          <div className="animate-slide-up border-t border-line bg-subtle/50 px-5 py-5 sm:px-8">
            {draft.trim() ? (
              <div className="mb-4">
                <div className="label-xs mb-1 text-muted">Твой ответ</div>
                <p className="whitespace-pre-wrap text-sm">{draft}</p>
              </div>
            ) : null}
            <div className="label-xs mb-2 text-accent">Эталон</div>
            <Markdown>{answer}</Markdown>
            {current.explanation ? (
              <div className="mt-3 text-sm text-muted">
                <Markdown>{current.explanation}</Markdown>
              </div>
            ) : null}
          </div>
        )}

        {phase === "check" ? (
          <div className="border-t border-line px-5 py-4 sm:px-8">
            <div className="label-xs mb-2 text-muted">Отметь, что вспомнил</div>
            <div className="space-y-1.5">
              {hidden.map((i) => {
                const on = recalled.has(i);
                const seen = peeked.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={seen}
                    onClick={() =>
                      setRecalled((r) => {
                        const next = new Set(r);
                        if (on) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className={cn("flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors", on ? "border-success/40 bg-success/10" : seen ? "border-line opacity-60" : "border-line hover:bg-subtle")}
                  >
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-success bg-success text-white" : "border-fg/25")}>{on ? <Check className="h-3 w-3" /> : null}</span>
                    <span className="min-w-0 flex-1 overflow-x-auto">
                      <Markdown inline>{partLabel(parts[i])}</Markdown>
                    </span>
                    {seen ? <span className="shrink-0 text-xs text-muted">подсмотрел</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="border-t border-line p-3">
          {phase === "check" ? (
            <div className="grid grid-cols-4 gap-1.5">
              {GRADES.map((g) => (
                <button key={g.grade} type="button" onClick={() => grade(g.grade)} className={cn("flex flex-col items-center rounded-xl border border-line px-1 py-2 transition-colors", gradeStyle[g.grade], suggested === g.grade && "ring-2 ring-accent/50")} title={suggested === g.grade ? "Оценка по отмеченным частям" : undefined}>
                  <span className="text-sm font-medium">{g.label}</span>
                  <span className="text-[11px] text-muted">
                    {previewLabel(stateOf(current, srs), g.grade)}
                    <kbd className="ml-1 hidden sm:inline">· {g.key}</kbd>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={() => setPhase("check")}>
              <Eye className="h-4 w-4" /> Проверить себя
            </Button>
          )}
        </div>
      </div>
      <p className="mt-3 hidden text-center text-xs text-muted sm:block">Пробел — проверить · 1–4 — оценка · Рамка на кнопке — оценка по отмеченным частям</p>
    </>
  );
}
