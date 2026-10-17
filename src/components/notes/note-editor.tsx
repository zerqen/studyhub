"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Check, Code, Eye, Heading2, Italic, List, ListTodo, Loader2, Pencil, Pin, Quote, Sigma, SquareSigma, Trash2 } from "lucide-react";
import { autosaveNote, createNote, deleteNote, updateNote } from "@/actions/notes";
import { NOTE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/field";
import { useToast } from "../ui/toast";
import { ConfirmDialog } from "../ui/modal";
import { FileUploader } from "../files/uploader";
import { Markdown } from "../ui/markdown";

type NoteInput = {
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

const tools = [
  { icon: Heading2, label: "Заголовок", before: "## ", after: "" },
  { icon: Bold, label: "Жирный", before: "**", after: "**" },
  { icon: Italic, label: "Курсив", before: "*", after: "*" },
  { icon: List, label: "Список", before: "- ", after: "" },
  { icon: ListTodo, label: "Чек-лист", before: "- [ ] ", after: "" },
  { icon: Code, label: "Код", before: "`", after: "`" },
  { icon: Quote, label: "Цитата", before: "> ", after: "" },
  { icon: Sigma, label: "Формула", before: "$", after: "$" },
  { icon: SquareSigma, label: "Формула блоком", before: "\n$$\n", after: "\n$$\n" },
];

export function NoteEditor({
  note,
  subjects,
  initialTaskId,
  initialQuestionId,
  defaultSubjectId,
  onDone,
}: {
  note?: NoteInput;
  subjects: { id: string; name: string }[];
  initialTaskId?: string;
  initialQuestionId?: string;
  defaultSubjectId?: string;
  onDone?: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [color, setColor] = useState(note?.color ?? NOTE_COLORS[0]);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? defaultSubjectId ?? "");
  const [tags, setTags] = useState(note?.tags?.map((t) => t.tag.name).join(", ") ?? "");
  const [preview, setPreview] = useState(Boolean(note?.content));
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  const toast = useToast();
  const router = useRouter();

  // Автосохранение текста существующей заметки (без перерисовки страницы)
  const noteId = note?.id;
  useEffect(() => {
    if (!noteId) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaving("saving");
    const t = setTimeout(async () => {
      const r = await autosaveNote(noteId, title, content);
      setSaving(r.ok ? "saved" : "idle");
      if (!r.ok) toast.push(r.error, "err");
    }, 700);
    return () => clearTimeout(t);
  }, [noteId, title, content, toast]);

  function applyTool(before: string, after: string) {
    const el = body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  async function save() {
    setBusy(true);
    const payload = {
      title: title.trim() || "Без названия",
      content,
      color,
      pinned,
      subjectId: subjectId || null,
      taskId: note?.taskId ?? initialTaskId ?? null,
      questionId: note?.questionId ?? initialQuestionId ?? null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    if (note) {
      const res = await updateNote(note.id, payload);
      if (!res.ok) toast.push(res.error, "err");
      else toast.push("Сохранено");
    } else {
      const res = await createNote(payload);
      if (!res.ok) toast.push(res.error, "err");
      else {
        toast.push("Заметка создана");
        onDone?.();
        if (res.data?.id) router.push(`/notes?open=${res.data.id}`);
      }
    }
    setBusy(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="h-1" style={{ background: color }} />
      <div className="px-5 pt-4 sm:px-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Без названия"
          aria-label="Заголовок"
          className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-muted/60"
          autoFocus={!note}
        />
      </div>

      <div className="flex items-center gap-0.5 border-b border-line px-4 py-2 sm:px-5">
        {!preview
          ? tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                onClick={() => applyTool(t.before, t.after)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-fg"
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))
          : null}
        <div className="ml-auto flex items-center gap-2">
          {note ? (
            <span className="flex items-center gap-1 text-xs text-muted">
              {saving === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : saving === "saved" ? <Check className="h-3 w-3" /> : null}
              {saving === "saving" ? "Сохраняю…" : saving === "saved" ? "Сохранено" : ""}
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? "Редактировать" : "Просмотр"}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-72 cursor-text px-5 py-4 sm:px-6" onDoubleClick={() => setPreview(false)}>
          {content ? <Markdown className="text-[15px]">{content}</Markdown> : <p className="text-muted">Пусто. Двойной клик — начать писать.</p>}
        </div>
      ) : (
        <textarea
          ref={body}
          rows={14}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown: ## заголовок, **жирный**, - список, - [ ] задача. Формулы: $a^2+b^2$ или $$\int_0^1 f(x)\,dx$$"
          className="block min-h-72 w-full resize-y bg-transparent px-5 py-4 font-mono text-[13.5px] leading-relaxed outline-none placeholder:text-muted/60 sm:px-6"
        />
      )}

      <div className="space-y-3 border-t border-line bg-subtle/30 px-5 py-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Предмет">
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Теги через запятую" aria-label="Теги" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label="Цвет метки"
                className={cn("h-5 w-5 rounded-full transition-transform", color === c ? "scale-110 ring-2 ring-fg/30 ring-offset-2 ring-offset-surface" : "hover:scale-110")}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            className={cn("ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] transition-colors", pinned ? "bg-accent/10 text-accent" : "text-muted hover:bg-subtle")}
          >
            <Pin className="h-3.5 w-3.5" /> {pinned ? "Закреплена" : "Закрепить"}
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {note ? <FileUploader parent={{ noteId: note.id }} compact camera /> : null}
            {note ? (
              <Button type="button" variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => setConfirm(true)} aria-label="Удалить">
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={save} loading={busy}>
              {note ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
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
        }}
      />
    </div>
  );
}
