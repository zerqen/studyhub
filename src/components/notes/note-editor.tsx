"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Check, Code, Heading2, Italic, List, ListTodo, Loader2, Quote, Sigma, SquareSigma, Table, Trash2 } from "lucide-react";
import { autosaveNote, createNote, deleteNote, updateNote } from "@/actions/notes";
import { NOTE_COLOR_NAMES, NOTE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
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
  { icon: Table, label: "Таблица", before: "\n| a | b |\n|---|---|\n| ", after: " |  |\n" },
];

export function NoteEditor({
  note,
  subjects,
  initialTaskId,
  initialQuestionId,
  defaultSubjectId,
  onDone,
  page = false,
}: {
  note?: NoteInput;
  subjects: { id: string; name: string }[];
  initialTaskId?: string;
  initialQuestionId?: string;
  defaultSubjectId?: string;
  onDone?: () => void;
  /** Полноразмерный редактор на странице «Заметки» (режим «Текст + вид»); иначе — компактный в окне */
  page?: boolean;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [color, setColor] = useState(note?.color ?? NOTE_COLORS[0]);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? defaultSubjectId ?? "");
  const [tags, setTags] = useState(note?.tags?.map((t) => t.tag.name).join(", ") ?? "");
  // На странице: "split" — текст и вид рядом; в окне: "view" — только вид
  const [mode, setMode] = useState<"edit" | "split" | "view">(page ? (note?.content ? "split" : "edit") : "edit");
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

  const modes = page
    ? ([["edit", "Текст"], ["split", "Текст + вид"]] as const)
    : ([["edit", "Текст"], ["view", "Вид"]] as const);
  const showText = mode !== "view";
  const showView = mode !== "edit";
  const field = "h-[38px] rounded-[10px] border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface" style={{ borderTop: `4px solid ${color}` }}>
      <div className={cn("pb-2.5", page ? "px-[22px] pt-[18px]" : "px-5 pt-4")}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Без названия"
          aria-label="Заголовок"
          className={cn("heading w-full bg-transparent outline-none placeholder:text-muted/50 focus-visible:outline-none focus-visible:ring-0", page ? "h-12 text-[24px] sm:text-[28px]" : "h-10 text-[22px]")}
          autoFocus={!note}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-y border-[#ECE8DF] bg-[#F8F6F1] px-3 py-1.5 dark:border-line dark:bg-subtle sm:px-4">
        {showText
          ? tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                onClick={() => applyTool(t.before, t.after)}
                className="grid h-[34px] min-w-[34px] place-items-center rounded-lg text-[#424655] transition-colors hover:bg-surface hover:text-fg dark:text-muted"
              >
                <t.icon className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ))
          : null}
        <div className="ml-auto flex items-center gap-2.5">
          {note ? (
            <span className="flex items-center gap-1 text-xs text-muted" aria-live="polite">
              {saving === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : saving === "saved" ? <Check className="h-3 w-3" /> : null}
              {saving === "saving" ? "Сохраняю…" : saving === "saved" ? "Сохранено" : ""}
            </span>
          ) : null}
          <div role="group" aria-label="Режим" className="flex gap-1 rounded-[9px] bg-[#E9E5DC] p-[3px] dark:bg-bg">
            {modes.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={cn("h-[30px] rounded-[7px] px-2.5 text-xs font-semibold transition-colors", mode === id ? "bg-surface shadow-sm" : "text-fg/75 hover:text-fg")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("grid flex-1", page ? "min-h-[420px]" : "min-h-72", showText && showView && "lg:grid-cols-2")}>
        {showText ? (
          <textarea
            ref={body}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Markdown: ## заголовок, **жирный**, - список, - [ ] задача. Формулы: $a^2+b^2$ или $$\int_0^1 f(x)\,dx$$"
            aria-label="Текст заметки"
            className={cn(
              "block w-full resize-none bg-transparent font-mono text-sm leading-[1.7] outline-none placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-0",
              page ? "min-h-[420px] px-[22px] py-[18px]" : "min-h-72 px-5 py-4",
              showView && "max-lg:min-h-[260px]",
            )}
          />
        ) : null}
        {showView ? (
          <div
            aria-label="Просмотр"
            onDoubleClick={() => !showText && setMode("edit")}
            className={cn(
              "flex min-w-0 flex-col gap-2.5 bg-[#FCFBF8] dark:bg-subtle/40",
              page ? "px-[22px] py-[18px]" : "px-5 py-4",
              showText && "border-[#ECE8DF] max-lg:border-t lg:border-l dark:border-line",
            )}
          >
            {showText ? <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted/90">Как будет выглядеть</span> : null}
            <span className="heading text-[22px]">{title.trim() || "Без названия"}</span>
            {content ? (
              <Markdown className="text-[15px] leading-[1.65]">{content}</Markdown>
            ) : (
              <p className="text-[15px] text-muted">{showText ? "Начни писать слева — здесь появится оформленный текст с формулами." : "Пусто. Двойной клик — начать писать."}</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-t border-[#ECE8DF] bg-[#F8F6F1] px-4 py-3 dark:border-line dark:bg-subtle sm:px-[18px]">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Предмет" className={cn(field, "max-w-[14rem]")}>
          <option value="">Без предмета</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Теги через запятую" aria-label="Теги" className={cn(field, "min-w-0 flex-[1_1_160px]")} />
        <div role="group" aria-label="Цвет" className="flex gap-1.5">
          {NOTE_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-label={`Цвет ${NOTE_COLOR_NAMES[i]}`}
              aria-pressed={color === c}
              className="h-[22px] w-[22px] rounded-full transition-transform hover:scale-110"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${c}` : undefined }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-pressed={pinned}
          onClick={() => setPinned(!pinned)}
          className={cn(
            "h-[38px] rounded-[10px] border px-3 text-[13px] font-semibold transition-colors",
            pinned ? "border-accent bg-accent-soft text-[#234AB0] dark:text-accent" : "border-line bg-surface text-[#424655] hover:border-fg/30 dark:text-muted",
          )}
        >
          {pinned ? "Закреплена" : "Закрепить"}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {note ? <FileUploader parent={{ noteId: note.id }} compact camera /> : null}
          {note ? (
            <Button type="button" variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => setConfirm(true)} aria-label="Удалить заметку">
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button type="button" onClick={save} loading={busy} className="h-[38px] rounded-[10px] px-[18px]">
            {note ? "Сохранить" : "Создать"}
          </Button>
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
