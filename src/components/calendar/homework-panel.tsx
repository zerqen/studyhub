"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Plus } from "lucide-react";
import { createHomework, previewHomework } from "@/actions/homework";
import { toggleTaskDone } from "@/actions/tasks";
import { kindMeta } from "@/lib/schedule";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Field, Input, Textarea } from "../ui/field";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";

export type HomeworkTask = { id: string; title: string; status: string; dueDate: string | null; dueTime?: string | null };

type Lesson = { start: string; kind: string; label: string; location: string | null } | null;

function lessonText(l: Lesson) {
  if (!l) return "пар больше нет";
  return `${formatDate(l.start, "EEEEEE d MMM, HH:mm")} · ${l.label.toLowerCase()}`;
}

/** Домашка на паре: что сдать сегодня и что задали. «Задали ДЗ» — срок сам ставится на следующую пару. */
export function HomeworkPanel({
  subjectId,
  lessonStart,
  lessonKind,
  due,
  assigned,
  defaultOpen,
}: {
  subjectId: string;
  lessonStart: string;
  lessonKind: string;
  /** Домашка, которую сдавать на этой паре */
  due: HomeworkTask[];
  /** Домашка, которую задали на этой паре */
  assigned: HomeworkTask[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [preview, setPreview] = useState<{ next: Lesson; same: Lesson } | null>(null);
  const [v, setV] = useState({ title: "", description: "", due: "next" as "next" | "same" | "date", date: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const sameLabel = kindMeta(lessonKind).label.toLowerCase();

  useEffect(() => {
    if (!open || preview) return;
    let alive = true;
    void previewHomework(subjectId, lessonStart, lessonKind).then((r) => {
      if (alive && r.ok && r.data) setPreview(r.data);
    });
    return () => {
      alive = false;
    };
  }, [open, preview, subjectId, lessonStart, lessonKind]);

  // Если следующая пара и так того же типа — второй вариант не нужен
  const sameDiffers = preview?.same && preview.next && preview.same.start !== preview.next.start;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await createHomework({
      subjectId,
      lessonAt: lessonStart,
      lessonKind,
      title: v.title,
      description: v.description || null,
      due: v.due,
      dueDate: v.due === "date" ? v.date : null,
    });
    setBusy(false);
    if (!r.ok) {
      toast.push(r.error, "err");
      return;
    }
    toast.push(r.data?.dueAt ? `Домашка записана · сдать ${formatDate(r.data.dueAt, "EEEEEE d MMM")}` : "Домашка записана, без срока");
    setV({ title: "", description: "", due: v.due, date: "" });
    setOpen(false);
  }

  const isDone = (t: HomeworkTask) => done[t.id] ?? t.status === "DONE";

  const list = (title: string, items: HomeworkTask[], tone?: string) =>
    items.length ? (
      <div>
        <div className={cn("label-xs mb-1", tone)}>{title}</div>
        <ul className="space-y-0.5">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                checked={isDone(t)}
                aria-label="Сделано"
                onChange={async () => {
                  setDone((d) => ({ ...d, [t.id]: !isDone(t) }));
                  const res = await toggleTaskDone(t.id);
                  if (!res.ok) toast.push(res.error, "err");
                }}
              />
              <Link href={`/tasks/${t.id}`} className={cn("min-w-0 flex-1 truncate text-sm hover:underline", isDone(t) && "text-muted line-through")}>
                {t.title}
              </Link>
              {t.dueDate && title !== "Сдать сегодня" ? <span className="shrink-0 text-xs text-muted">{formatDate(t.dueDate, "d MMM")}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <BookMarked className="h-4 w-4 text-accent" />
        <span className="flex-1 text-sm font-medium">Домашка</span>
        {!open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Задали ДЗ
          </Button>
        ) : null}
      </div>
      {list("Сдать сегодня", due, "text-warning")}
      {list("Задали на этой паре", assigned)}
      {!open && !due.length && !assigned.length ? <p className="text-xs text-muted">Нажми «Задали ДЗ» прямо на паре — срок сам встанет на следующее занятие.</p> : null}

      {open ? (
        <form onSubmit={save} className="animate-slide-up space-y-3">
          <Field label="Что задали">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="№ 245–250, выучить теорему Ролля" autoFocus required />
          </Field>
          <Field label="Подробности" hint="Необязательно">
            <Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Страницы, варианты, формат сдачи" />
          </Field>
          <div className="space-y-2">
            <div className="text-sm font-medium">Срок</div>
            <Segmented
              value={v.due}
              onChange={(due) => setV({ ...v, due })}
              options={[["next", "Следующая пара"], ...(sameDiffers ? ([["same", `След. ${sameLabel}`]] as const) : []), ["date", "Своя дата"]] as const}
              className="flex w-full flex-wrap [&>button]:flex-1"
            />
            {v.due === "date" ? (
              <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} required />
            ) : (
              <p className="text-xs text-muted">{preview ? lessonText(v.due === "same" ? preview.same : preview.next) : "ищу следующую пару…"}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" loading={busy} disabled={!v.title.trim()}>
              Записать
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
