"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { addComment, deleteComment, updateComment } from "@/actions/tasks";
import { formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { FileGrid } from "../files/file-grid";
import { uploadFile } from "../files/uploader";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  attachments?: { id: string; originalName: string; mimeType: string; size: number }[];
};

function CommentText({ content }: { content: string }) {
  return <Markdown className="text-sm">{content}</Markdown>;
}

export function CommentThread({ taskId, questionId, comments, authorName }: { taskId?: string; questionId?: string; comments: Comment[]; authorName?: string }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = comments.filter((c) => !hidden.has(c.id));
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
        await Promise.all(files.map((file) => uploadFile(file, { commentId: result.data!.id })));
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
    <section aria-label="Комментарии" className="card flex flex-col gap-3.5 rounded-[14px] px-4 py-[18px] sm:px-5">
      <h2 className="heading text-xl">
        Комментарии {visible.length ? <span className="font-sans text-sm font-normal text-muted">{visible.length}</span> : null}
      </h2>

      {visible.length ? (
        <ul>
          {visible.map((comment) => (
            <li key={comment.id} className="group grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-t border-[#ECE8DF] py-3 dark:border-line">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent" aria-hidden>
                {(authorName ?? "Я").slice(0, 1).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>
                  {authorName ? <b className="font-semibold text-fg">{authorName}</b> : null}
                  {authorName ? " · " : ""}
                  {formatDate(comment.createdAt, "d MMMM, HH:mm")}
                </span>
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
                    <button
                      className="hover:text-danger"
                      onClick={() =>
                        toast.undoable({
                          text: "Комментарий удалён",
                          hide: () => setHidden((h) => new Set(h).add(comment.id)),
                          restore: () =>
                            setHidden((h) => {
                              const n = new Set(h);
                              n.delete(comment.id);
                              return n;
                            }),
                          commit: () => deleteComment(comment.id),
                        })
                      }
                    >
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
                <div className="max-w-[460px] rounded-[10px] border border-line bg-[#F8F6F1] px-2 py-1 dark:bg-subtle">
                  <FileGrid files={comment.attachments} compact />
                </div>
              ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-[#F8F6F1] p-3 transition-[border-color,box-shadow] focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10 dark:bg-subtle">
        <label htmlFor={`comment-${taskId ?? questionId}`} className="sr-only">
          Новый комментарий
        </label>
        <textarea
          id={`comment-${taskId ?? questionId}`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
          placeholder="Мысль, ссылка или формула $x^2$… Ctrl+Enter — отправить"
          rows={3}
          className="w-full resize-y bg-transparent px-1 text-[15px] leading-relaxed outline-none placeholder:text-muted"
        />
        {files.length ? (
          <div className="flex flex-wrap gap-1.5 px-1">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[13px]">
                {f.name}
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Убрать файл">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg/75 transition-colors focus-within:ring-2 focus-within:ring-accent/40 hover:text-fg">
            <input type="file" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            <Paperclip className="h-3.5 w-3.5" /> Файл
          </label>
          <Button loading={busy} disabled={!content.trim()} onClick={() => void submit()} className="h-[38px] rounded-lg px-[18px] font-semibold">
            Отправить
          </Button>
        </div>
      </div>

    </section>
  );
}
