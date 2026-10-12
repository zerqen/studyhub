"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTask, toggleTaskDone } from "@/actions/tasks";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/modal";
import { TaskForm } from "./task-form";
import { SubtaskTree } from "./subtask-tree";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { useToast } from "../ui/toast";
import { TASK_PRIORITIES, TASK_STATUSES, labelOf } from "@/lib/constants";
import Link from "next/link";

type Task = {
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
  subtasks: { id: string; parentId: string | null; title: string; status: string; note: string | null; dueDate: string | null }[];
  attachments: { id: string; originalName: string; mimeType: string; size: number }[];
  tags: { tag: { name: string } }[];
  questions: { id: string; text: string }[];
};

export function TasksBoard({
  tasks,
  subjects,
  questions,
  openId,
  tag,
}: {
  tasks: Task[];
  subjects: { id: string; name: string }[];
  questions: { id: string; text: string; subjectId: string }[];
  openId?: string;
  tag?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Task | null>(openId ? tasks.find((t) => t.id === openId) ?? null : null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const shown = tasks.filter((task) => {
    const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
    return (!filter || text.includes(filter.toLowerCase())) &&
      (!status || task.status === status) &&
      (!tag || task.tags.some((t) => t.tag.name === tag));
  });

  async function complete(id: string) {
    const result = await toggleTaskDone(id);
    if (!result.ok) toast.push(result.error, "err");
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Задачи</h1>
          <p className="text-sm text-[var(--muted)]">Учебные и личные дела в одном месте.</p>
        </div>
        <input className="rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Поиск задач" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {TASK_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <Button onClick={() => setCreating(true)}>Новая задача</Button>
      </div>

      <div className="space-y-3">
        {shown.length === 0 ? <p className="rounded-2xl bg-[var(--bg-elev)] p-6 text-sm text-[var(--muted)]">Задач не найдено.</p> : shown.map((task) => (
          <article key={task.id} className="rounded-2xl bg-[var(--bg-elev)] p-4 shadow-card">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={task.status === "DONE"} onChange={() => void complete(task.id)} className="mt-1 h-4 w-4" />
              <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 text-left">
                <div className={task.status === "DONE" ? "font-medium line-through opacity-60" : "font-medium"}>{task.title}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {task.subject ? <span>{task.subject.name}</span> : <span>Личное</span>}
                  {task.dueDate ? <span>Дедлайн: {task.dueDate}</span> : null}
                  <span>{labelOf(TASK_PRIORITIES, task.priority)}</span>
                  <span>{labelOf(TASK_STATUSES, task.status)}</span>
                </div>
              </Link>
              <button className="text-sm text-rose-600" onClick={() => setDeleting(task.id)}>Удалить</button>
            </div>
            {task.description ? <p className="mt-3 whitespace-pre-wrap pl-7 text-sm text-[var(--muted)]">{task.description}</p> : null}
            {task.subtasks.length ? <div className="mt-4 pl-7"><SubtaskTree taskId={task.id} items={task.subtasks} /></div> : null}
            <div className="mt-3 flex flex-wrap gap-2 pl-7">
              <FileUploader parent={{ taskId: task.id }} compact />
              {task.attachments.length ? <FileGrid files={task.attachments} /> : null}
            </div>
          </article>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Новая задача">
        <TaskForm subjects={subjects} questions={questions} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Редактировать задачу">
        {editing ? <TaskForm
          id={editing.id}
          subjects={subjects}
          questions={questions}
          initial={{
            title: editing.title,
            description: editing.description ?? "",
            subjectId: editing.subjectId ?? "",
            startDate: editing.startDate ?? "",
            dueDate: editing.dueDate ?? "",
            dueTime: editing.dueTime ?? "",
            priority: editing.priority,
            status: editing.status,
            tags: editing.tags.map((t) => t.tag.name).join(","),
            questionId: editing.questions[0]?.id,
          }}
          onDone={() => setEditing(null)}
        /> : null}
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Удалить задачу?" text="Задача и её подзадачи будут удалены." onConfirm={async () => {
        if (!deleting) return;
        const result = await deleteTask(deleting);
        if (!result.ok) toast.push(result.error, "err");
        else { toast.push("Задача удалена"); setDeleting(null); router.refresh(); }
      }} />
    </div>
  );
}
