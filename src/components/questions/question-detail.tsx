"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordAttempt } from "@/actions/questions";
import { Button } from "../ui/button";
import { QuestionForm } from "./question-form";
import { Modal } from "../ui/modal";
import { useToast } from "../ui/toast";
import { CommentThread } from "../comments/comment-thread";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { TaskForm } from "../tasks/task-form";

type QuestionDetailData = {
  id: string;
  subjectId: string;
  text: string;
  answer: string | null;
  explanation: string | null;
  difficulty: string;
  status: string;
  subject: { name: string };
  attachments?: { id: string; originalName: string; mimeType: string; size: number }[];
  notes?: { id: string; title: string; content: string; color: string }[];
  comments?: { id: string; content: string; createdAt: string; attachments?: { id: string; originalName: string; mimeType: string; size: number }[] }[];
  attempts?: { id: string; knew: boolean; createdAt: string }[];
  tasks?: { id: string; title: string; status: string }[];
  tags: { tag: { name: string } }[];
};

export function QuestionDetail({ question }: { question: QuestionDetailData }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function attempt(knew: boolean) {
    const result = await recordAttempt(question.id, knew);
    if (!result.ok) toast.push(result.error, "err");
    else { toast.push(knew ? "Отмечено как выученное" : "Отправлено на повторение"); router.refresh(); }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3 px-1 text-sm text-[var(--muted)]">
        <a href={`/subjects/${question.subjectId}?tab=questions`} className="hover:text-[var(--ink)]">← {question.subject.name}</a>
        <span>/</span><span>Вопрос</span>
      </div>
      <article className="overflow-hidden rounded-[2rem] border border-black/5 bg-[var(--bg-elev)] shadow-card dark:border-white/10">
        <div className="bg-[var(--accent)]/10 px-6 py-5 sm:px-9">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium dark:bg-black/10">{question.difficulty === "HARD" ? "Сложный" : question.difficulty === "EASY" ? "Лёгкий" : "Средний"}</span>
            <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium dark:bg-black/10">{question.status === "LEARNED" ? "Выучен" : question.status === "REVIEW" ? "Нужно повторить" : "В процессе"}</span>
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{question.text}</h1>
        </div>
        <div className="px-6 py-6 sm:px-9">
        <div className="rounded-2xl border border-dashed border-[var(--line)] p-5">
          {showAnswer ? (
            <div className="space-y-4">
              <div><h2 className="mb-1 text-sm font-medium text-[var(--muted)]">Ответ</h2><p className="whitespace-pre-wrap">{question.answer || "Ответ пока не добавлен."}</p></div>
              {question.explanation ? <div><h2 className="mb-1 text-sm font-medium text-[var(--muted)]">Пояснение</h2><p className="whitespace-pre-wrap text-[var(--muted)]">{question.explanation}</p></div> : null}
            </div>
          ) : <p className="text-[var(--muted)]">Сначала ответьте самостоятельно, затем откройте ответ.</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? "Скрыть ответ" : "Показать ответ"}</Button>
          <Button onClick={() => void attempt(true)}>Знал</Button>
          <Button variant="secondary" onClick={() => void attempt(false)}>Нужно повторить</Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>Редактировать</Button>
          <Button variant="ghost" onClick={() => setCreatingTask(true)}>Создать задачу</Button>
        </div>
        </div>
      </article>
      <section className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
        <h2 className="text-xl font-semibold">Файлы вопроса</h2>
        <div className="mt-3"><FileUploader parent={{ questionId: question.id }} compact /></div>
        <div className="mt-4">{question.attachments?.length ? <FileGrid files={question.attachments} /> : <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>}</div>
      </section>
      <CommentThread questionId={question.id} comments={question.comments ?? []} />
      <section className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
        <h2 className="text-xl font-semibold">Связанные задачи</h2>
        <div className="mt-4 space-y-2">
          {question.tasks?.length ? question.tasks.map((task) => (
            <a key={task.id} href={`/tasks/${task.id}`} className="block rounded-2xl border border-black/5 p-4 text-sm hover:border-[var(--accent)]/40 dark:border-white/10">
              <div className="font-medium">{task.title}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{task.status === "DONE" ? "Завершена" : task.status === "IN_PROGRESS" ? "В процессе" : "Запланирована"}</div>
            </a>
          )) : <p className="text-sm text-[var(--muted)]">Связанных задач пока нет.</p>}
        </div>
      </section>
      <section className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">История изучения</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Последние попытки по этому вопросу.</p>
          </div>
          <div className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)]">
            {question.attempts?.filter((attempt) => attempt.knew).length ?? 0} / {question.attempts?.length ?? 0}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {question.attempts?.length ? question.attempts.map((attempt) => (
            <div key={attempt.id} className="flex items-center justify-between rounded-2xl border border-black/5 px-4 py-3 text-sm dark:border-white/10">
              <span className={attempt.knew ? "text-[var(--success)]" : "text-amber-700"}>{attempt.knew ? "Знал" : "Нужно повторить"}</span>
              <time className="text-xs text-[var(--muted)]">{new Date(attempt.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">Попыток пока нет. Ответьте на вопрос выше.</p>}
        </div>
      </section>
      <section className="rounded-[2rem] bg-[var(--bg-elev)] p-6 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Связанные заметки</h2>
          <a href={`/notes?questionId=${question.id}`} className="text-sm text-[var(--accent)]">Новая заметка</a>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {question.notes?.length ? question.notes.map((note) => (
            <a key={note.id} href={`/notes?open=${note.id}`} className="rounded-2xl p-4 transition hover:opacity-80" style={{ background: note.color }}>
              <div className="font-medium text-ink-950">{note.title}</div>
              {note.content ? <div className="mt-1 line-clamp-2 text-sm text-ink-700/70">{note.content}</div> : null}
            </a>
          )) : <p className="text-sm text-[var(--muted)]">К вопросу пока не привязаны заметки.</p>}
        </div>
      </section>
      <Modal open={editing} onClose={() => setEditing(false)} title="Редактировать вопрос">
        <QuestionForm
          id={question.id}
          subjectId={question.subjectId}
          initial={{
            subjectId: question.subjectId,
            text: question.text,
            answer: question.answer ?? "",
            explanation: question.explanation ?? "",
            difficulty: question.difficulty,
            status: question.status,
            tags: question.tags.map((item) => item.tag.name).join(","),
          }}
          onDone={() => setEditing(false)}
        />
      </Modal>
      <Modal open={creatingTask} onClose={() => setCreatingTask(false)} title="Задача по вопросу">
        <TaskForm
          subjects={[{ id: question.subjectId, name: question.subject.name }]}
          initial={{ title: `Повторить: ${question.text}`, subjectId: question.subjectId, questionId: question.id, priority: "MEDIUM", status: "PLANNED" }}
          onDone={() => setCreatingTask(false)}
        />
      </Modal>
    </div>
  );
}
