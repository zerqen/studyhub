"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { createTask, updateTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";
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
  const [more, setMore] = useState(Boolean(id && (initial?.startDate || initial?.tags || initial?.questionId)));
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }));
  const relevantQuestions = questions.filter((q) => !v.subjectId || q.subjectId === v.subjectId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...v,
      subjectId: v.subjectId || null,
      startDate: v.startDate || null,
      dueDate: v.dueDate || null,
      dueTime: v.dueTime || null,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
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
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Input value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus placeholder="Что нужно сделать?" aria-label="Название" className="h-10 text-[15px]" />
        {err ? <p className="mt-1 text-xs text-danger">{err}</p> : null}
      </div>
      <Textarea rows={2} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="Детали (необязательно)" aria-label="Описание" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Предмет">
          <Select value={v.subjectId} onChange={(e) => set({ subjectId: e.target.value, questionId: "" })}>
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Приоритет">
          <Select value={v.priority} onChange={(e) => set({ priority: e.target.value })}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Срок">
          <Input type="date" value={v.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        </Field>
        <Field label="Время">
          <Input type="time" value={v.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />
        </Field>
      </div>

      <button type="button" className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg" onClick={() => setMore((m) => !m)}>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !more && "-rotate-90")} /> Дополнительно
      </button>
      {more ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Статус">
              <Select value={v.status} onChange={(e) => set({ status: e.target.value })}>
                {TASK_STATUSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Начало">
              <Input type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
          </div>
          {relevantQuestions.length ? (
            <Field label="Связанный вопрос">
              <Select value={v.questionId} onChange={(e) => set({ questionId: e.target.value })}>
                <option value="">Без вопроса</option>
                {relevantQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text.length > 80 ? `${q.text.slice(0, 80)}…` : q.text}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Теги" hint="Через запятую">
            <Input value={v.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="сессия, деканат" />
          </Field>
        </div>
      ) : null}

      <Button type="submit" loading={busy} className="w-full">
        {id ? "Сохранить" : "Создать задачу"}
      </Button>
    </form>
  );
}
