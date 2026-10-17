"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, GraduationCap, MessageCircleQuestion, RotateCcw, Sparkles, Timer } from "lucide-react";
import { finishExam, gradeExamItem, saveExamNote, setExamPhase } from "@/actions/exams";
import { EXAM_GRADES, examScore, gradeLabel } from "@/lib/exam";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge, ProgressBar } from "../ui/badge";
import { Markdown } from "../ui/markdown";
import { Textarea } from "../ui/field";
import { useToast } from "../ui/toast";
import { FileUploader } from "../files/uploader";
import { gradeTone } from "./exam-setup";
import { FeedbackCard, useAnswerCheck } from "../ai/answer-check";
import { useAiEnabled } from "../ai/use-ai";
import type { AnswerFeedback } from "@/lib/ai-parse";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

type ExamItemData = {
  id: string;
  role: "THEORY" | "PROBLEM" | "EXTRA";
  related: boolean;
  grade: number | null;
  note: string | null;
  attachments: FileItem[];
  question: {
    id: string;
    text: string;
    answer: string | null;
    explanation: string | null;
    lecture: { number: number | null; title: string } | null;
    attachments: { id: string; originalName: string }[];
  };
};

type ExamData = {
  id: string;
  ticketNo: number | null;
  prepMinutes: number;
  phase: string;
  grade: number | null;
  score: number | null;
  startedAt: string;
  answerAt: string | null;
  finishedAt: string | null;
  subject: { id: string; name: string; emoji: string; color: string };
  items: ExamItemData[];
};

/** Секунд на один вопрос препода — ориентир, а не жёсткий лимит */
const EXTRA_SECONDS = 90;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Экран не гаснет, пока идёт экзамен (если браузер умеет) */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    let lock: Sentinel | null = null;
    const request = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const roleLabel = (item: ExamItemData, n: number) => (item.role === "PROBLEM" ? `Задача ${n}` : item.role === "THEORY" ? `Вопрос ${n}` : "Вопрос препода");

export function ExamRun({ exam }: { exam: ExamData }) {
  const [phase, setPhase] = useState(exam.phase);
  const [grades, setGrades] = useState<Record<string, number | null>>(() => Object.fromEntries(exam.items.map((i) => [i.id, i.grade])));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(exam.items.map((i) => [i.id, i.note ?? ""])));
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback | undefined>>({});
  const ai = useAiEnabled();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ grade: number; score: number } | null>(exam.grade !== null && exam.score !== null ? { grade: exam.grade, score: exam.score } : null);
  const toast = useToast();
  const router = useRouter();

  const ticket = useMemo(() => exam.items.filter((i) => i.role !== "EXTRA"), [exam.items]);
  const extras = useMemo(() => exam.items.filter((i) => i.role === "EXTRA"), [exam.items]);
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let t = 0;
    let p = 0;
    for (const i of ticket) map.set(i.id, i.role === "PROBLEM" ? ++p : ++t);
    return map;
  }, [ticket]);
  const [extraIndex, setExtraIndex] = useState(() => Math.max(0, extras.findIndex((i) => i.grade === null)));
  const [extraStartedAt, setExtraStartedAt] = useState(() => Date.now());

  const running = phase !== "DONE";
  const now = useNow(running);
  useWakeLock(running);

  // Подготовка
  const prepEnd = new Date(exam.startedAt).getTime() + exam.prepMinutes * 60_000;
  const prepLeft = (prepEnd - now) / 1000;
  const warned = useRef(prepLeft <= 0);
  useEffect(() => {
    if (phase !== "PREP" || warned.current || prepLeft > 0) return;
    warned.current = true;
    navigator.vibrate?.([200, 100, 200]);
    toast.push("Время подготовки вышло — пора отвечать", "err");
  }, [phase, prepLeft, toast]);

  // Черновики сохраняются сами через секунду после паузы в наборе
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveNote = useCallback((itemId: string, value: string, immediate = false) => {
    clearTimeout(timers.current[itemId]);
    const run = () => void saveExamNote(itemId, value);
    if (immediate) run();
    else timers.current[itemId] = setTimeout(run, 1200);
  }, []);

  async function goPhase(next: string) {
    setBusy(true);
    const r = await setExamPhase(exam.id, next);
    setBusy(false);
    if (!r.ok) {
      toast.push(r.error, "err");
      return;
    }
    setPhase(next);
    if (next === "EXTRA") setExtraStartedAt(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function grade(itemId: string, value: number) {
    setGrades((g) => ({ ...g, [itemId]: value }));
    void gradeExamItem(itemId, value).then((r) => {
      if (!r.ok) toast.push(r.error, "err");
    });
  }

  async function finish() {
    setBusy(true);
    const r = await finishExam(exam.id);
    setBusy(false);
    if (!r.ok) {
      toast.push(r.error, "err");
      return;
    }
    setResult(r.data ?? null);
    setPhase("DONE");
    window.scrollTo({ top: 0, behavior: "smooth" });
    router.refresh();
  }

  const ticketGraded = ticket.every((i) => grades[i.id] !== null && grades[i.id] !== undefined);
  const preview = examScore(exam.items.map((i) => ({ role: i.role, grade: grades[i.id] ?? null })));

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <Link href={`/subjects/${exam.subject.id}/exam`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {exam.subject.emoji} {exam.subject.name}
      </Link>

      {/* Шапка с этапами и таймером — всегда на виду */}
      <div className="sticky top-14 z-10 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-2xl sm:border sm:border-t-0 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{exam.ticketNo ? `Билет ${exam.ticketNo}` : "Случайный билет"}</div>
            <Steps phase={phase} hasExtra={extras.length > 0} hasPrep={exam.prepMinutes > 0} />
          </div>
          {phase === "PREP" ? (
            <div className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-lg font-semibold tabular-nums", prepLeft <= 0 ? "bg-danger/10 text-danger" : prepLeft < 300 ? "bg-warning/10 text-warning" : "bg-subtle")}>
              <Timer className="h-4 w-4" />
              {prepLeft > 0 ? clock(prepLeft) : "время!"}
            </div>
          ) : phase === "DONE" && result ? (
            <div className={cn("text-2xl font-bold tabular-nums", gradeTone(result.grade))}>{result.grade}</div>
          ) : null}
        </div>
      </div>

      {phase === "DONE" ? (
        <Result exam={exam} grades={grades} result={result} ticket={ticket} extras={extras} numbers={numbers} />
      ) : phase === "EXTRA" ? (
        <ExtraRound
          items={extras}
          index={extraIndex}
          startedAt={extraStartedAt}
          now={now}
          grades={grades}
          revealed={revealed}
          onReveal={(id) => setRevealed((s) => new Set(s).add(id))}
          onGrade={(id, g) => {
            grade(id, g);
            if (extraIndex < extras.length - 1) {
              setExtraIndex(extraIndex + 1);
              setExtraStartedAt(Date.now());
            }
          }}
          onBack={() => setExtraIndex(Math.max(0, extraIndex - 1))}
          onFinish={() => void finish()}
          busy={busy}
        />
      ) : (
        <div className="space-y-4">
          {phase === "PREP" ? (
            <p className="text-sm text-muted">
              Готовься как на экзамене: план ответа, формулы, решение задач на листке. Сфоткай решение — фото останется в истории попытки.
            </p>
          ) : (
            <p className="text-sm text-muted">Отвечай вслух или про себя, потом открой эталон и честно оцени каждый пункт.</p>
          )}
          {ticket.map((item, idx) => (
            <article key={item.id} className="card animate-slide-up overflow-hidden" style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs text-muted">
                <Badge tone={item.role === "PROBLEM" ? "accent" : "neutral"}>{roleLabel(item, numbers.get(item.id) ?? idx + 1)}</Badge>
                {item.question.lecture ? <span className="truncate">лекция {item.question.lecture.number ?? ""} · {item.question.lecture.title}</span> : null}
              </div>
              <div className="px-5 py-5">
                <div className="text-[17px] font-semibold leading-relaxed">
                  <Markdown>{item.question.text}</Markdown>
                </div>
                {item.question.attachments.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} loading="lazy" className="mt-4 max-h-64 rounded-xl border border-line object-contain" />
                ))}

                <Textarea
                  rows={phase === "PREP" ? 4 : 2}
                  className="mt-4"
                  placeholder={item.role === "PROBLEM" ? "Ход решения, ответ…" : "План ответа: определения, формулы, примеры…"}
                  value={notes[item.id] ?? ""}
                  onChange={(e) => {
                    setNotes((n) => ({ ...n, [item.id]: e.target.value }));
                    saveNote(item.id, e.target.value);
                  }}
                  onBlur={(e) => saveNote(item.id, e.target.value, true)}
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FileUploader parent={{ examItemId: item.id }} compact camera accept="image/*,application/pdf" label="Фото решения" />
                </div>
                {item.attachments.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.attachments.map((a) =>
                      a.mimeType.startsWith("image/") ? (
                        <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/files/${a.id}`} alt={a.originalName} className="h-24 w-24 rounded-xl border border-line object-cover transition-transform hover:scale-[1.03]" />
                        </a>
                      ) : (
                        <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="rounded-xl border border-line px-3 py-2 text-xs hover:bg-subtle">
                          {a.originalName}
                        </a>
                      ),
                    )}
                  </div>
                ) : null}
              </div>

              {phase === "ANSWER" ? (
                <>
                  {revealed.has(item.id) ? (
                    <div className="animate-slide-up border-t border-line bg-subtle/50 px-5 py-4">
                      <div className="label-xs mb-2 text-accent">{item.role === "PROBLEM" ? "Решение" : "Эталонный ответ"}</div>
                      {item.question.answer ? <Markdown>{item.question.answer}</Markdown> : <span className="text-sm text-muted">Ответа нет — оцени по ощущениям и допиши ответ на странице вопроса.</span>}
                      {item.question.explanation ? (
                        <div className="mt-2 text-sm text-muted">
                          <Markdown>{item.question.explanation}</Markdown>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2 border-t border-line p-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRevealed((s) => {
                            const n = new Set(s);
                            if (n.has(item.id)) n.delete(item.id);
                            else n.add(item.id);
                            return n;
                          })
                        }
                      >
                        {revealed.has(item.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {revealed.has(item.id) ? "Скрыть эталон" : "Показать эталон"}
                      </Button>
                      {ai ? (
                        <ExamAiCheck
                          questionId={item.question.id}
                          note={notes[item.id] ?? ""}
                          onChecked={(fb) => {
                            setFeedback((f) => ({ ...f, [item.id]: fb }));
                            setSuggested((s) => ({ ...s, [item.id]: fb.grade }));
                            setRevealed((s) => new Set(s).add(item.id));
                          }}
                        />
                      ) : null}
                    </div>
                    {feedback[item.id] ? <FeedbackCard fb={feedback[item.id]!} /> : null}
                    <GradeButtons value={grades[item.id] ?? null} suggested={suggested[item.id] ?? null} onChange={(g) => grade(item.id, g)} />
                  </div>
                </>
              ) : null}
            </article>
          ))}

          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-bg/90 p-3 backdrop-blur lg:bottom-0 lg:left-60">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              {phase === "PREP" ? (
                <Button size="lg" className="flex-1" loading={busy} onClick={() => void goPhase("ANSWER")}>
                  Готов отвечать <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <span className="hidden text-sm text-muted sm:block">
                    {ticketGraded ? `Пока выходит: ${preview.grade}` : `Оценено ${ticket.filter((i) => grades[i.id] !== null && grades[i.id] !== undefined).length} из ${ticket.length}`}
                  </span>
                  <Button size="lg" className="flex-1" loading={busy} disabled={!ticketGraded} onClick={() => void (extras.length ? goPhase("EXTRA") : finish())}>
                    {extras.length ? (
                      <>
                        Вопросы препода <MessageCircleQuestion className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Завершить <CheckCircle2 className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ phase, hasExtra, hasPrep }: { phase: string; hasExtra: boolean; hasPrep: boolean }) {
  const steps = [hasPrep && ["PREP", "Подготовка"], ["ANSWER", "Ответ"], hasExtra && ["EXTRA", "Вопросы препода"], ["DONE", "Итог"]].filter(Boolean) as [string, string][];
  const current = steps.findIndex(([id]) => id === phase);
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
      {steps.map(([id, label], i) => (
        <span key={id} className={cn("flex items-center gap-1", i === current ? "font-medium text-accent" : i < current ? "text-fg/70" : "text-muted/70")}>
          {i > 0 ? <span className="text-muted/50">›</span> : null}
          {label}
        </span>
      ))}
    </div>
  );
}

const gradeStyle = ["border-danger/40 bg-danger/10 text-danger", "border-warning/40 bg-warning/10 text-warning", "border-success/40 bg-success/10 text-success", "border-accent/40 bg-accent/10 text-accent"];

function GradeButtons({ value, suggested, onChange }: { value: number | null; suggested?: number | null; onChange: (g: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {EXAM_GRADES.map((g) => (
        <button
          key={g.grade}
          type="button"
          onClick={() => onChange(g.grade)}
          className={cn(
            "rounded-xl border px-1 py-2 text-[13px] font-medium transition-all active:scale-[0.97]",
            value === g.grade ? gradeStyle[g.grade] : "border-line text-muted hover:bg-subtle hover:text-fg",
            suggested === g.grade && value !== g.grade && "ring-2 ring-accent/50",
          )}
          title={suggested === g.grade ? "Так оценил ИИ" : undefined}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

function ExtraRound({
  items,
  index,
  startedAt,
  now,
  grades,
  revealed,
  onReveal,
  onGrade,
  onBack,
  onFinish,
  busy,
}: {
  items: ExamItemData[];
  index: number;
  startedAt: number;
  now: number;
  grades: Record<string, number | null>;
  revealed: Set<string>;
  onReveal: (id: string) => void;
  onGrade: (id: string, g: number) => void;
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
}) {
  const item = items[index];
  const left = EXTRA_SECONDS - (now - startedAt) / 1000;
  const allGraded = items.every((i) => grades[i.id] !== null && grades[i.id] !== undefined);
  if (!item) return null;
  const shown = revealed.has(item.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((index + (grades[item.id] != null ? 1 : 0)) / items.length) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted">
          {index + 1} / {items.length}
        </span>
      </div>
      <article key={item.id} className="card animate-pop-in overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs text-muted">
          <MessageCircleQuestion className="h-3.5 w-3.5" />
          <span>{item.related ? "По теме билета" : "По всему курсу"}</span>
          <span className={cn("ml-auto font-mono tabular-nums", left <= 0 ? "text-danger" : left < 20 ? "text-warning" : "")}>{left > 0 ? clock(left) : "отвечай!"}</span>
        </div>
        <div className="px-5 py-8 sm:px-8">
          <div className="text-lg font-semibold leading-relaxed sm:text-xl">
            <Markdown>{item.question.text}</Markdown>
          </div>
        </div>
        {shown ? (
          <div className="animate-slide-up border-t border-line bg-subtle/50 px-5 py-4 sm:px-8">
            <div className="label-xs mb-2 text-accent">Ответ</div>
            {item.question.answer ? <Markdown>{item.question.answer}</Markdown> : <span className="text-sm text-muted">Ответа пока нет.</span>}
          </div>
        ) : null}
        <div className="border-t border-line p-3">
          {shown ? (
            <GradeButtons value={grades[item.id] ?? null} onChange={(g) => onGrade(item.id, g)} />
          ) : (
            <Button size="lg" className="w-full" onClick={() => onReveal(item.id)}>
              <Eye className="h-4 w-4" /> Ответил — показать эталон
            </Button>
          )}
        </div>
      </article>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" /> Назад
        </Button>
        <Button className="ml-auto" size="lg" loading={busy} disabled={!allGraded} onClick={onFinish}>
          Получить оценку <GraduationCap className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted">Препод даёт на ответ пару минут — таймер просто напоминает о темпе.</p>
    </div>
  );
}

function Result({
  exam,
  grades,
  result,
  ticket,
  extras,
  numbers,
}: {
  exam: ExamData;
  grades: Record<string, number | null>;
  result: { grade: number; score: number } | null;
  ticket: ExamItemData[];
  extras: ExamItemData[];
  numbers: Map<string, number>;
}) {
  const s = examScore(exam.items.map((i) => ({ role: i.role, grade: grades[i.id] ?? null })));
  const grade = result?.grade ?? s.grade;
  const weak = exam.items.filter((i) => (grades[i.id] ?? 0) <= 1);
  const spent = exam.finishedAt ? Math.round((new Date(exam.finishedAt).getTime() - new Date(exam.startedAt).getTime()) / 60_000) : null;
  const parts = [
    ["Теория", s.theory],
    ["Задачи", s.problems],
    ["Вопросы препода", s.extra],
  ].filter(([, v]) => v !== null) as [string, number][];

  return (
    <div className="space-y-5">
      <div className="card animate-pop-in p-6 text-center">
        <div className={cn("text-6xl font-bold tabular-nums tracking-tight", gradeTone(grade))}>{grade}</div>
        <div className="mt-1 text-lg font-medium">{gradeLabel(grade)}</div>
        <p className="mt-1 text-sm text-muted">
          {Math.round((result?.score ?? s.score) * 100)}% по самооценке{spent !== null ? ` · ${spent} мин` : ""}
        </p>
        <div className="mx-auto mt-5 max-w-sm space-y-3 text-left">
          {parts.map(([label, v]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-medium tabular-nums">{Math.round(v * 100)}%</span>
              </div>
              <ProgressBar value={v * 100} color={exam.subject.color} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/subjects/${exam.subject.id}/exam`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent/90">
            <RotateCcw className="h-4 w-4" /> Ещё билет
          </Link>
          <Link href="/review" className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-subtle">
            Повторить слабое
          </Link>
        </div>
      </div>

      {weak.length ? (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          {weak.length} {plural(weak.length, "вопрос", "вопроса", "вопросов")} с оценкой «не смог» или «с трудом» уже добавлены в «Повторение».
        </p>
      ) : null}

      <ul className="card divide-y divide-line overflow-hidden">
        {[...ticket, ...extras].map((item) => {
          const g = grades[item.id];
          return (
            <li key={item.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 [&::-webkit-details-marker]:hidden">
                  <span className={cn("mt-0.5 w-20 shrink-0 text-xs font-medium", item.role === "PROBLEM" ? "text-accent" : "text-muted")}>
                    {item.role === "EXTRA" ? "Доп. вопрос" : roleLabel(item, numbers.get(item.id) ?? 1)}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 text-sm">
                    <Markdown inline>{item.question.text}</Markdown>
                  </span>
                  <span className={cn("shrink-0 text-xs font-medium", g === null || g === undefined ? "text-muted" : gradeStyle[g].split(" ").pop())}>
                    {g === null || g === undefined ? "—" : EXAM_GRADES[g].label}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-line px-4 py-3 text-sm sm:pl-[7.75rem]">
                  {item.note ? (
                    <div>
                      <div className="label-xs mb-1">Черновик</div>
                      <p className="whitespace-pre-wrap text-muted">{item.note}</p>
                    </div>
                  ) : null}
                  {item.attachments.length ? (
                    <div className="flex flex-wrap gap-2">
                      {item.attachments
                        .filter((a) => a.mimeType.startsWith("image/"))
                        .map((a) => (
                          <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/files/${a.id}`} alt={a.originalName} className="h-20 w-20 rounded-lg border border-line object-cover" />
                          </a>
                        ))}
                    </div>
                  ) : null}
                  {item.question.answer ? <Markdown>{item.question.answer}</Markdown> : null}
                  <Link href={`/questions/${item.question.id}`} className="inline-block text-xs font-medium text-accent hover:underline">
                    Открыть вопрос →
                  </Link>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Проверка черновика ответа ИИ по эталону */
function ExamAiCheck({ questionId, note, onChecked }: { questionId: string; note: string; onChecked: (fb: AnswerFeedback) => void }) {
  const { busy, wait, run } = useAnswerCheck(questionId);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy || note.trim().length < 3}
      title={note.trim() ? "ИИ сравнит черновик с эталоном" : "Сначала напиши ответ в черновике"}
      onClick={() => void run(note).then((fb) => fb && onChecked(fb))}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {busy ? (wait ? `Лимит, жду ${wait} с` : "Проверяю…") : "Проверить черновик"}
    </Button>
  );
}
