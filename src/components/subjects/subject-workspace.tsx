"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowUpRight, FileJson, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { archiveSubject, deleteSubject } from "@/actions/subjects";
import { DIFFICULTIES, QUESTION_STATUSES, SUBJECT_TYPES, TASK_STATUSES, labelOf, questionStatusTone, taskStatusTone } from "@/lib/constants";
import { cn, daysUntil, formatDate, isOverdue } from "@/lib/utils";
import { Button } from "../ui/button";
import { Modal, ConfirmDialog } from "../ui/modal";
import { Badge, ProgressBar, ProgressRing } from "../ui/badge";
import { EmptyState } from "../ui/empty";
import { useToast } from "../ui/toast";
import { SubjectForm } from "./subject-form";
import { QuestionForm } from "../questions/question-form";
import { QuestionImport } from "../questions/question-import";
import { TaskForm } from "../tasks/task-form";
import { NoteEditor } from "../notes/note-editor";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { StudyMode, type StudyQuestion } from "../study/study-mode";

export type SubjectData = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  teacher: string | null;
  description: string | null;
  type: string;
  examDate: string;
  archived: boolean;
  questions: StudyQuestion[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: string | null }[];
  notes: { id: string; title: string; content: string; color: string; updatedAt: string }[];
  attachments: { id: string; originalName: string; mimeType: string; size: number }[];
};

const tabs = [
  ["questions", "Вопросы"],
  ["study", "Тренировка"],
  ["tasks", "Задачи"],
  ["notes", "Заметки"],
  ["files", "Файлы"],
  ["info", "О предмете"],
] as const;
type Tab = (typeof tabs)[number][0];

export function SubjectWorkspace({
  subject,
  initialTab,
  progress,
  qProgress,
  taskProgress,
}: {
  subject: SubjectData;
  initialTab: string;
  progress: number;
  qProgress: number;
  taskProgress: number;
}) {
  const [tab, setTabState] = useState<Tab>(tabs.some(([id]) => id === initialTab) ? (initialTab as Tab) : "questions");
  const [open, setOpen] = useState<null | "edit" | "question" | "import" | "task" | "note">(null);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const [qFilter, setQFilter] = useState<string>("all");
  const router = useRouter();
  const toast = useToast();
  const d = daysUntil(subject.examDate || null);

  // Вкладки переключаются мгновенно на клиенте: данные уже загружены, сервер не нужен
  function setTab(next: Tab) {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  const learned = subject.questions.filter((q) => q.status === "LEARNED").length;
  const shownQuestions = useMemo(
    () => (qFilter === "all" ? subject.questions : subject.questions.filter((q) => q.status === qFilter)),
    [qFilter, subject.questions],
  );
  const counts: Record<Tab, number | null> = {
    questions: subject.questions.length,
    study: null,
    tasks: subject.tasks.length,
    notes: subject.notes.length,
    files: subject.attachments.length,
    info: null,
  };

  return (
    <div>
      <Link href="/subjects" className="mb-4 inline-flex items-center text-sm text-muted transition-colors hover:text-fg">
        ← Предметы
      </Link>

      {/* Шапка предмета */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${subject.color}1a` }}>
            {subject.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{subject.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge>{labelOf(SUBJECT_TYPES, subject.type)}</Badge>
              {subject.archived ? <Badge tone="warning">В архиве</Badge> : null}
              {subject.teacher ? <span>{subject.teacher}</span> : null}
              {subject.examDate ? (
                <span className={cn(d !== null && d >= 0 && d <= 3 && "font-medium text-danger")}>
                  · {formatDate(subject.examDate, "d MMMM")}
                  {d !== null ? (d < 0 ? " (прошло)" : d === 0 ? " — сегодня" : ` — через ${d} дн.`) : ""}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <ProgressRing value={progress} color={subject.color} size={52} stroke={5} />
              <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{progress}%</span>
            </div>
            <div className="relative">
              <Button variant="secondary" size="icon" onClick={() => setMenu((v) => !v)} aria-label="Действия">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menu ? (
                <>
                  <button className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-hidden tabIndex={-1} />
                  <div className="absolute right-0 z-40 mt-1 w-48 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                    <MenuItem icon={Pencil} onClick={() => { setMenu(false); setOpen("edit"); }}>
                      Редактировать
                    </MenuItem>
                    <MenuItem
                      icon={subject.archived ? ArchiveRestore : Archive}
                      onClick={async () => {
                        setMenu(false);
                        const r = await archiveSubject(subject.id, !subject.archived);
                        if (!r.ok) toast.push(r.error, "err");
                        else toast.push(subject.archived ? "Предмет возвращён" : "Предмет в архиве");
                      }}
                    >
                      {subject.archived ? "Вернуть из архива" : "В архив"}
                    </MenuItem>
                    <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setDel(true); }}>
                      Удалить
                    </MenuItem>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
              tab === id ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {id === "study" ? <Play className="h-3.5 w-3.5" /> : null}
            {label}
            {counts[id] ? <span className="text-xs text-muted">{counts[id]}</span> : null}
            {tab === id ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="mr-auto flex flex-wrap gap-1.5">
              {[["all", "Все"], ...QUESTION_STATUSES.map((s) => [s.value, s.label] as const)].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setQFilter(value)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors",
                    qFilter === value ? "border-fg/20 bg-fg text-bg" : "border-line text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setOpen("import")}>
              <FileJson className="h-4 w-4" /> Импорт
            </Button>
            <Button onClick={() => setOpen("question")}>
              <Plus className="h-4 w-4" /> Вопрос
            </Button>
          </div>
          {subject.questions.length === 0 ? (
            <EmptyState
              title="Вопросов пока нет"
              hint="Добавь вопросы по одному или вставь сразу весь список через импорт JSON."
              action={
                <Button onClick={() => setOpen("question")}>
                  <Plus className="h-4 w-4" /> Добавить вопрос
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 text-sm text-muted">
                <ProgressBar value={qProgress} color={subject.color} className="max-w-48" />
                <span>
                  выучено {learned} из {subject.questions.length}
                </span>
                {learned < subject.questions.length ? (
                  <button className="ml-auto text-sm font-medium text-accent hover:underline" onClick={() => setTab("study")}>
                    Начать тренировку →
                  </button>
                ) : null}
              </div>
              <ol className="card divide-y divide-line overflow-hidden">
                {shownQuestions.map((q) => (
                  <li key={q.id}>
                    <Link href={`/questions/${q.id}`} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                      <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-muted">{subject.questions.indexOf(q) + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-snug">{q.text}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={questionStatusTone(q.status)} dot>
                            {labelOf(QUESTION_STATUSES, q.status)}
                          </Badge>
                          {q.difficulty !== "MEDIUM" ? <Badge>{labelOf(DIFFICULTIES, q.difficulty)}</Badge> : null}
                          {!q.answer ? <span className="text-xs text-muted">без ответа</span> : null}
                        </span>
                      </span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
                {shownQuestions.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted">Нет вопросов с таким статусом</li> : null}
              </ol>
            </>
          )}
        </section>
      )}

      {tab === "study" && <StudyMode questions={subject.questions} color={subject.color} />}

      {tab === "tasks" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setOpen("task")}>
              <Plus className="h-4 w-4" /> Задача
            </Button>
          </div>
          {subject.tasks.length === 0 ? (
            <EmptyState title="Задач нет" hint="Например: «Сдать лабораторную №3» или «Повторить билеты 1–10»." />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {subject.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.status === "DONE" && "text-muted line-through")}>{t.title}</span>
                    {t.dueDate ? (
                      <span className={cn("text-xs tabular-nums", isOverdue(t.dueDate, t.status) ? "font-medium text-danger" : "text-muted")}>
                        {formatDate(t.dueDate, "d MMM")}
                      </span>
                    ) : null}
                    <Badge tone={taskStatusTone(t.status)}>{labelOf(TASK_STATUSES, t.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "notes" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setOpen("note")}>
              <Plus className="h-4 w-4" /> Заметка
            </Button>
          </div>
          {subject.notes.length === 0 ? (
            <EmptyState title="Заметок нет" hint="Конспекты, формулы, шпаргалки — всё, что пригодится перед экзаменом." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {subject.notes.map((n) => (
                <Link key={n.id} href={`/notes?open=${n.id}`} className="card card-hover relative overflow-hidden p-4 pl-5">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: n.color }} />
                  <div className="truncate font-medium">{n.title}</div>
                  {n.content ? <p className="mt-1 line-clamp-3 text-sm text-muted">{n.content}</p> : null}
                  <div className="mt-2 text-xs text-muted">{formatDate(n.updatedAt, "d MMM")}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "files" && (
        <section className="space-y-4">
          <FileUploader parent={{ subjectId: subject.id }} />
          <FileGrid files={subject.attachments} />
        </section>
      )}

      {tab === "info" && (
        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="card p-5">
            <div className="label-xs mb-2">Описание</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{subject.description || <span className="text-muted">Описания пока нет.</span>}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen("edit")}>
              <Pencil className="h-3.5 w-3.5" /> Изменить
            </Button>
          </div>
          <div className="card space-y-4 p-5">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted">Вопросы</span>
                <span className="font-medium tabular-nums">{qProgress}%</span>
              </div>
              <ProgressBar value={qProgress} color={subject.color} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted">Задачи</span>
                <span className="font-medium tabular-nums">{taskProgress}%</span>
              </div>
              <ProgressBar value={taskProgress} color={subject.color} />
            </div>
            <div className="border-t border-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Общая готовность</span>
                <span className="font-semibold tabular-nums">{progress}%</span>
              </div>
            </div>
          </div>
        </section>
      )}

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
      <Modal open={open === "import"} onClose={() => setOpen(null)} title="Импорт вопросов" description="Вставь JSON-массив — вопросы добавятся в конец списка" className="sm:max-w-2xl">
        <QuestionImport subjectId={subject.id} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "task"} onClose={() => setOpen(null)} title="Новая задача">
        <TaskForm subjects={[{ id: subject.id, name: subject.name }]} initial={{ subjectId: subject.id }} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "note"} onClose={() => setOpen(null)} title="Новая заметка" className="sm:max-w-2xl">
        <NoteEditor subjects={[{ id: subject.id, name: subject.name }]} defaultSubjectId={subject.id} onDone={() => setOpen(null)} />
      </Modal>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Удалить предмет?"
        text="Вопросы и файлы предмета будут удалены. Задачи останутся, но отвяжутся от предмета."
        onConfirm={async () => {
          const r = await deleteSubject(subject.id);
          if (!r.ok) {
            toast.push(r.error, "err");
            return;
          }
          toast.push("Предмет удалён");
          router.push("/subjects");
        }}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", danger ? "text-danger hover:bg-danger/10" : "hover:bg-subtle")}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
