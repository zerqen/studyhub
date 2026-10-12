"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { autosaveNote, createNote, deleteNote, updateNote } from "@/actions/notes";
import { NOTE_COLORS } from "@/lib/constants";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "../ui/modal";
import { FileUploader } from "../files/uploader";

function wrap(sel: HTMLTextAreaElement, before: string, after = "") {
  const start = sel.selectionStart;
  const end = sel.selectionEnd;
  const v = sel.value;
  return v.slice(0, start) + before + v.slice(start, end) + after + v.slice(end);
}

export function NoteEditor({
  note,
  subjects,
  initialTaskId,
  initialQuestionId,
}: {
  note?: {
    id: string;
    title: string;
    content: string;
    color: string;
    pinned: boolean;
    subjectId: string | null;
    taskId?: string | null;
    questionId?: string | null;
    tags?: { tag: { name: string } }[];
  };
  subjects: { id: string; name: string }[];
  initialTaskId?: string;
  initialQuestionId?: string;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [color, setColor] = useState(note?.color ?? "#fde68a");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? "");
  const [taskId] = useState(note?.taskId ?? initialTaskId ?? "");
  const [questionId] = useState(note?.questionId ?? initialQuestionId ?? "");
  const [tags, setTags] = useState(note?.tags?.map((t) => t.tag.name).join(", ") ?? "");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => {
      void autosaveNote(note.id, title, content);
    }, 800);
    return () => clearTimeout(t);
  }, [note, title, content]);

  const toolbar = useMemo(
    () => [
      { l: "H", fn: (el: HTMLTextAreaElement) => wrap(el, "## ") },
      { l: "B", fn: (el: HTMLTextAreaElement) => wrap(el, "**", "**") },
      { l: "I", fn: (el: HTMLTextAreaElement) => wrap(el, "*", "*") },
      { l: "•", fn: (el: HTMLTextAreaElement) => wrap(el, "- ") },
      { l: "☐", fn: (el: HTMLTextAreaElement) => wrap(el, "- [ ] ") },
      { l: "</>", fn: (el: HTMLTextAreaElement) => wrap(el, "`", "`") },
      { l: "“", fn: (el: HTMLTextAreaElement) => wrap(el, "> ") },
    ],
    [],
  );

  async function saveMeta() {
    const payload = {
      title: title || "Без названия",
      content,
      color,
      pinned,
      subjectId: subjectId || null,
      taskId: taskId || null,
      questionId: questionId || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    if (note) {
      const res = await updateNote(note.id, payload);
      if (!res.ok) toast.push(res.error, "err");
      else toast.push("Заметка сохранена");
    } else {
      const res = await createNote(payload);
      if (!res.ok) toast.push(res.error, "err");
      else {
        toast.push("Заметка создана");
        if (res.data?.id) router.push(`/notes?open=${res.data.id}`);
      }
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-[var(--bg-elev)] p-4 dark:border-white/10" style={{ borderTop: `6px solid ${color}` }}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
      <div className="flex flex-wrap gap-1">
        {toolbar.map((b) => (
          <button
            key={b.l}
            type="button"
            className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10"
            onClick={() => {
              const el = document.getElementById("note-body") as HTMLTextAreaElement | null;
              if (!el) return;
              setContent(b.fn(el));
            }}
          >
            {b.l}
          </button>
        ))}
        <button type="button" className="ml-auto text-xs underline" onClick={() => setPreview((p) => !p)}>
          {preview ? "Редактор" : "Просмотр"}
        </button>
      </div>
      {preview ? (
        <div className="prose-note min-h-40 rounded-xl bg-white/50 p-3 dark:bg-black/20">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "_Пусто_"}</ReactMarkdown>
        </div>
      ) : (
        <Textarea id="note-body" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Предмет">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Теги">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="h-6 w-6 rounded-full"
            style={{ background: c, outline: color === c ? "2px solid #111" : undefined }}
            onClick={() => setColor(c)}
          />
        ))}
        <label className="ml-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Закрепить
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={saveMeta}>
          Сохранить
        </Button>
        {note ? <FileUploader parent={{ noteId: note.id }} compact /> : null}
        {note ? (
          <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
            Удалить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Удалить заметку?"
        text="Это действие нельзя отменить."
        onConfirm={async () => {
          if (!note) return;
          await deleteNote(note.id);
          setConfirm(false);
          toast.push("Заметка удалена");
          router.push("/notes");
          router.refresh();
        }}
      />
    </div>
  );
}
