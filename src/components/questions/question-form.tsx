"use client";

import { useState } from "react";
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

  async function submit(e: React.FormEvent, keepOpen = false) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...v, subjectId, tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    const res = id ? await updateQuestion(id, payload) : await createQuestion(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Вопрос обновлён" : "Вопрос добавлен");
    if (keepOpen) setV({ ...v, text: "", answer: "", explanation: "" });
    else onDone?.();
  }

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4">
      <Field label="Вопрос" error={err}>
        <Textarea rows={2} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} required autoFocus placeholder="Сформулируй, как в билете" />
      </Field>
      <Field label="Ответ">
        <Textarea rows={5} value={v.answer} onChange={(e) => setV({ ...v, answer: e.target.value })} placeholder="Можно заполнить позже" />
      </Field>
      <Field label="Пояснение">
        <Textarea rows={2} value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} placeholder="Подсказка, пример, источник" />
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
      <Field label="Теги" hint="Через запятую">
        <Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="определения, формулы" />
      </Field>
      <div className="flex gap-2">
        {!id ? (
          <Button type="button" variant="secondary" disabled={busy || !v.text.trim()} className="flex-1" onClick={(e) => submit(e, true)}>
            Сохранить и ещё
          </Button>
        ) : null}
        <Button type="submit" loading={busy} className="flex-1">
          {id ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </form>
  );
}
