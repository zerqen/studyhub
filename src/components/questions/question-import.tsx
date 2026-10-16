"use client";

import { useMemo, useState } from "react";
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
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const parsed = useMemo(() => {
    if (!value.trim()) return { count: 0, error: null };
    try {
      const v = JSON.parse(value);
      return Array.isArray(v) ? { count: v.length, error: null } : { count: 0, error: "Нужен JSON-массив [ … ]" };
    } catch {
      return { count: 0, error: "JSON пока невалиден" };
    }
  }, [value]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await importQuestions({ subjectId, questions: JSON.parse(value) });
      if (!result.ok) toast.push(result.error, "err");
      else {
        toast.push(`Добавлено вопросов: ${result.data?.count ?? 0}`);
        onDone?.();
      }
    } catch {
      toast.push("Проверь формат JSON-массива", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-sm text-muted">
        Поля: <code className="rounded bg-subtle px-1">text</code> (обязательно), <code className="rounded bg-subtle px-1">answer</code>,{" "}
        <code className="rounded bg-subtle px-1">explanation</code>, <code className="rounded bg-subtle px-1">difficulty</code> (EASY / MEDIUM / HARD),{" "}
        <code className="rounded bg-subtle px-1">tags</code>.
      </p>
      <textarea
        aria-label="JSON вопросов"
        className="min-h-72 w-full rounded-xl border border-line bg-subtle/50 p-3 font-mono text-xs leading-relaxed outline-none transition-[border-color,box-shadow] focus:border-accent/60 focus:ring-4 focus:ring-accent/10"
        value={value}
        placeholder={example}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
      />
      <div className={`flex items-center justify-between text-xs ${parsed.error ? "text-danger" : "text-muted"}`}>
        <span>{parsed.error ?? (parsed.count ? `Готово к импорту: ${parsed.count}` : "Вставь массив вопросов")}</span>
        <button type="button" className="font-medium text-accent hover:underline" onClick={() => setValue(example)}>
          Вставить пример
        </button>
      </div>
      <Button type="submit" className="w-full" loading={busy} disabled={!!parsed.error || parsed.count === 0}>
        Импортировать {parsed.count ? parsed.count : ""}
      </Button>
    </form>
  );
}
