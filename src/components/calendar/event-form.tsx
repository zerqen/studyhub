"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { NotebookPen, Trash2 } from "lucide-react";
import { openLectureForEvent } from "@/actions/schedule";
import { createEvent, deleteEvent, updateEvent } from "@/actions/events";
import { EVENT_KINDS, RECURRENCE } from "@/lib/schedule";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/field";
import { useToast } from "../ui/toast";

export type EditableEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  kind: string;
  location: string | null;
  recurrence: string | null;
  repeatUntil: string | null;
  subjectId: string | null;
  description?: string | null;
  externalId?: string | null;
};

function local(date: string | null | undefined, pattern: string) {
  return date ? format(new Date(date), pattern) : "";
}

/** Создание и редактирование пары / события. Время вводится по местному времени браузера. */
export function EventForm({
  event,
  defaultDate,
  subjects,
  onDone,
  homework,
}: {
  /** Блок домашки для конкретной пары (из календаря) */
  homework?: React.ReactNode;
  event?: EditableEvent | null;
  defaultDate?: string;
  subjects: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const [v, setV] = useState({
    title: event?.title ?? "",
    kind: event?.kind ?? "LECTURE",
    subjectId: event?.subjectId ?? "",
    date: event ? local(event.startAt, "yyyy-MM-dd") : defaultDate ?? format(new Date(), "yyyy-MM-dd"),
    allDay: event?.allDay ?? false,
    start: event && !event.allDay ? local(event.startAt, "HH:mm") : "09:00",
    end: event?.endAt && !event.allDay ? local(event.endAt, "HH:mm") : "10:30",
    location: event?.location ?? "",
    recurrence: event?.recurrence ?? "",
    repeatUntil: local(event?.repeatUntil, "yyyy-MM-dd"),
  });
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [err, setErr] = useState<string>();
  const toast = useToast();
  const router = useRouter();
  const teacher = event?.description?.split("\n").slice(1).join(", ");
  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const startAt = v.allDay ? new Date(`${v.date}T00:00`) : new Date(`${v.date}T${v.start}`);
    const endAt = v.allDay || !v.end ? null : new Date(`${v.date}T${v.end}`);
    const subjectName = subjects.find((s) => s.id === v.subjectId)?.name;
    const kindLabel = EVENT_KINDS.find((k) => k.value === v.kind)?.label ?? "Событие";
    const payload = {
      title: v.title.trim() || (subjectName ? `${kindLabel}: ${subjectName}` : kindLabel),
      kind: v.kind,
      subjectId: v.subjectId || null,
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : null,
      allDay: v.allDay,
      location: v.location || null,
      recurrence: v.recurrence || null,
      repeatUntil: v.recurrence && v.repeatUntil ? new Date(`${v.repeatUntil}T23:59`).toISOString() : null,
    };
    const res = event ? await updateEvent(event.id, payload) : await createEvent(payload);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.push(event ? "Событие обновлено" : v.recurrence ? "Добавлено в расписание" : "Событие создано");
    onDone?.();
  }

  return (
    <div className="space-y-4">
      {homework}
      <form onSubmit={submit} className="space-y-4">
        {event && event.kind === "LECTURE" && event.subjectId ? (
          <button
            type="button"
            disabled={opening}
            onClick={async () => {
              setOpening(true);
              const r = await openLectureForEvent(event.subjectId!, event.startAt);
              setOpening(false);
              if (!r.ok) toast.push(r.error, "err");
              else if (r.data) {
                onDone?.();
                router.push(`/lectures/${r.data.id}`);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/10 disabled:opacity-60"
          >
            <NotebookPen className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-accent">Конспект этой лекции</span>
              <span className="block text-xs text-muted">Запись, фото тетради, вопросы — откроется страница лекции</span>
            </span>
          </button>
        ) : null}
        {teacher ? <p className="text-sm text-muted">Преподаватель: {teacher}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Тип">
            <Select value={v.kind} onChange={(e) => set({ kind: e.target.value })}>
              {EVENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Предмет">
            <Select value={v.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
              <option value="">—</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Название" hint="Можно оставить пустым — подставится тип и предмет" error={err}>
          <Input value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Например, Матанализ — лекция" />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Дата">
            <Input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} required />
          </Field>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={v.allDay} onChange={(e) => set({ allDay: e.target.checked })} /> Весь день
          </label>
        </div>
        {!v.allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Начало">
              <Input type="time" value={v.start} onChange={(e) => set({ start: e.target.value })} required />
            </Field>
            <Field label="Конец">
              <Input type="time" value={v.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
        ) : null}
        <Field label="Аудитория / место">
          <Input value={v.location} onChange={(e) => set({ location: e.target.value })} placeholder="ГУК Б-415" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Повтор">
            <Select value={v.recurrence} onChange={(e) => set({ recurrence: e.target.value })}>
              {RECURRENCE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          {v.recurrence ? (
            <Field label="До даты" hint="Пусто — без конца">
              <Input type="date" value={v.repeatUntil} onChange={(e) => set({ repeatUntil: e.target.value })} />
            </Field>
          ) : null}
        </div>
        <div className="flex gap-2">
          {event ? (
            <Button
              type="button"
              variant="danger-ghost"
              onClick={async () => {
                const r = await deleteEvent(event.id);
                if (!r.ok) toast.push(r.error, "err");
                else {
                  toast.push(event.recurrence ? "Удалено из расписания (все повторы)" : "Событие удалено");
                  onDone?.();
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          ) : null}
          <Button type="submit" loading={busy} className="flex-1">
            {event ? "Сохранить" : "Добавить"}
          </Button>
        </div>
        {event?.recurrence ? <p className="text-xs text-muted">Изменения применяются ко всем повторам этого события.</p> : null}
        {event?.externalId ? <p className="text-xs text-muted">Пара из загруженного расписания: при следующем обновлении расписания время и аудитория обновятся из него.</p> : null}
      </form>
    </div>
  );
}
