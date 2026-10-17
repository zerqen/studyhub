"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLecture, updateLecture } from "@/actions/lectures";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { useToast } from "../ui/toast";

export function LectureForm({
  id,
  subjectId,
  initial,
  onDone,
}: {
  id?: string;
  subjectId: string;
  initial?: { title?: string; number?: number | null; date?: string };
  onDone?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { subjectId, title, number: number ? Number(number) : null, date: date || null };
    const res = id ? await updateLecture(id, payload) : await createLecture(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(id ? "Лекция обновлена" : "Лекция добавлена");
    onDone?.();
    if (!id && res.data && "id" in res.data) router.push(`/lectures/${res.data.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Тема" error={err}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="Например, Пределы последовательностей" />
      </Field>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field label="Номер" hint={id ? undefined : "Пусто — следующий"}>
          <Input type="number" min={0} value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Field label="Дата">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" loading={busy} className="w-full">
        {id ? "Сохранить" : "Создать лекцию"}
      </Button>
    </form>
  );
}
