"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Eye, EyeOff, ListPlus, Pencil, Plus } from "lucide-react";
import { recordAttempt } from "@/actions/questions";
import { DIFFICULTIES, QUESTION_STATUSES, TASK_STATUSES, labelOf, questionStatusTone, taskStatusTone } from "@/lib/constants";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { GRADES, isDue, previewLabel, type Grade } from "@/lib/srs";
import { Markdown } from "../ui/markdown";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { Section } from "../ui/page";
import { useToast } from "../ui/toast";
import { QuestionForm } from "./question-form";
import { CommentThread } from "../comments/comment-thread";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { TaskForm } from "../tasks/task-form";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

type QuestionDetailData = {
  id: string;
  subjectId: string;
  text: string;
  answer: string | null;
  explanation: string | null;
  difficulty: string;
  status: string;
  kind?: string;
  ticketNo?: number | null;
  srsDue: string | null;
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsLapses: number;
  lecture?: { id: string; title: string; number: number | null } | null;
  subject: { id: string; name: string; color: string; emoji: string };
  attachments?: FileItem[];
  notes?: { id: string; title: string; content: string; color: string }[];
  comments?: { id: string; content: string; createdAt: string; attachments?: FileItem[] }[];
  attempts?: { id: string; knew: boolean; createdAt: string }[];
  tasks?: { id: string; title: string; status: string }[];
  tags: { tag: { name: string } }[];
};

export function QuestionDetail({ question }: { question: QuestionDetailData }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [pending, setPending] = useState<Grade | null>(null);
  const toast = useToast();
  const attempts = question.attempts ?? [];
  const knewCount = attempts.filter((a) => a.knew).length;

  const srs = { interval: question.srsInterval, ease: question.srsEase, reps: question.srsReps, lapses: question.srsLapses };

  async function attempt(grade: Grade) {
    setPending(grade);
    const result = await recordAttempt(question.id, grade);
    setPending(null);
    if (!result.ok) toast.push(result.error, "err");
    else toast.push(grade === 0 ? "Вопрос вернётся через 10 минут" : `Следующий повтор через ${previewLabel(srs, grade)}`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/subjects/${question.subjectId}?tab=questions`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {question.subject.emoji} {question.subject.name}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          <article className="card overflow-hidden">
            <div className="px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Badge tone={questionStatusTone(question.status)} dot>
                  {labelOf(QUESTION_STATUSES, question.status)}
                </Badge>
                <Badge>{labelOf(DIFFICULTIES, question.difficulty)}</Badge>
                {question.kind === "PROBLEM" ? <Badge tone="accent">Задача</Badge> : null}
                {question.ticketNo ? <Badge>Билет {question.ticketNo}</Badge> : null}
                {question.tags.map((t) => (
                  <Badge key={t.tag.name}>#{t.tag.name}</Badge>
                ))}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Изменить
                </Button>
              </div>
              <div className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                <Markdown>{question.text}</Markdown>
              </div>
              {question.lecture ? (
                <Link href={`/lectures/${question.lecture.id}`} className="mt-2 inline-block text-sm text-muted hover:text-accent">
                  Лекция {question.lecture.number ?? ""} · {question.lecture.title}
                </Link>
              ) : null}
            </div>

            <div className="border-t border-line bg-subtle/40 px-5 py-5 sm:px-7">
              {showAnswer ? (
                <div className="animate-fade-in space-y-4">
                  <div>
                    <div className="label-xs mb-1.5 text-accent">Ответ</div>
                    {question.answer ? <Markdown>{question.answer}</Markdown> : <span className="text-muted">Ответ пока не добавлен.</span>}
                  </div>
                  {question.explanation ? (
                    <div>
                      <div className="label-xs mb-1.5">Пояснение</div>
                      <div className="text-sm text-muted">
                        <Markdown>{question.explanation}</Markdown>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">Сначала попробуй ответить сам, потом открой ответ.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 sm:px-7">
              <Button variant={showAnswer ? "secondary" : "primary"} onClick={() => setShowAnswer((v) => !v)}>
                {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showAnswer ? "Скрыть ответ" : "Показать ответ"}
              </Button>
              {showAnswer ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {GRADES.map((g) => (
                    <Button
                      key={g.grade}
                      variant="secondary"
                      size="sm"
                      loading={pending === g.grade}
                      className={cn(g.grade === 0 && "text-danger", g.grade === 1 && "text-warning", g.grade === 2 && "text-success", g.grade === 3 && "text-accent")}
                      onClick={() => void attempt(g.grade)}
                      title={`Вернётся через ${previewLabel(srs, g.grade)}`}
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <span className="ml-auto text-xs text-muted">
                  {question.srsReps === 0 ? "Ещё не повторялся" : isDue(question.srsDue) ? "Пора повторить" : `Следующий повтор ${formatRelative(question.srsDue)}`}
                </span>
              )}
            </div>
          </article>

          <CommentThread questionId={question.id} comments={question.comments ?? []} />
        </div>

        <aside className="space-y-4">
          <Section
            title="История"
            action={attempts.length ? <span className="text-xs tabular-nums text-muted">{knewCount} / {attempts.length}</span> : null}
          >
            {attempts.length ? (
              <>
                <div className="mb-3 flex gap-1">
                  {[...attempts].reverse().map((a) => (
                    <span key={a.id} title={formatDate(a.createdAt, "d MMM, HH:mm")} className={cn("h-6 flex-1 rounded", a.knew ? "bg-success/70" : "bg-danger/60")} />
                  ))}
                </div>
                <p className="text-xs text-muted">Последняя попытка: {formatDate(attempts[0].createdAt, "d MMMM, HH:mm")}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Попыток пока нет.</p>
            )}
          </Section>

          <Section
            title="Задачи"
            action={
              <button className="text-muted hover:text-fg" onClick={() => setCreatingTask(true)} aria-label="Создать задачу">
                <ListPlus className="h-4 w-4" />
              </button>
            }
            bodyClassName="p-1.5"
          >
            {question.tasks?.length ? (
              question.tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-subtle">
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  <Badge tone={taskStatusTone(task.status)}>{labelOf(TASK_STATUSES, task.status)}</Badge>
                </Link>
              ))
            ) : (
              <p className="px-2.5 py-2 text-sm text-muted">Связанных задач нет.</p>
            )}
          </Section>

          <Section
            title="Заметки"
            action={
              <Link href={`/notes?questionId=${question.id}`} className="text-muted hover:text-fg" aria-label="Новая заметка">
                <Plus className="h-4 w-4" />
              </Link>
            }
            bodyClassName="p-1.5"
          >
            {question.notes?.length ? (
              question.notes.map((note) => (
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
            <FileUploader parent={{ questionId: question.id }} compact camera />
            {question.attachments?.length ? (
              <div className="mt-3">
                <FileGrid files={question.attachments} compact />
              </div>
            ) : null}
          </Section>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Редактировать вопрос" className="sm:max-w-xl">
        <QuestionForm
          id={question.id}
          subjectId={question.subjectId}
          initial={{
            text: question.text,
            answer: question.answer ?? "",
            explanation: question.explanation ?? "",
            difficulty: question.difficulty,
            status: question.status,
            tags: question.tags.map((item) => item.tag.name).join(", "),
            lectureId: question.lecture?.id,
            kind: question.kind ?? "THEORY",
            ticketNo: question.ticketNo ? String(question.ticketNo) : "",
          }}
          onDone={() => setEditing(false)}
        />
      </Modal>
      <Modal open={creatingTask} onClose={() => setCreatingTask(false)} title="Задача по вопросу">
        <TaskForm
          subjects={[{ id: question.subjectId, name: question.subject.name }]}
          initial={{ title: `Повторить: ${question.text.slice(0, 80)}`, subjectId: question.subjectId, questionId: question.id }}
          onDone={() => setCreatingTask(false)}
        />
      </Modal>
    </div>
  );
}
