"use client";

import { useState } from "react";
import { importQuestions } from "@/actions/questions";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

const example = `[
  {
    "text": "Что такое производная?",
    "answer": "Предел отношения приращения функции к приращению аргумента.",
    "explanation": "Показывает скорость изменения функции.",
    "difficulty": "EASY",
    "tags": ["определения"]
  }
]`;

export function QuestionImport({ subjectId, onDone }: { subjectId: string; onDone?: () => void }) {
  const [value, setValue] = useState(example);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const questions = JSON.parse(value);
      const result = await importQuestions({ subjectId, questions });
      if (!result.ok) toast.push(result.error, "err");
      else {
        toast.push(`Добавлено вопросов: ${result.data?.count ?? 0}`);
        onDone?.();
      }
    } catch {
      toast.push("Проверьте формат JSON-массива", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-sm text-[var(--muted)]">Вставьте JSON-массив объектов с полями <code>text</code>, <code>answer</code>, <code>explanation</code>, <code>difficulty</code> и <code>tags</code>.</p>
      <textarea className="min-h-80 w-full rounded-xl border border-black/10 bg-white p-3 font-mono text-xs outline-none ring-info/40 focus:ring-2 dark:border-white/10 dark:bg-ink-900" value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} />
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Импорт…" : "Импортировать вопросы"}</Button>
    </form>
  );
}
