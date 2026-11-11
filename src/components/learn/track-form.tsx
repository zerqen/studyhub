"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECT_COLORS } from "@/lib/constants";
import { createTrack, updateTrack } from "@/actions/learn";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";

const TRACK_EMOJIS = ["🧭", "∑", "⚡", "📡", "💻", "🧠", "🔬", "📐", "🛰️", "🎧", "📚", "🌍", "🎯", "🧩", "✈️"];

type Values = { name: string; emoji: string; color: string; description: string; linkedSubjectId: string };

export function TrackForm({
  id,
  initial,
  subjects,
  onDone,
}: {
  id?: string;
  initial?: Partial<Values>;
  /** Предметы вуза — направление можно связать с одним из них */
  subjects: { id: string; name: string; emoji: string }[];
  onDone?: () => void;
}) {
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    emoji: initial?.emoji ?? "🧭",
    color: initial?.color ?? SUBJECT_COLORS[1],
    description: initial?.description ?? "",
    linkedSubjectId: initial?.linkedSubjectId ?? "",
  });
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const payload = { ...v, linkedSubjectId: v.linkedSubjectId || null, description: v.description || null };
    const r = id ? await updateTrack(id, payload) : await createTrack(payload);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast.push(id ? "Сохранено" : "Направление создано");
    onDone?.();
    if (!id && r.data?.id) router.push(`/learn/${r.data.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${v.color}1f` }}>
          {v.emoji}
        </span>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={120} placeholder="Например, Матан глубже или Курс по Python" aria-label="Название направления" autoFocus className="h-12 text-base" />
      </div>
      <Field label="О чём" hint="Необязательно: что хочется разобрать, ссылка на курс">
        <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      {subjects.length ? (
        <Field label="Связать с предметом" hint="Темы будут видны на странице этого предмета">
          <Select value={v.linkedSubjectId} onChange={(e) => setV({ ...v, linkedSubjectId: e.target.value })}>
            <option value="">Не связывать</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-[#424655] dark:text-fg/80">Иконка</span>
        <div className="flex flex-wrap gap-1">
          {TRACK_EMOJIS.map((e) => (
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
      </div>
      {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}
      <Button type="submit" loading={busy} className="h-[46px] w-full rounded-[11px] text-[15px]">
        {id ? "Сохранить" : "Создать направление"}
      </Button>
    </form>
  );
}
