"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMOJIS, SUBJECT_COLORS, SUBJECT_TYPES } from "@/lib/constants";
import { createSubject, updateSubject } from "@/actions/subjects";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";

type Values = {
  name: string;
  color: string;
  emoji: string;
  teacher: string;
  description: string;
  type: string;
  examDate: string;
};

export function SubjectForm({
  id,
  initial,
  onDone,
}: {
  id?: string;
  initial?: Partial<Values>;
  onDone?: () => void;
}) {
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    color: initial?.color ?? "#9c6246",
    emoji: initial?.emoji ?? "📘",
    teacher: initial?.teacher ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "EXAM",
    examDate: initial?.examDate ?? "",
  });
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const payload = {
      ...v,
      teacher: v.teacher || null,
      description: v.description || null,
      examDate: v.examDate || null,
    };
    const res = id ? await updateSubject(id, payload) : await createSubject(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Предмет обновлён" : "Предмет создан");
    onDone?.();
    if (!id && res.data?.id) router.push(`/subjects/${res.data.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Название" error={err}>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Тип">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {SUBJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Дата экзамена / зачёта">
          <Input type="date" value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Преподаватель">
        <Input value={v.teacher} onChange={(e) => setV({ ...v, teacher: e.target.value })} />
      </Field>
      <Field label="Описание">
        <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <Field label="Эмодзи">
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              className={`h-9 w-9 rounded-lg text-lg ${v.emoji === e ? "bg-black/10 dark:bg-white/10" : ""}`}
              onClick={() => setV({ ...v, emoji: e })}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Цвет">
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className="h-7 w-7 rounded-full ring-offset-2"
              style={{ background: c, outline: v.color === c ? `2px solid ${c}` : undefined }}
              onClick={() => setV({ ...v, color: c })}
            />
          ))}
        </div>
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Сохранение…" : id ? "Сохранить" : "Создать предмет"}
      </Button>
    </form>
  );
}
