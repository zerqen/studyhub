"use client";

import { useState } from "react";
import { addComment, deleteComment, updateComment } from "@/actions/tasks";
import { Button } from "../ui/button";
import { FileGrid } from "../files/file-grid";
import { useToast } from "../ui/toast";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  attachments?: { id: string; originalName: string; mimeType: string; size: number }[];
};

function CommentText({ content }: { content: string }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {content.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">{part}</a>
        ) : part
      )}
    </p>
  );
}

export function CommentThread({ taskId, questionId, comments }: { taskId?: string; questionId?: string; comments: Comment[] }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const toast = useToast();
  const router = useRouter();
  const label = taskId ? "задаче" : "вопросе";

  async function submit() {
    setBusy(true);
    const result = await addComment({ taskId, questionId, content });
    if (!result.ok) {
      toast.push(result.error, "err");
      setBusy(false);
      return;
    }
    if (files.length && result.data?.id) {
      try {
        for (const file of files) {
          const form = new FormData();
          form.set("file", file);
          form.set("commentId", result.data.id);
          const response = await fetch("/api/upload", { method: "POST", body: form });
          const upload = await response.json();
          if (!upload.ok) throw new Error(upload.error ?? "Не удалось прикрепить файл");
        }
      } catch (error) {
        toast.push(error instanceof Error ? error.message : "Комментарий добавлен, но файл не загрузился", "err");
      }
    }
    setContent("");
    setFiles([]);
    toast.push("Комментарий добавлен");
    setBusy(false);
    router.refresh();
  }

  async function saveEdit(id: string) {
    const result = await updateComment(id, editingText);
    if (!result.ok) {
      toast.push(result.error, "err");
      return;
    }
    setEditingId(null);
    toast.push("Комментарий обновлён");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить этот комментарий и его файлы?")) return;
    const result = await deleteComment(id);
    if (!result.ok) toast.push(result.error, "err");
    else {
      toast.push("Комментарий удалён");
      router.refresh();
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Мои комментарии</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Мысли, ссылки и материалы по {label}.</p>
      </div>
      <div className="rounded-3xl border border-black/5 bg-[var(--bg-elev)] p-4 dark:border-white/10">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Напишите мысль или вставьте ссылку…"
          className="min-h-24 w-full resize-y bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--ink)]">
              <input type="file" multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              {files.length ? `Файлов выбрано: ${files.length}` : "Прикрепить файл"}
            </label>
            <span className="text-xs text-[var(--muted)]">Ссылки кликабельны</span>
          </div>
          <Button disabled={busy || !content.trim()} onClick={() => void submit()}>{busy ? "Публикация…" : "Добавить комментарий"}</Button>
        </div>
      </div>
      <div className="space-y-3">
        {comments.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">Пока пусто. Оставьте первую заметку по этому объекту.</p> : comments.map((comment) => (
          <article key={comment.id} className="rounded-3xl border border-black/5 bg-[var(--bg-elev)] p-5 dark:border-white/10">
            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)]/10 font-medium text-[var(--accent)]">Я</span>
              <span>{new Date(comment.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {editingId === comment.id ? (
              <div className="space-y-2">
                <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-transparent p-3 text-sm outline-none" />
                <div className="flex gap-2">
                  <Button onClick={() => void saveEdit(comment.id)} disabled={!editingText.trim()}>Сохранить</Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>Отмена</Button>
                </div>
              </div>
            ) : <CommentText content={comment.content} />}
            <div className="mt-3 flex gap-3 text-xs text-[var(--muted)]">
              <button onClick={() => { setEditingId(comment.id); setEditingText(comment.content); }}>Изменить</button>
              <button className="text-rose-600" onClick={() => void remove(comment.id)}>Удалить</button>
            </div>
            {comment.attachments?.length ? <div className="mt-4"><FileGrid files={comment.attachments} /></div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
