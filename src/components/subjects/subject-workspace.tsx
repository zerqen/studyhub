"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveSubject, deleteSubject } from "@/actions/subjects";
import { SUBJECT_TYPES, labelOf } from "@/lib/constants";
import { daysUntil } from "@/lib/utils";
import { Button } from "../ui/button";
import { Modal, ConfirmDialog } from "../ui/modal";
import { SubjectForm } from "./subject-form";
import { QuestionForm } from "../questions/question-form";
import { QuestionImport } from "../questions/question-import";
import { TaskForm } from "../tasks/task-form";
import { NoteEditor } from "../notes/note-editor";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { StudyMode } from "../study/study-mode";
import { ProgressBar } from "../ui/badge";
import { EmptyState } from "../ui/empty";
import Link from "next/link";

const tabs = [
  ["questions", "Вопросы"],
  ["tasks", "Задачи"],
  ["notes", "Заметки"],
  ["files", "Файлы"],
  ["info", "Информация"],
  ["progress", "Прогресс"],
  ["study", "Подготовка"],
] as const;

export function SubjectWorkspace({
  subject,
  tab,
  progress,
  qProgress,
  taskProgress,
}: {
  tab: string;
  progress: number;
  qProgress: number;
  taskProgress: number;
  subject: any;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const router = useRouter();
  const d = daysUntil(subject.examDate || null);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[var(--accent)]/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent)]/10 text-4xl">{subject.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent)]">{labelOf(SUBJECT_TYPES, subject.type)}</span>
            {subject.teacher ? <span className="text-xs text-[var(--muted)]">{subject.teacher}</span> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{subject.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {d !== null ? ` · ${d < 0 ? "дата прошла" : d === 0 ? "сегодня" : `осталось ${d} дн.`}` : ""}
          </p>
          <div className="mt-3 max-w-md">
            <ProgressBar value={progress} color={subject.color} />
            <div className="mt-1 text-xs text-[var(--muted)]">Готовность {progress}%</div>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setOpen("edit")}>
          Редактировать
        </Button>
        <Button variant="secondary" onClick={() => archiveSubject(subject.id, !subject.archived).then(() => router.refresh())}>
          {subject.archived ? "Вернуть" : "В архив"}
        </Button>
        <Button variant="danger" onClick={() => setDel(true)}>
          Удалить
        </Button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-auto pb-1">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/subjects/${subject.id}?tab=${id}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition ${tab === id ? "bg-accent text-white shadow-sm" : "bg-[var(--bg-elev)] text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "questions" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h2 className="text-xl font-semibold">Вопросы</h2>
              <p className="text-sm text-[var(--muted)]">{subject.questions.filter((q: any) => q.status === "LEARNED").length} из {subject.questions.length} выучено</p>
            </div>
            <Button onClick={() => setOpen("question")}>
              Добавить вопрос
            </Button>
            <Button variant="secondary" onClick={() => setOpen("import")}>Импорт JSON</Button>
          </div>
          {subject.questions.length === 0 ? (
            <EmptyState title="Вопросов пока нет" hint="Добавьте первый вопрос или импортируйте их JSON-массивом." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
            {subject.questions.map((q: any, index: number) => (
              <Link key={q.id} href={`/questions/${q.id}`} className="group block rounded-3xl border border-black/5 bg-[var(--bg-elev)] p-5 shadow-card transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30 dark:border-white/10">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/10 text-xs font-semibold text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-snug group-hover:text-[var(--accent)]">{q.text}</div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className={`h-2 w-2 rounded-full ${q.status === "LEARNED" ? "bg-success" : q.status === "REVIEW" ? "bg-amber-500" : "bg-[var(--accent)]"}`} />
                      {q.status === "LEARNED" ? "Выучен" : q.status === "REVIEW" ? "Повторить" : "В процессе"}
                      <span>·</span>{q.difficulty === "HARD" ? "сложно" : q.difficulty === "EASY" ? "легко" : "средне"}
                    </div>
                  </div>
                  <span className="text-lg text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--accent)]">↗</span>
                </div>
              </Link>
            ))
            }</div>
          )}
        </section>
      )}

      {tab === "tasks" && (
        <section className="space-y-3">
          <Button onClick={() => setOpen("task")}>Добавить задачу</Button>
          {subject.tasks.map((t: any) => (
            <Link key={t.id} href={`/tasks?open=${t.id}`} className="block rounded-2xl bg-[var(--bg-elev)] p-4">
              {t.title}
            </Link>
          ))}
        </section>
      )}

      {tab === "notes" && (
        <section className="space-y-3">
          <Button onClick={() => setOpen("note")}>Новая заметка</Button>
          {subject.notes.map((n: any) => (
            <Link key={n.id} href={`/notes?open=${n.id}`} className="block rounded-2xl p-4" style={{ background: n.color }}>
              <div className="font-medium text-ink-950">{n.title}</div>
            </Link>
          ))}
        </section>
      )}

      {tab === "files" && (
        <section className="space-y-3">
          <FileUploader parent={{ subjectId: subject.id }} />
          <FileGrid files={subject.attachments} />
        </section>
      )}

      {tab === "info" && (
        <section className="rounded-2xl bg-[var(--bg-elev)] p-5">
          <p className="whitespace-pre-wrap">{subject.description || "Описания пока нет."}</p>
        </section>
      )}

      {tab === "progress" && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[var(--bg-elev)] p-4">
            Вопросы {qProgress}%<ProgressBar value={qProgress} color={subject.color} />
          </div>
          <div className="rounded-2xl bg-[var(--bg-elev)] p-4">
            Задачи {taskProgress}%<ProgressBar value={taskProgress} color={subject.color} />
          </div>
        </section>
      )}

      {tab === "study" && <StudyMode questions={subject.questions} />}

      <Modal open={open === "edit"} onClose={() => setOpen(null)} title="Редактировать предмет">
        <SubjectForm
          id={subject.id}
          initial={{
            name: subject.name,
            color: subject.color,
            emoji: subject.emoji,
            teacher: subject.teacher ?? "",
            description: subject.description ?? "",
            type: subject.type,
            examDate: subject.examDate,
          }}
          onDone={() => setOpen(null)}
        />
      </Modal>
      <Modal open={open === "question"} onClose={() => setOpen(null)} title="Новый вопрос">
        <QuestionForm subjectId={subject.id} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "import"} onClose={() => setOpen(null)} title="Импорт вопросов из JSON" className="sm:max-w-2xl">
        <QuestionImport subjectId={subject.id} onDone={() => { setOpen(null); router.refresh(); }} />
      </Modal>
      <Modal open={open === "task"} onClose={() => setOpen(null)} title="Задача предмета">
        <TaskForm subjects={[{ id: subject.id, name: subject.name }]} initial={{ subjectId: subject.id }} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "note"} onClose={() => setOpen(null)} title="Заметка" className="sm:max-w-2xl">
        <NoteEditor subjects={[{ id: subject.id, name: subject.name }]} note={{ id: "", title: "", content: "", color: "#fde68a", pinned: false, subjectId: subject.id }} />
      </Modal>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Удалить предмет?"
        text="Вопросы и связанные файлы будут удалены. Задачи отвяжутся от предмета."
        onConfirm={async () => {
          await deleteSubject(subject.id);
          router.push("/subjects");
        }}
      />
    </div>
  );
}
