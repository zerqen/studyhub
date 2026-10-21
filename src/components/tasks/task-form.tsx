"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { createTask, updateTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";
import { KIND_STAGES, TASK_KINDS, type TaskKind } from "@/lib/task-kinds";
import { KIND_ICONS } from "./kind-chip";

type Stage = { title: string; dueDate: string };

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
    kind: (initial?.kind ?? "TASK") as TaskKind,
  });
  const [stages, setStages] = useState<Stage[]>(() => (KIND_STAGES[(initial?.kind ?? "TASK") as TaskKind] ?? []).map((title) => ({ title, dueDate: "" })));
  const [stagesTouched, setStagesTouched] = useState(false);
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
      ...(!id && stages.some((st) => st.title.trim())
        ? { stages: stages.filter((st) => st.title.trim()).map((st) => ({ title: st.title.trim(), dueDate: st.dueDate || null })) }
        : {}),
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
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Тип">
        {TASK_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={v.kind === k.value}
            onClick={() => {
              set({ kind: k.value });
              // Шаблон этапов подставляем, пока пользователь сам их не трогал
              if (!id && !stagesTouched) setStages((KIND_STAGES[k.value] ?? []).map((title) => ({ title, dueDate: "" })));
            }}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
              v.kind === k.value ? "border-fg/20 bg-fg text-bg" : "border-line text-muted hover:text-fg",
            )}
          >
            {(() => {
              const Icon = KIND_ICONS[k.value];
              return Icon ? <Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /> : null;
            })()}
            {k.full}
          </button>
        ))}
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

      {!id ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Этапы</span>
            <span className="text-xs text-muted">даты — по желанию, можно поставить потом</span>
          </div>
          {stages.length ? (
            <ol className="space-y-1.5">
              {stages.map((st, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                  <Input
                    value={st.title}
                    onChange={(e) => {
                      setStagesTouched(true);
                      setStages((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)));
                    }}
                    className="h-8 flex-1 text-[13px]"
                    aria-label={`Этап ${i + 1}`}
                  />
                  <Input
                    type="date"
                    value={st.dueDate}
                    max={v.dueDate || undefined}
                    onChange={(e) => {
                      setStagesTouched(true);
                      setStages((list) => list.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)));
                    }}
                    className="h-8 w-[8.5rem] shrink-0 px-2 text-[13px]"
                    aria-label={`Дата этапа ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setStagesTouched(true);
                      setStages((list) => list.filter((_, j) => j !== i));
                    }}
                    className="grid h-8 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger"
                    aria-label="Убрать этап"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            onClick={() => {
              setStagesTouched(true);
              setStages((list) => [...list, { title: "", dueDate: "" }]);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Этап
          </button>
        </div>
      ) : null}

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
