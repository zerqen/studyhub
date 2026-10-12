"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTask, toggleTaskDone } from "@/actions/tasks";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { TaskForm } from "./task-form";
import { SubtaskTree } from "./subtask-tree";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { CommentThread } from "../comments/comment-thread";
import { useToast } from "../ui/toast";
import { TASK_PRIORITIES, TASK_STATUSES, labelOf } from "@/lib/constants";

type TaskDetailData = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  subject: { name: string } | null;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  subtasks: { id: string; parentId: string | null; title: string; status: string; note: string | null; dueDate: string | null }[];
  attachments: { id: string; originalName: string; mimeType: string; size: number }[];
  notes: { id: string; title: string; content: string; color: string }[];
  tags: { tag: { name: string } }[];
  contextualComments: { id: string; content: string; createdAt: string; attachments?: { id: string; originalName: string; mimeType: string; size: number }[] }[];
  questions: { id: string; text: string; status: string }[];
};

export function TaskDetail({ task, subjects, questions }: { task: TaskDetailData; subjects: { id: string; name: string }[]; questions: { id: string; text: string; subjectId: string }[] }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function complete() {
    const result = await toggleTaskDone(task.id);
    if (!result.ok) toast.push(result.error, "err");
    else router.refresh();
  }

  async function remove() {
    if (!window.confirm("Удалить задачу и её подзадачи?")) return;
    const result = await deleteTask(task.id);
    if (!result.ok) toast.push(result.error, "err");
    else router.push("/tasks");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/tasks" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Все задачи</Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="space-y-5">
          <article className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card sm:p-8">
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1">{labelOf(TASK_STATUSES, task.status)}</span>
              <span className="rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/10">{labelOf(TASK_PRIORITIES, task.priority)}</span>
              {task.subject ? <span className="rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/10">{task.subject.name}</span> : null}
            </div>
            <h1 className={`text-3xl font-semibold tracking-tight ${task.status === "DONE" ? "line-through opacity-60" : ""}`}>{task.title}</h1>
            {task.description ? <p className="mt-5 whitespace-pre-wrap text-[var(--muted)]">{task.description}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void complete()}>{task.status === "DONE" ? "Вернуть в работу" : "Завершить"}</Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>Изменить параметры</Button>
              <Button variant="danger" onClick={() => void remove()}>Удалить</Button>
            </div>
          </article>
          <section className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
            <SubtaskTree taskId={task.id} items={task.subtasks} />
          </section>
          <CommentThread taskId={task.id} comments={task.contextualComments} />
        </main>
        <aside className="space-y-4">
          <section className="rounded-3xl bg-[var(--bg-elev)] p-5 shadow-card">
            <h2 className="font-semibold">Связанные вопросы</h2>
            <div className="mt-3 space-y-2">
              {task.questions.length ? task.questions.map((question) => (
                <Link key={question.id} href={`/questions/${question.id}`} className="block rounded-2xl border border-black/5 p-3 text-sm hover:border-[var(--accent)]/40 dark:border-white/10">
                  <div className="line-clamp-2">{question.text}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{question.status === "LEARNED" ? "Выучен" : question.status === "REVIEW" ? "Повторить" : "В процессе"}</div>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">Вопросов пока нет.</p>}
            </div>
          </section>
          <section className="rounded-3xl bg-[var(--bg-elev)] p-5 shadow-card">
            <h2 className="font-semibold">Файлы задачи</h2>
            <div className="mt-3"><FileUploader parent={{ taskId: task.id }} compact /></div>
            <div className="mt-4">{task.attachments.length ? <FileGrid files={task.attachments} /> : <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>}</div>
          </section>
          {task.dueDate ? <section className="rounded-3xl bg-[var(--bg-elev)] p-5 shadow-card"><div className="text-xs text-[var(--muted)]">Дедлайн</div><div className="mt-1 font-medium">{task.dueDate}</div></section> : null}
          <section className="rounded-3xl bg-[var(--bg-elev)] p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Заметки</h2>
              <Link href={`/notes?taskId=${task.id}`} className="text-xs text-[var(--accent)]">Новая заметка</Link>
            </div>
            <div className="mt-3 space-y-2">
              {task.notes.length ? task.notes.map((note) => (
                <Link key={note.id} href={`/notes?open=${note.id}`} className="block rounded-2xl p-3 text-sm transition hover:opacity-80" style={{ background: note.color }}>
                  <div className="font-medium text-ink-950">{note.title}</div>
                  {note.content ? <div className="mt-1 line-clamp-2 text-xs text-ink-700/70">{note.content}</div> : null}
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">Заметок пока нет.</p>}
            </div>
          </section>
        </aside>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title="Изменить задачу">
        <TaskForm id={task.id} subjects={subjects} questions={questions} initial={{ title: task.title, description: task.description ?? "", subjectId: task.subjectId ?? "", startDate: task.startDate ?? "", dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "", priority: task.priority, status: task.status, tags: task.tags.map((item) => item.tag.name).join(","), questionId: task.questions[0]?.id }} onDone={() => setEditing(false)} />
      </Modal>
    </div>
  );
}
