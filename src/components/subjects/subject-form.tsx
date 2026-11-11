"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECT_COLORS, SUBJECT_TYPES } from "@/lib/constants";
import { subjectShort } from "@/lib/home";
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

export function SubjectForm({ id, initial, onDone }: { id?: string; initial?: Partial<Values>; onDone?: () => void }) {
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    color: initial?.color ?? SUBJECT_COLORS[0],
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
    const payload = { ...v, teacher: v.teacher || null, description: v.description || null, examDate: v.examDate || null };
    const res = id ? await updateSubject(id, payload) : await createSubject(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Предмет обновлён" : "Предмет создан");
    onDone?.();
    if (!id && res.data?.id) router.push(`/subjects/${res.data.id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[15px] font-bold transition-colors"
          style={{ background: `${v.color}1f`, color: v.color }}
        >
          {v.name.trim() ? subjectShort(v.name) : "?"}
        </span>
        <Input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          required
          maxLength={120}
          placeholder="Например, Математический анализ"
          aria-label="Название предмета"
          autoFocus
          className="h-12 text-base"
        />
      </div>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        <Field label="Сдача">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {SUBJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Дата сдачи">
          <Input type="date" value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Преподаватель">
        <Input value={v.teacher} onChange={(e) => setV({ ...v, teacher: e.target.value })} placeholder="Необязательно" />
      </Field>
      <Field label="Описание">
        <Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Формат экзамена, требования, ссылки" />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-[#424655] dark:text-fg/80">Цвет</span>
        <div role="radiogroup" aria-label="Цвет" className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={v.color === c}
              aria-label={`Цвет ${c}`}
              className="h-8 w-8 rounded-full outline-offset-2 transition-transform active:scale-90"
              style={{ background: c, outline: v.color === c ? "2px solid rgb(var(--fg))" : "none" }}
              onClick={() => setV({ ...v, color: c })}
            />
          ))}
        </div>
        <span className="text-xs text-muted">Значок — первые буквы названия, как на странице предметов</span>
      </div>
      <Button type="submit" loading={busy} className="h-[46px] w-full rounded-[11px] text-[15px]">
        {id ? "Сохранить" : "Создать предмет"}
      </Button>
    </form>
  );
}
