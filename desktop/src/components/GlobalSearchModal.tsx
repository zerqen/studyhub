import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { AttachmentDto, DesktopSnapshot, LectureDto, NoteDto, TaskDto } from "../../electron/types";
import { matchFile } from "../lib/files-view";
import { AttachmentList } from "./AttachmentList";

export function GlobalSearchModal({
  snapshot,
  cachedIds,
  busyAttachmentId,
  onClose,
  onOpenSubject,
  onOpenTask,
  onOpenNote,
  onOpenLecture,
  onOpenAttachment,
}: {
  snapshot: DesktopSnapshot;
  cachedIds: ReadonlySet<string>;
  busyAttachmentId: string | null;
  onClose: () => void;
  onOpenSubject: (id: string) => void;
  onOpenTask: (task: TaskDto) => void;
  onOpenNote: (note: NoteDto) => void;
  onOpenLecture: (lecture: LectureDto) => void;
  onOpenAttachment: (att: AttachmentDto) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subjects = useMemo(
    () => (q ? snapshot.subjects.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6) : []),
    [snapshot.subjects, q],
  );
  const tasks = useMemo(
    () =>
      q
        ? snapshot.tasks
            .filter((t) => t.status !== "CANCELLED" && (t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false)))
            .slice(0, 8)
        : [],
    [snapshot.tasks, q],
  );
  const notes = useMemo(
    () => (q ? snapshot.notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)).slice(0, 8) : []),
    [snapshot.notes, q],
  );
  const lectures = useMemo(
    () => (q ? snapshot.lectures.filter((l) => l.title.toLowerCase().includes(q) || l.summary.toLowerCase().includes(q)).slice(0, 8) : []),
    [snapshot.lectures, q],
  );
  const questions = useMemo(
    () =>
      q
        ? snapshot.questions
            .filter((x) => x.text.toLowerCase().includes(q) || (x.answer?.toLowerCase().includes(q) ?? false))
            .slice(0, 8)
        : [],
    [snapshot.questions, q],
  );
  const files = useMemo(() => (q ? snapshot.attachments.filter((a) => matchFile(q, a)).slice(0, 8) : []), [snapshot.attachments, q]);

  const empty = !subjects.length && !tasks.length && !notes.length && !lectures.length && !questions.length && !files.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-6 pt-16 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск оффлайн по задачам, заметкам, лекциям, вопросам и файлам…"
            className="h-8 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/70"
          />
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-subtle">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!q ? (
            <p className="text-sm text-muted">
              Мгновенный поиск работает оффлайн по {snapshot.tasks.length} задачам, {snapshot.notes.length} заметкам,{" "}
              {snapshot.lectures.length} лекциям, {snapshot.questions.length} вопросам и {snapshot.attachments.length} файлам.
            </p>
          ) : empty ? (
            <p className="py-8 text-center text-sm text-muted">По запросу «{query}» ничего не найдено</p>
          ) : (
            <>
              {subjects.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Предметы</div>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSubject(s.id);
                        }}
                        className="rounded-xl border border-line bg-subtle px-3 py-1.5 text-sm font-medium hover:border-accent"
                      >
                        {s.emoji} {s.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {tasks.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Задачи</div>
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTask(t);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent/50"
                    >
                      <span className={t.status === "DONE" ? "text-muted line-through" : "font-medium"}>{t.title}</span>
                      <span className="text-xs text-muted">{t.kind}</span>
                    </button>
                  ))}
                </section>
              ) : null}

              {notes.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Заметки</div>
                  {notes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNote(n);
                      }}
                      className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm font-medium hover:border-accent/50"
                    >
                      {n.title || "Без названия"}
                    </button>
                  ))}
                </section>
              ) : null}

              {lectures.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Лекции</div>
                  {lectures.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLecture(l);
                      }}
                      className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm font-medium hover:border-accent/50"
                    >
                      {l.number != null ? `Лекция ${l.number} · ` : ""}
                      {l.title}
                    </button>
                  ))}
                </section>
              ) : null}

              {questions.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Вопросы</div>
                  {questions.map((x) => (
                    <div key={x.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                      {x.text}
                    </div>
                  ))}
                </section>
              ) : null}

              {files.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Файлы</div>
                  <AttachmentList
                    attachments={files}
                    cachedIds={cachedIds}
                    busyId={busyAttachmentId}
                    onOpen={onOpenAttachment}
                  />
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
