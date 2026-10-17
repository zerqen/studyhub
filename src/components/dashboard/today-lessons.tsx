"use client";

import { useMemo, useState } from "react";
import { BookMarked, MapPin } from "lucide-react";
import { kindMeta } from "@/lib/schedule";
import { isAssignedAt, isDueAt } from "@/lib/homework";
import { Modal } from "../ui/modal";
import { HomeworkPanel, type HomeworkTask } from "../calendar/homework-panel";

export type TodayLesson = {
  key: string;
  title: string;
  kind: string;
  start: string;
  allDay: boolean;
  location: string | null;
  color: string;
  subjectId: string | null;
};

type Homework = HomeworkTask & { subjectId: string | null; lessonAt: string | null };

const time = (iso: string) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(iso));

/** Пары на сегодня. Тап по паре — домашка: что сдать и «Задали ДЗ». */
export function TodayLessons({ lessons, homework }: { lessons: TodayLesson[]; homework: Homework[] }) {
  const [open, setOpen] = useState<TodayLesson | null>(null);
  const withHw = useMemo(
    () =>
      lessons.map((l) => {
        const lesson = { subjectId: l.subjectId, start: new Date(l.start) };
        return {
          ...l,
          due: homework.filter((t) => isDueAt(t, lesson)),
          assigned: homework.filter((t) => isAssignedAt(t, lesson)),
        };
      }),
    [lessons, homework],
  );
  const current = open ? withHw.find((l) => l.key === open.key) : null;
  const canHomework = (l: TodayLesson) => Boolean(l.subjectId) && !["EXAM", "CONSULT"].includes(l.kind);

  return (
    <>
      <ul>
        {withHw.map((e) => {
          const meta = kindMeta(e.kind);
          const pending = e.due.filter((t) => t.status !== "DONE").length;
          return (
            <li key={e.key}>
              <button
                type="button"
                disabled={!canHomework(e)}
                onClick={() => setOpen(e)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors enabled:hover:bg-subtle"
              >
                <span className="mt-0.5 w-11 shrink-0 text-xs font-medium tabular-nums text-muted">{e.allDay ? "весь день" : time(e.start)}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {meta.label}
                    {e.location ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </span>
                    ) : null}
                    {e.assigned.length ? <span className="text-accent">задали ДЗ</span> : null}
                  </span>
                </span>
                {pending ? (
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                    <BookMarked className="h-3 w-3" /> сдать ДЗ
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Modal open={!!current} onClose={() => setOpen(null)} title={current?.title ?? ""} description={current ? `${kindMeta(current.kind).label} · ${time(current.start)}` : undefined} className="sm:max-w-md">
        {current?.subjectId ? (
          <HomeworkPanel
            key={current.key}
            subjectId={current.subjectId}
            lessonStart={current.start}
            lessonKind={current.kind}
            due={current.due}
            assigned={current.assigned}
            defaultOpen={!current.due.length && !current.assigned.length}
          />
        ) : null}
      </Modal>
    </>
  );
}
