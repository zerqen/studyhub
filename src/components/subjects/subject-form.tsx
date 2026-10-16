"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { EMOJIS, SUBJECT_COLORS, SUBJECT_TYPES } from "@/lib/constants";
import { createSubject, updateSubject } from "@/actions/subjects";
import { cn } from "@/lib/utils";
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
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${v.color}1a` }}>
          {v.emoji}
        </span>
        <Input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          required
          maxLength={120}
          placeholder="Например, Математический анализ"
          aria-label="Название"
          autoFocus
        />
      </div>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
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
        <Field label="Дата сдачи">
          <Input type="date" value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Преподаватель">
        <Input value={v.teacher} onChange={(e) => setV({ ...v, teacher: e.target.value })} placeholder="Необязательно" />
      </Field>
      <Field label="Описание">
        <Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Формат экзамена, требования, ссылки…" />
      </Field>
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-fg/80">Иконка</div>
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              className={cn("grid h-9 w-9 place-items-center rounded-lg text-lg transition-colors", v.emoji === e ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-subtle")}
              onClick={() => setV({ ...v, emoji: e })}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-fg/80">Цвет</div>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`Цвет ${c}`}
              className="grid h-7 w-7 place-items-center rounded-full text-white transition-transform active:scale-90"
              style={{ background: c }}
              onClick={() => setV({ ...v, color: c })}
            >
              {v.color === c ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" loading={busy} className="w-full">
        {id ? "Сохранить" : "Создать предмет"}
      </Button>
    </form>
  );
}
