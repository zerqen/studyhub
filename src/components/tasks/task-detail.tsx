"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteTask, moveTaskDate, toggleTaskDone } from "@/actions/tasks";
import { QUESTION_STATUSES, TASK_PRIORITIES, TASK_STATUSES, labelOf, questionStatusTone } from "@/lib/constants";
import { cn, daysUntil, formatDate, isOverdue } from "@/lib/utils";
import { untilText } from "@/lib/subject-view";
import { localKey } from "@/lib/task-week";
import { Badge } from "../ui/badge";
import { ConfirmDialog, Modal } from "../ui/modal";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";
import { SubtaskTree } from "./subtask-tree";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { CommentThread } from "../comments/comment-thread";
import { Markdown } from "../ui/markdown";
import { taskKind } from "@/lib/task-kinds";

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
  author,
}: {
  task: TaskDetailData;
  subjects: { id: string; name: string }[];
  questions: { id: string; text: string; subjectId: string }[];
  /** Имя для подписи комментариев */
  author?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState(false);
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

  async function moveBy(days: number) {
    setMenu(false);
    const base = task.dueDate && task.dueDate.slice(0, 10) > localKey(new Date()) && days === 7 ? new Date(`${task.dueDate.slice(0, 10)}T12:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    const r = await moveTaskDate(task.id, localKey(base));
    if (!r.ok) toast.push(r.error, "err");
    else toast.push(days === 1 ? "Перенесено на завтра" : "Перенесено на неделю");
  }

  const d = daysUntil(task.dueDate);
  const dueText = task.dueDate
    ? `${formatDate(task.dueDate, "EEEEEE, d MMM").replace(".", "")}${task.dueTime ? `, ${task.dueTime}` : ""}${done ? "" : ` · ${d !== null && d < 0 ? "просрочено" : untilText(d)}`}`
    : "без срока";
  const meta: { k: string; v: string; tone: "accent" | "urgent" | "plain" | "link" }[] = [
    { k: "Срок", v: dueText, tone: task.dueDate ? (overdue ? "urgent" : "accent") : "link" },
    ...(task.startDate ? [{ k: "Начало", v: formatDate(task.startDate, "d MMMM"), tone: "plain" as const }] : []),
    { k: "Статус", v: labelOf(TASK_STATUSES, st), tone: "plain" },
    { k: "Приоритет", v: labelOf(TASK_PRIORITIES, task.priority), tone: task.priority === "HIGH" || task.priority === "CRITICAL" ? "urgent" : "plain" },
    {
      k: "Тип",
      v: `${taskKind(task.kind).label}${task.kind === "HOMEWORK" && task.lessonAt ? ` · задали ${formatDate(task.lessonAt, "d MMM")}` : ""}`,
      tone: "plain",
    },
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      <Link href="/tasks" className="self-start text-[13px] text-accent hover:underline">
        ← Задачи
      </Link>

      <header className="card flex flex-wrap items-start gap-x-6 gap-y-4 rounded-2xl p-5 sm:px-6 sm:py-[22px]">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {task.subject ? (
              <Link href={`/subjects/${task.subject.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: task.subject.color }} />
                {task.subject.name}
              </Link>
            ) : (
              <span className="text-[13px] text-muted">Без предмета</span>
            )}
            {task.tags.map((t) => (
              <Link key={t.tag.name} href={`/tasks?tag=${encodeURIComponent(t.tag.name)}`} className="text-xs text-muted hover:text-accent">
                #{t.tag.name}
              </Link>
            ))}
          </div>
          <h1 className={cn("heading break-words text-[28px] leading-tight sm:text-[34px]", done && "text-muted line-through")}>{task.title}</h1>
          {task.description ? (
            <div className="text-[15px] text-fg/75">
              <Markdown>{task.description}</Markdown>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void complete()}
            className={cn("h-11 rounded-[10px] px-[18px] text-sm font-semibold text-white transition-opacity hover:opacity-90", done ? "bg-[#424655]" : "bg-accent")}
          >
            {done ? "Вернуть в работу" : "Отметить выполненной"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Ещё: изменить, перенести, удалить"
              aria-expanded={menu}
              className="grid h-11 w-11 place-items-center rounded-[10px] border border-line bg-surface text-fg/75 transition-colors hover:bg-subtle"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
            {menu ? (
              <>
                <button className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-hidden tabIndex={-1} />
                <div role="menu" className="absolute right-0 z-40 mt-1 w-52 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <MenuItem icon={Pencil} onClick={() => { setMenu(false); setEditing(true); }}>
                    Изменить
                  </MenuItem>
                  {!done ? (
                    <>
                      <MenuItem icon={CalendarClock} onClick={() => void moveBy(1)}>
                        На завтра
                      </MenuItem>
                      <MenuItem icon={CalendarClock} onClick={() => void moveBy(7)}>
                        На неделю позже
                      </MenuItem>
                    </>
                  ) : null}
                  <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setDeleting(true); }}>
                    Удалить
                  </MenuItem>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-[18px]">
          <section aria-label="Подзадачи" className="card rounded-[14px] px-4 py-[18px] sm:px-5">
            <SubtaskTree taskId={task.id} items={task.subtasks} />
          </section>
          <CommentThread taskId={task.id} comments={task.contextualComments} authorName={author} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
          <section aria-label="Сводка" className="card rounded-[14px] px-[18px] py-1.5">
            <dl>
              {meta.map((m, i) => (
                <div key={m.k} className={cn("flex min-h-[46px] items-center justify-between gap-2.5 text-sm", i > 0 && "border-t border-[#ECE8DF] dark:border-line")}>
                  <dt className="text-muted">{m.k}</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      title="Изменить"
                      className={cn(
                        "h-[30px] max-w-[13rem] truncate rounded-lg px-2.5 text-[13px] transition-opacity hover:opacity-80",
                        m.tone === "accent" && "bg-accent-soft font-semibold text-accent",
                        m.tone === "urgent" && "bg-urgent-soft font-semibold text-urgent",
                        m.tone === "plain" && "bg-subtle font-medium text-fg/75",
                        m.tone === "link" && "font-semibold text-accent",
                      )}
                    >
                      {m.v}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Файлы задачи" className="card flex flex-col gap-2 rounded-[14px] px-[18px] py-3.5">
            <h2 className="heading text-lg">Файлы</h2>
            <FileUploader parent={{ taskId: task.id }} compact camera />
            {task.attachments.length ? <FileGrid files={task.attachments} compact /> : null}
          </section>

          {task.questions.length ? (
            <section aria-label="Вопросы" className="card flex flex-col gap-1 rounded-[14px] px-[18px] py-3.5">
              <h2 className="heading text-lg">Вопросы</h2>
              {task.questions.map((q) => (
                <Link key={q.id} href={`/questions/${q.id}`} className="block border-t border-[#ECE8DF] py-2 transition-colors hover:text-accent dark:border-line">
                  <div className="line-clamp-2 text-[13px]">{q.text}</div>
                  <Badge tone={questionStatusTone(q.status)} className="mt-1">
                    {labelOf(QUESTION_STATUSES, q.status)}
                  </Badge>
                </Link>
              ))}
            </section>
          ) : null}

          <section aria-label="Заметки" className="card flex flex-col gap-1 rounded-[14px] px-[18px] py-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="heading text-lg">Заметки</h2>
              <Link href={`/notes?taskId=${task.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
                <Plus className="h-3.5 w-3.5" /> Заметка
              </Link>
            </div>
            {task.notes.length ? (
              task.notes.map((note) => (
                <Link key={note.id} href={`/notes?open=${note.id}`} className="flex gap-2.5 border-t border-[#ECE8DF] py-2 transition-colors hover:text-accent dark:border-line">
                  <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: note.color }} />
                  <span className="min-w-0 truncate text-[13px]">{note.title}</span>
                </Link>
              ))
            ) : (
              <p className="text-[13px] text-muted">Заметок нет.</p>
            )}
          </section>
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
            kind: task.kind ?? "TASK",
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

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", danger ? "text-danger hover:bg-danger/10" : "hover:bg-subtle")}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
