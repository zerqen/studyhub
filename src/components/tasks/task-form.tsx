"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { createTask, updateTask } from "@/actions/tasks";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";

export function TaskForm({
  id,
  subjects,
  initial,
  onDone,
  questions = [],
}: {
  id?: string;
  subjects: { id: string; name: string }[];
  questions?: { id: string; text: string; subjectId: string }[];
  initial?: Record<string, string | undefined>;
  onDone?: () => void;
}) {
  const [v, setV] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    subjectId: initial?.subjectId ?? "",
    startDate: initial?.startDate ?? "",
    dueDate: initial?.dueDate ?? "",
    dueTime: initial?.dueTime ?? "",
    priority: initial?.priority ?? "MEDIUM",
    status: initial?.status ?? "PLANNED",
    tags: initial?.tags ?? "",
    questionId: initial?.questionId ?? "",
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
      subjectId: v.subjectId || null,
      startDate: v.startDate || null,
      dueDate: v.dueDate || null,
      dueTime: v.dueTime || null,
      tags: v.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      questionId: v.questionId || null,
    };
    const res = id ? await updateTask(id, payload) : await createTask(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Задача обновлена" : "Задача создана");
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Название" error={err}>
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required />
      </Field>
      <Field label="Связанный вопрос (необязательно)">
        <Select value={v.questionId} onChange={(e) => setV({ ...v, questionId: e.target.value })}>
          <option value="">Без вопроса</option>
          {questions
            .filter((question) => !v.subjectId || question.subjectId === v.subjectId)
            .map((question) => (
              <option key={question.id} value={question.id}>
                {question.text.length > 90 ? `${question.text.slice(0, 90)}…` : question.text}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Описание">
        <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <Field label="Предмет (необязательно)">
        <Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })}>
          <option value="">Без предмета</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
        </Field>
        <Field label="Дедлайн">
          <Input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Время">
          <Input type="time" value={v.dueTime} onChange={(e) => setV({ ...v, dueTime: e.target.value })} />
        </Field>
        <Field label="Приоритет">
          <Select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {TASK_STATUSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Теги через запятую">
        <Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="сессия, деканат" />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Сохранение…" : id ? "Сохранить" : "Создать задачу"}
      </Button>
    </form>
  );
}
