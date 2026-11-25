import { useState } from "react";
import { Pin, Plus, Trash2, X } from "lucide-react";
import type { AttachmentDto, NoteDto, SubjectDto } from "../../electron/types";
import { AttachmentList } from "./AttachmentList";
import { MarkdownView } from "./MarkdownView";

const NOTE_COLORS = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fecdd3", "#e9d5ff", "#fed7aa"];

export function NoteModal({
  existingNote,
  subjects,
  initialSubjectId,
  attachments,
  cachedIds,
  busyAttachmentId,
  isUploading,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onUploadFile,
  onOpenAttachment,
  onDeleteAttachment,
}: {
  existingNote: NoteDto | null;
  subjects: SubjectDto[];
  initialSubjectId?: string | null;
  attachments: AttachmentDto[];
  cachedIds: ReadonlySet<string>;
  busyAttachmentId: string | null;
  isUploading: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; content: string; subjectId: string | null; color: string; pinned: boolean }) => void;
  onUpdate: (noteId: string, input: { title: string; content: string; subjectId: string | null; color: string; pinned: boolean }) => void;
  onDelete: (noteId: string) => void;
  onUploadFile: () => void;
  onOpenAttachment: (att: AttachmentDto) => void;
  onDeleteAttachment: (att: AttachmentDto) => void;
}) {
  const [title, setTitle] = useState(existingNote?.title ?? "");
  const [content, setContent] = useState(existingNote?.content ?? "");
  const [subjectId, setSubjectId] = useState<string>(existingNote?.subjectId ?? initialSubjectId ?? "");
  const [color, setColor] = useState(existingNote?.color ?? NOTE_COLORS[0]);
  const [pinned, setPinned] = useState(existingNote?.pinned ?? false);
  const [preview, setPreview] = useState(Boolean(existingNote && existingNote.content.trim()));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: title.trim() || "Без названия",
      content,
      subjectId: subjectId || null,
      color,
      pinned,
    };
    if (existingNote) onUpdate(existingNote.id, payload);
    else onCreate(payload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="heading text-xl">{existingNote ? "Заметка" : "Новая заметка"}</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${!preview ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"}`}
            >
              Редактор
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${preview ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"}`}
            >
              Чтение
            </button>
            {existingNote ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={save} className="flex-1 space-y-3.5 overflow-y-auto p-5">
          {preview ? (
            <div className="space-y-3">
              <h3 className="heading text-2xl">{title.trim() || "Без названия"}</h3>
              <hr className="border-line" />
              {content.trim() ? <MarkdownView content={content} /> : <p className="text-sm text-muted">Текст заметки пуст</p>}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заголовок заметки"
                className="h-10 w-full rounded-xl border border-line bg-bg/50 px-3 text-sm font-medium outline-none focus:border-accent"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">Общая заметка</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  {NOTE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      style={{ background: hex }}
                      className={`h-6 w-6 rounded-full border-2 ${color === hex ? "border-fg scale-110" : "border-transparent"}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setPinned(!pinned)}
                    className={`ml-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${
                      pinned ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
                    }`}
                  >
                    <Pin className="h-3.5 w-3.5" />
                    Закрепить
                  </button>
                </div>
              </div>

              <textarea
                rows={11}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Текст заметки (Markdown и формулы $...$ / $$...$$)"
                className="w-full rounded-xl border border-line bg-bg/50 p-3 font-mono text-sm outline-none focus:border-accent"
              />

              <button type="submit" className="h-10 w-full rounded-xl bg-accent text-sm font-medium text-accent-fg">
                Сохранить заметку
              </button>
            </>
          )}

          {existingNote ? (
            <div className="border-t border-line pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Вложения ({attachments.length})</span>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={onUploadFile}
                  className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2.5 py-1 text-xs font-medium hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isUploading ? "Загрузка…" : "Файл"}
                </button>
              </div>
              <AttachmentList
                attachments={attachments}
                cachedIds={cachedIds}
                busyId={busyAttachmentId}
                onOpen={onOpenAttachment}
                onDelete={onDeleteAttachment}
              />
            </div>
          ) : null}
        </form>

        {confirmDelete && existingNote ? (
          <div className="flex items-center justify-between border-t border-line bg-urgent-soft/60 px-5 py-3 text-sm">
            <span>Удалить заметку?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1 hover:bg-surface">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(existingNote.id);
                  onClose();
                }}
                className="rounded-lg bg-danger px-3 py-1 font-medium text-white"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
