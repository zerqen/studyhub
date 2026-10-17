"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, Calendar, Check, ChevronLeft, Flag, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { deleteTask, toggleTaskDone } from "@/actions/tasks";
import { QUESTION_STATUSES, TASK_PRIORITIES, TASK_STATUSES, labelOf, priorityTone, questionStatusTone, taskStatusTone } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog, Modal } from "../ui/modal";
import { Section } from "../ui/page";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";
import { SubtaskTree } from "./subtask-tree";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { CommentThread } from "../comments/comment-thread";
import { Markdown } from "../ui/markdown";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

type TaskDetailData = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  subject: { id: string; name: string; color: string } | null;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  kind?: string;
  lessonAt?: string | null;
  subtasks: { id: string; parentId: string | null; title: string; status: string; note: string | null; dueDate: string | null }[];
  attachments: FileItem[];
  notes: { id: string; title: string; content: string; color: string }[];
  tags: { tag: { name: string } }[];
  contextualComments: { id: string; content: string; createdAt: string; attachments?: FileItem[] }[];
  questions: { id: string; text: string; status: string }[];
};

export function TaskDetail({
  task,
  subjects,
  questions,
}: {
  task: TaskDetailData;
  subjects: { id: string; name: string }[];
  questions: { id: string; text: string; subjectId: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const st = status ?? task.status;
  const done = st === "DONE";
  const overdue = isOverdue(task.dueDate, st);

  async function complete() {
    setStatus(done ? "PLANNED" : "DONE");
    const result = await toggleTaskDone(task.id);
    if (!result.ok) {
      toast.push(result.error, "err");
      setStatus(null);
    } else {
      setStatus(null);
      if (!done) toast.push("Задача выполнена");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> Задачи
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          <article className="card p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Badge tone={taskStatusTone(st)} dot>
                {labelOf(TASK_STATUSES, st)}
              </Badge>
              {task.subject ? (
                <Link href={`/subjects/${task.subject.id}`} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-subtle px-2 text-xs font-medium text-muted hover:text-fg">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.subject.color }} />
                  {task.subject.name}
                </Link>
              ) : null}
              {task.tags.map((t) => (
                <Link key={t.tag.name} href={`/tasks?tag=${encodeURIComponent(t.tag.name)}`} className="text-xs text-muted hover:text-accent">
                  #{t.tag.name}
                </Link>
              ))}
            </div>
            <h1 className={cn("text-xl font-semibold leading-snug tracking-tight sm:text-2xl", done && "text-muted line-through")}>{task.title}</h1>
            {task.description ? (
              <div className="mt-3 text-sm text-muted">
                <Markdown>{task.description}</Markdown>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant={done ? "secondary" : "primary"} onClick={() => void complete()}>
                {done ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {done ? "Вернуть в работу" : "Выполнено"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Изменить
              </Button>
              <Button variant="danger-ghost" className="ml-auto" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" /> Удалить
              </Button>
            </div>
          </article>

          <div className="card p-4 sm:p-5">
            <SubtaskTree taskId={task.id} items={task.subtasks} />
          </div>

          <CommentThread taskId={task.id} comments={task.contextualComments} />
        </div>

        <aside className="space-y-4">
          <Section>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-muted">
                  <Calendar className="h-4 w-4" /> Срок
                </dt>
                <dd className={cn("font-medium", overdue && "text-danger")}>
                  {task.dueDate ? formatDate(task.dueDate, "d MMMM") : "—"}
                  {task.dueTime ? `, ${task.dueTime}` : ""}
                </dd>
              </div>
              {task.startDate ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="pl-6 text-muted">Начало</dt>
                  <dd>{formatDate(task.startDate, "d MMMM")}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-muted">
                  <Flag className="h-4 w-4" /> Приоритет
                </dt>
                <dd>
                  <Badge tone={priorityTone(task.priority)}>{labelOf(TASK_PRIORITIES, task.priority)}</Badge>
                </dd>
              </div>
              {task.kind === "HOMEWORK" ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-muted">
                    <BookMarked className="h-4 w-4" /> Домашка
                  </dt>
                  <dd className="text-right text-sm">{task.lessonAt ? `задали ${formatDate(task.lessonAt, "d MMM, HH:mm")}` : "да"}</dd>
                </div>
              ) : null}
            </dl>
          </Section>

          {task.questions.length ? (
            <Section title="Вопросы" bodyClassName="p-1.5">
              {task.questions.map((q) => (
                <Link key={q.id} href={`/questions/${q.id}`} className="block rounded-xl px-2.5 py-2 transition-colors hover:bg-subtle">
                  <div className="line-clamp-2 text-sm">{q.text}</div>
                  <Badge tone={questionStatusTone(q.status)} className="mt-1">
                    {labelOf(QUESTION_STATUSES, q.status)}
                  </Badge>
                </Link>
              ))}
            </Section>
          ) : null}

          <Section
            title="Заметки"
            action={
              <Link href={`/notes?taskId=${task.id}`} className="text-muted hover:text-fg" aria-label="Новая заметка">
                <Plus className="h-4 w-4" />
              </Link>
            }
            bodyClassName="p-1.5"
          >
            {task.notes.length ? (
              task.notes.map((note) => (
                <Link key={note.id} href={`/notes?open=${note.id}`} className="flex gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-subtle">
                  <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: note.color }} />
                  <span className="min-w-0 truncate text-sm">{note.title}</span>
                </Link>
              ))
            ) : (
              <p className="px-2.5 py-2 text-sm text-muted">Заметок нет.</p>
            )}
          </Section>

          <Section title="Файлы">
            <FileUploader parent={{ taskId: task.id }} compact camera />
            {task.attachments.length ? (
              <div className="mt-3">
                <FileGrid files={task.attachments} compact />
              </div>
            ) : null}
          </Section>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Изменить задачу">
        <TaskForm
          id={task.id}
          subjects={subjects}
          questions={questions}
          initial={{
            title: task.title,
            description: task.description ?? "",
            subjectId: task.subjectId ?? "",
            startDate: task.startDate?.slice(0, 10) ?? "",
            dueDate: task.dueDate?.slice(0, 10) ?? "",
            dueTime: task.dueTime ?? "",
            priority: task.priority,
            status: st,
            tags: task.tags.map((item) => item.tag.name).join(", "),
            questionId: task.questions[0]?.id,
          }}
          onDone={() => setEditing(false)}
        />
      </Modal>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить задачу?"
        text="Задача, её подзадачи и комментарии будут удалены."
        onConfirm={async () => {
          const result = await deleteTask(task.id);
          if (!result.ok) toast.push(result.error, "err");
          else router.push("/tasks");
        }}
      />
    </div>
  );
}
