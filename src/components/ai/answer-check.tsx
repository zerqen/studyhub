"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { checkAnswer } from "@/actions/ai";
import type { AnswerFeedback } from "@/lib/ai-parse";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";
import { callWithWait } from "./use-ai";

const GRADE = [
  { label: "Не засчитано", tone: "text-danger bg-danger/10" },
  { label: "С трудом", tone: "text-warning bg-warning/10" },
  { label: "Хорошо", tone: "text-success bg-success/10" },
  { label: "Отлично", tone: "text-accent bg-accent/10" },
];

/** Результат проверки ответа — общий для карточек и экзамена */
export function FeedbackCard({ fb }: { fb: AnswerFeedback }) {
  const list = (title: string, items: string[], tone: string) =>
    items.length ? (
      <div>
        <div className={cn("label-xs mb-1", tone)}>{title}</div>
        <ul className="space-y-0.5 pl-4 text-sm [&>li]:list-disc">
          {items.map((x, i) => (
            <li key={i}>
              <Markdown inline>{x}</Markdown>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <div className="animate-slide-up space-y-2.5 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", GRADE[fb.grade].tone)}>{GRADE[fb.grade].label}</span>
        <span className="text-sm">
          <Markdown inline>{fb.verdict}</Markdown>
        </span>
      </div>
      {list("Верно", fb.good, "text-success")}
      {list("Упущено", fb.missing, "text-warning")}
      {list("Ошибки", fb.mistakes, "text-danger")}
      {fb.tip ? (
        <p className="text-sm text-muted">
          <Markdown inline>{fb.tip}</Markdown>
        </p>
      ) : null}
    </div>
  );
}

export function useAnswerCheck(questionId: string) {
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [fb, setFb] = useState<AnswerFeedback | null>(null);
  const toast = useToast();
  async function run(answer: string) {
    setBusy(true);
    try {
      const r = await callWithWait(() => checkAnswer(questionId, answer), setWait);
      if (r) setFb(r);
      return r ?? null;
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Проверка не удалась", "err");
      return null;
    } finally {
      setBusy(false);
      setWait(0);
    }
  }
  return { busy, wait, fb, setFb, run };
}

/** «Ответить своими словами»: поле ответа + проверка ИИ */
export function AnswerCheck({ questionId, onChecked, autoFocus }: { questionId: string; onChecked?: (fb: AnswerFeedback) => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const { busy, wait, fb, run } = useAnswerCheck(questionId);
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
            e.preventDefault();
            void run(text).then((r) => r && onChecked?.(r));
          }
        }}
        rows={4}
        autoFocus={autoFocus}
        placeholder="Ответь своими словами — как сказал бы на экзамене"
        className="block w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed outline-none focus:border-accent/60"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => void run(text).then((r) => r && onChecked?.(r))}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy ? (wait ? `Лимит, жду ${wait} с` : "Проверяю…") : "Проверить"}
        </Button>
        <span className="hidden text-xs text-muted sm:inline">Ctrl + Enter</span>
      </div>
      {fb ? <FeedbackCard fb={fb} /> : null}
    </div>
  );
}
