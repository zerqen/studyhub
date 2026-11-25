import { useState } from "react";
import { Edit3, FileAudio, FilePlus2, Trash2, X } from "lucide-react";
import type { AttachmentDto, LectureDto, SubjectDto } from "../../electron/types";
import { formatShortDate } from "../lib/date";
import { AttachmentList } from "./AttachmentList";
import { MarkdownView } from "./MarkdownView";

export function LectureModal({
  existingLecture,
  subjects,
  initialSubjectId,
  attachments,
  cachedIds,
  busyAttachmentId,
  isUploading,
  transcribingAttachmentId,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onUploadFile,
  onOpenAttachment,
  onRevealAttachment,
  onDeleteAttachment,
  onTranscribeAudio,
}: {
  existingLecture: LectureDto | null;
  subjects: SubjectDto[];
  initialSubjectId?: string | null;
  attachments: AttachmentDto[];
  cachedIds: ReadonlySet<string>;
  busyAttachmentId: string | null;
  isUploading: boolean;
  transcribingAttachmentId: string | null;
  onClose: () => void;
  onCreate: (input: { subjectId: string; title: string; number: number | null; date: string | null; summary: string }) => void;
  onUpdate: (lectureId: string, input: { title: string; number: number | null; date: string | null; summary: string; transcript: string }) => void;
  onDelete: (lectureId: string) => void;
  onUploadFile: (mode: "all" | "audio") => void;
  onOpenAttachment: (att: AttachmentDto) => void;
  onRevealAttachment: (att: AttachmentDto) => void;
  onDeleteAttachment: (att: AttachmentDto) => void;
  onTranscribeAudio: (att: AttachmentDto) => void;
}) {
  const [subjectId, setSubjectId] = useState(existingLecture?.subjectId ?? initialSubjectId ?? subjects[0]?.id ?? "");
  const [title, setTitle] = useState(existingLecture?.title ?? "");
  const [numberStr, setNumberStr] = useState(existingLecture?.number != null ? String(existingLecture.number) : "");
  const [dateStr, setDateStr] = useState(existingLecture?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState(existingLecture?.summary ?? "");
  const [transcript, setTranscript] = useState(existingLecture?.transcript ?? "");
  const [editing, setEditing] = useState(!existingLecture);
  const [tab, setTab] = useState<"summary" | "files" | "transcript">(() => {
    if (existingLecture?.summary?.trim()) return "summary";
    if (attachments.length > 0 || !existingLecture?.transcript?.trim()) return "files";
    return "transcript";
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subject = subjects.find((s) => s.id === (existingLecture?.subjectId ?? subjectId));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || (!existingLecture && !subjectId)) return;
    const cleanNum = numberStr.trim() ? Number(numberStr.trim()) : null;
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim()) ? `${dateStr.trim()}T00:00:00.000Z` : null;
    if (existingLecture) {
      onUpdate(existingLecture.id, {
        title: title.trim(),
        number: cleanNum,
        date: cleanDate,
        summary,
        transcript,
      });
      setEditing(false);
    } else {
      onCreate({
        subjectId,
        title: title.trim(),
        number: cleanNum,
        date: cleanDate,
        summary,
      });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line px-5 py-3.5">
          <div>
            {existingLecture ? (
              <div className="text-xs font-medium text-accent">
                {[existingLecture.number != null ? `Лекция ${existingLecture.number}` : null, subject?.name, existingLecture.date ? formatShortDate(existingLecture.date) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
            <h2 className="heading text-xl">{existingLecture ? existingLecture.title : "Новая лекция"}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {existingLecture ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(!editing)}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${editing ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle"}`}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <form onSubmit={save} className="space-y-3">
              {!existingLecture ? (
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название лекции"
                className="h-10 w-full rounded-xl border border-line bg-bg/50 px-3 text-sm font-medium outline-none focus:border-accent"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={numberStr}
                  onChange={(e) => setNumberStr(e.target.value)}
                  placeholder="Номер (опц.)"
                  className="h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
                />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
                />
              </div>

              <textarea
                rows={8}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Конспект (Markdown и формулы)"
                className="w-full rounded-xl border border-line bg-bg/50 p-3 font-mono text-sm outline-none focus:border-accent"
              />

              {existingLecture ? (
                <textarea
                  rows={5}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Расшифровка"
                  className="w-full rounded-xl border border-line bg-bg/50 p-3 font-mono text-xs outline-none focus:border-accent"
                />
              ) : null}

              <div className="flex gap-2">
                {existingLecture ? (
                  <button type="button" onClick={() => setEditing(false)} className="h-10 flex-1 rounded-xl border border-line text-sm">
                    Отмена
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={!title.trim() || (!existingLecture && !subjectId)}
                  className="h-10 flex-1 rounded-xl bg-accent text-sm font-medium text-accent-fg disabled:opacity-40"
                >
                  {existingLecture ? "Сохранить" : "Создать лекцию"}
                </button>
              </div>
            </form>
          ) : existingLecture ? (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-line pb-3">
                <button
                  type="button"
                  onClick={() => setTab("files")}
                  className={`rounded-full border px-3.5 py-1 text-xs font-medium ${tab === "files" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
                >
                  Файлы ({attachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("transcript")}
                  className={`rounded-full border px-3.5 py-1 text-xs font-medium ${tab === "transcript" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
                >
                  Расшифровка {existingLecture.transcript.trim() ? "•" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("summary")}
                  className={`rounded-full border px-3.5 py-1 text-xs font-medium ${tab === "summary" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
                >
                  Конспект
                </button>
              </div>

              {tab === "files" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => onUploadFile("all")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-soft py-2 text-sm font-medium text-accent hover:opacity-90 disabled:opacity-50"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      {isUploading ? "Загрузка…" : "+ PDF / файл"}
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => onUploadFile("audio")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-sm font-medium hover:border-accent/50 disabled:opacity-50"
                    >
                      <FileAudio className="h-4 w-4 text-accent" />
                      + Аудио
                    </button>
                  </div>

                  {attachments.length === 0 ? (
                    <p className="text-sm text-muted">Прикрепите PDF, материалы или аудиозапись лекции (до 300 МБ).</p>
                  ) : (
                    <AttachmentList
                      attachments={attachments}
                      cachedIds={cachedIds}
                      busyId={busyAttachmentId}
                      transcribingId={transcribingAttachmentId}
                      onOpen={onOpenAttachment}
                      onReveal={onRevealAttachment}
                      onDelete={onDeleteAttachment}
                      onTranscribe={onTranscribeAudio}
                    />
                  )}
                </div>
              ) : null}

              {tab === "transcript" ? (
                existingLecture.transcript.trim() ? (
                  <div className="space-y-2 text-sm">
                    {existingLecture.transcript.split("\n").map((line, i) => {
                      const m = /^<!--file:[^|]*\|(.*)-->\s*$/.exec(line.trim());
                      if (m) {
                        return (
                          <div key={i} className="inline-block rounded-md bg-subtle px-2.5 py-1 text-xs font-medium text-accent">
                            {m[1]}
                          </div>
                        );
                      }
                      return line.trim() ? <p key={i}>{line}</p> : null;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Расшифровки пока нет. Загрузите аудио во вкладке «Файлы» и нажмите «Расшифровать аудио (ИИ)».</p>
                )
              ) : null}

              {tab === "summary" ? (
                existingLecture.summary.trim() ? (
                  <MarkdownView content={existingLecture.summary} />
                ) : (
                  <p className="text-sm text-muted">Конспект этой лекции пока пуст. Нажмите карандаш вверху, чтобы добавить текст.</p>
                )
              ) : null}
            </div>
          ) : null}
        </div>

        {confirmDelete && existingLecture ? (
          <div className="flex items-center justify-between border-t border-line bg-urgent-soft/60 px-5 py-3 text-sm">
            <span>Удалить лекцию и её файлы?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1 hover:bg-surface">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(existingLecture.id);
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
