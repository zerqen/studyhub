"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTIES, QUESTION_STATUSES } from "@/lib/constants";
import { createQuestion, updateQuestion } from "@/actions/questions";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";

export function QuestionForm({
  id,
  subjectId,
  initial,
  onDone,
}: {
  id?: string;
  subjectId: string;
  initial?: Record<string, string | undefined>;
  onDone?: () => void;
}) {
  const [v, setV] = useState({
    text: initial?.text ?? "",
    answer: initial?.answer ?? "",
    explanation: initial?.explanation ?? "",
    status: initial?.status ?? "UNLEARNED",
    difficulty: initial?.difficulty ?? "MEDIUM",
    tags: initial?.tags ?? "",
  });
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...v,
      subjectId,
      tags: v.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const res = id ? await updateQuestion(id, payload) : await createQuestion(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Вопрос обновлён" : "Вопрос добавлен");
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Вопрос" error={err}>
        <Textarea rows={3} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} required />
      </Field>
      <Field label="Ответ">
        <Textarea rows={3} value={v.answer} onChange={(e) => setV({ ...v, answer: e.target.value })} />
      </Field>
      <Field label="Пояснение">
        <Textarea rows={2} value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Статус">
          <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {QUESTION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Сложность">
          <Select value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value })}>
            {DIFFICULTIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Теги">
        <Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Сохранение…" : "Сохранить вопрос"}
      </Button>
    </form>
  );
}
