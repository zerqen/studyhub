"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { addComment, deleteComment, updateComment } from "@/actions/tasks";
import { formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { ConfirmDialog } from "../ui/modal";
import { FileGrid } from "../files/file-grid";
import { useToast } from "../ui/toast";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  attachments?: { id: string; originalName: string; mimeType: string; size: number }[];
};

function CommentText({ content }: { content: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {content.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!content.trim()) return;
    setBusy(true);
    const result = await addComment({ taskId, questionId, content });
    if (!result.ok) {
      toast.push(result.error, "err");
      setBusy(false);
      return;
    }
    if (files.length && result.data?.id) {
      try {
        await Promise.all(
          files.map(async (file) => {
            const form = new FormData();
            form.set("file", file);
            form.set("commentId", result.data!.id);
            const response = await fetch("/api/upload", { method: "POST", body: form });
            const upload = await response.json();
            if (!upload.ok) throw new Error(upload.error ?? "Не удалось прикрепить файл");
          }),
        );
        router.refresh();
      } catch (error) {
        toast.push(error instanceof Error ? error.message : "Комментарий добавлен, но файл не загрузился", "err");
      }
    }
    setContent("");
    setFiles([]);
    setBusy(false);
  }

  async function saveEdit(id: string) {
    const result = await updateComment(id, editingText);
    if (!result.ok) {
      toast.push(result.error, "err");
      return;
    }
    setEditingId(null);
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Комментарии {comments.length ? <span className="font-normal text-muted">{comments.length}</span> : null}
      </h2>

      {comments.length ? (
        <ul className="mb-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="card group p-4">
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                <span>{formatDate(comment.createdAt, "d MMMM, HH:mm")}</span>
                {editingId !== comment.id ? (
                  <span className="ml-auto flex gap-3 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
                    <button
                      className="hover:text-fg"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingText(comment.content);
                      }}
                    >
                      Изменить
                    </button>
                    <button className="hover:text-danger" onClick={() => setDeleting(comment.id)}>
                      Удалить
                    </button>
                  </span>
                ) : null}
              </div>
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <Textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit(comment.id)} disabled={!editingText.trim()}>
                      Сохранить
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <CommentText content={comment.content} />
              )}
              {comment.attachments?.length ? (
                <div className="mt-3 border-t border-line pt-2">
                  <FileGrid files={comment.attachments} compact />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="card p-3 transition-[border-color,box-shadow] focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
          placeholder="Мысль, ссылка или вопрос к себе…"
          rows={2}
          className="w-full resize-none bg-transparent px-1 text-sm leading-relaxed outline-none placeholder:text-muted"
        />
        {files.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs">
                {f.name}
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Убрать файл">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-muted transition-colors hover:bg-subtle hover:text-fg">
            <input type="file" multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            <Paperclip className="h-3.5 w-3.5" /> Файл
          </label>
          <Button size="sm" loading={busy} disabled={!content.trim()} onClick={() => void submit()}>
            Отправить
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Удалить комментарий?"
        text="Комментарий и прикреплённые к нему файлы будут удалены."
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteComment(deleting);
          if (!result.ok) toast.push(result.error, "err");
          setDeleting(null);
        }}
      />
    </section>
  );
}
