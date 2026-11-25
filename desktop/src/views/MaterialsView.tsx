import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Pin, Plus, Sigma } from "lucide-react";
import type { AttachmentDto, DesktopState, LectureDto, NoteDto, SubjectDto, TaskDto } from "../../electron/types";
import { AttachmentList } from "../components/AttachmentList";
import { FormulaSheetModal } from "../components/FormulaSheetModal";
import { MarkdownView } from "../components/MarkdownView";
import { formatShortDate } from "../lib/date";

export function MaterialsView({
  state,
  selectedSubjectId,
  onSelectSubject,
  onOpenNote,
  onCreateNote,
  onOpenLecture,
  onCreateLecture,
  onOpenTask,
  busyAttachmentId,
  uploadingKey,
  onOpenAttachment,
  onRevealAttachment,
  onUploadSubjectFile,
  onDeleteAttachment,
}: {
  state: DesktopState;
  selectedSubjectId: string | null;
  onSelectSubject: (id: string | null) => void;
  onOpenNote: (note: NoteDto) => void;
  onCreateNote: (subjectId: string | null) => void;
  onOpenLecture: (lecture: LectureDto) => void;
  onCreateLecture: (subjectId: string | null) => void;
  onOpenTask: (task: TaskDto) => void;
  busyAttachmentId: string | null;
  uploadingKey: string | null;
  onOpenAttachment: (att: AttachmentDto) => void;
  onRevealAttachment: (att: AttachmentDto) => void;
  onUploadSubjectFile: (subjectId: string) => void;
  onDeleteAttachment: (att: AttachmentDto) => void;
}) {
  const { snapshot, cachedAttachmentIds } = state;
  const cachedSet = useMemo(() => new Set(cachedAttachmentIds), [cachedAttachmentIds]);
  const [section, setSection] = useState<"subjects" | "notes" | "lectures">("subjects");
  const [subjectTab, setSubjectTab] = useState<"lectures" | "notes" | "files" | "tasks" | "questions">("lectures");
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [formulaSubject, setFormulaSubject] = useState<SubjectDto | null>(null);
  const [lectureFilter, setLectureFilter] = useState<string>("");

  const subjectsById = useMemo(() => new Map(snapshot.subjects.map((s) => [s.id, s])), [snapshot.subjects]);
  const selectedSubject = selectedSubjectId ? subjectsById.get(selectedSubjectId) ?? null : null;

  if (selectedSubject) {
    const lectures = snapshot.lectures.filter((l) => l.subjectId === selectedSubject.id);
    const notes = snapshot.notes.filter((n) => n.subjectId === selectedSubject.id);
    const files = snapshot.attachments.filter((a) => a.folder === selectedSubject.id || a.subjectId === selectedSubject.id);
    const tasks = snapshot.tasks.filter((t) => t.subjectId === selectedSubject.id && t.status !== "CANCELLED");
    const questions = snapshot.questions.filter((q) => q.subjectId === selectedSubject.id);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectSubject(null)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface hover:border-accent/50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="heading text-2xl">{selectedSubject.emoji} {selectedSubject.name}</h1>
              {selectedSubject.examDate ? (
                <p className="text-xs text-muted">Экзамен: {formatShortDate(selectedSubject.examDate)}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFormulaSubject(selectedSubject)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent-soft px-3.5 text-sm font-medium text-accent hover:opacity-90"
          >
            <Sigma className="h-4 w-4" />
            Лист формул
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["lectures", `Лекции (${lectures.length})`],
            ["notes", `Заметки (${notes.length})`],
            ["files", `Файлы (${files.length})`],
            ["tasks", `Задачи (${tasks.length})`],
            ["questions", `Вопросы (${questions.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubjectTab(id as typeof subjectTab)}
              className={`rounded-full border px-3.5 py-1 text-sm ${
                subjectTab === id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {subjectTab === "lectures" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onCreateLecture(selectedSubject.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg"
              >
                <Plus className="h-4 w-4" /> Новая лекция
              </button>
            </div>
            {lectures.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted">Лекций пока нет</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {lectures.map((lec) => (
                  <button
                    key={lec.id}
                    type="button"
                    onClick={() => onOpenLecture(lec)}
                    className="card p-4 text-left hover:border-accent/40"
                  >
                    <div className="text-xs font-medium text-accent">
                      {lec.number != null ? `Лекция ${lec.number}` : "Лекция"}
                      {lec.date ? ` · ${formatShortDate(lec.date)}` : ""}
                    </div>
                    <div className="mt-1 font-medium">{lec.title}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {subjectTab === "notes" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onCreateNote(selectedSubject.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg"
              >
                <Plus className="h-4 w-4" /> Новая заметка
              </button>
            </div>
            {notes.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted">Заметок по предмету нет</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {notes.map((n) => (
                  <button key={n.id} type="button" onClick={() => onOpenNote(n)} className="card p-4 text-left hover:border-accent/40">
                    <div className="flex items-center gap-2 font-medium">
                      {n.pinned ? <Pin className="h-3.5 w-3.5 text-accent" /> : null}
                      <span className="truncate">{n.title || "Без названия"}</span>
                    </div>
                    {n.content.trim() ? <p className="mt-1 line-clamp-2 text-xs text-muted">{n.content}</p> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {subjectTab === "files" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={uploadingKey === `subject:${selectedSubject.id}`}
                onClick={() => onUploadSubjectFile(selectedSubject.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {uploadingKey === `subject:${selectedSubject.id}` ? "Загрузка…" : "Загрузить файл"}
              </button>
            </div>
            {files.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted">Файлов по предмету нет</div>
            ) : (
              <AttachmentList
                attachments={files}
                cachedIds={cachedSet}
                busyId={busyAttachmentId}
                onOpen={onOpenAttachment}
                onReveal={onRevealAttachment}
                onDelete={onDeleteAttachment}
              />
            )}
          </div>
        ) : null}

        {subjectTab === "tasks" ? (
          <div className="card divide-y divide-line">
            {tasks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">Задач нет</p>
            ) : (
              tasks.map((t) => (
                <button key={t.id} type="button" onClick={() => onOpenTask(t)} className="flex w-full justify-between px-4 py-3 text-left text-sm hover:bg-subtle/40">
                  <span className={t.status === "DONE" ? "text-muted line-through" : "font-medium"}>{t.title}</span>
                  <span className="text-xs text-muted">{t.dueDate ? formatShortDate(t.dueDate) : "Без срока"}</span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {subjectTab === "questions" ? (
          <div className="space-y-2.5">
            {questions.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted">Вопросов к экзамену пока нет</div>
            ) : (
              questions.map((q) => {
                const open = expandedQ === q.id;
                return (
                  <div key={q.id} className="card p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedQ(open ? null : q.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="font-medium">{q.text}</span>
                      {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
                    </button>
                    {open && q.answer ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <MarkdownView content={q.answer} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {formulaSubject ? (
          <FormulaSheetModal
            subject={formulaSubject}
            lectures={lectures}
            questions={questions}
            onClose={() => setFormulaSubject(null)}
          />
        ) : null}
      </div>
    );
  }

  const filteredLectures = snapshot.lectures.filter((l) => !lectureFilter || l.subjectId === lectureFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading text-3xl">Конспекты</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCreateNote(null)}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:border-accent/50"
          >
            <Plus className="h-4 w-4" /> Заметка
          </button>
          <button
            type="button"
            onClick={() => onCreateLecture(lectureFilter || null)}
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-accent px-3 text-sm font-medium text-accent-fg"
          >
            <Plus className="h-4 w-4" /> Лекция
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          ["subjects", `Предметы (${snapshot.subjects.length})`],
          ["notes", `Заметки (${snapshot.notes.length})`],
          ["lectures", `Лекции (${snapshot.lectures.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id as typeof section)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              section === id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "subjects" ? (
        snapshot.subjects.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Предметов пока нет</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {snapshot.subjects.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubject(sub.id)}
                className="card flex items-center gap-3 p-4 text-left hover:border-accent/40"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-subtle text-xl">{sub.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{sub.name}</div>
                  <div className="text-xs text-muted">
                    Вопросов изучено {sub.questionsLearned}/{sub.questionsTotal} · прогресс {sub.progress}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : null}

      {section === "notes" ? (
        snapshot.notes.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Заметок пока нет</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {snapshot.notes.map((n) => {
              const sub = n.subjectId ? subjectsById.get(n.subjectId) : undefined;
              return (
                <button key={n.id} type="button" onClick={() => onOpenNote(n)} className="card p-4 text-left hover:border-accent/40">
                  <div className="flex items-center gap-2 font-semibold">
                    {n.pinned ? <Pin className="h-3.5 w-3.5 text-accent" /> : null}
                    <span className="truncate">{n.title || "Без названия"}</span>
                  </div>
                  {sub ? <div className="mt-0.5 text-xs text-accent">{sub.emoji} {sub.name}</div> : null}
                  {n.content.trim() ? <p className="mt-1 line-clamp-2 text-xs text-muted">{n.content}</p> : null}
                </button>
              );
            })}
          </div>
        )
      ) : null}

      {section === "lectures" ? (
        <div className="space-y-3">
          {snapshot.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLectureFilter("")}
                className={`rounded-full border px-3 py-1 text-xs ${!lectureFilter ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
              >
                Все предметы
              </button>
              {snapshot.subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setLectureFilter(s.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    lectureFilter === s.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
                  }`}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          ) : null}

          {filteredLectures.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">Лекций пока нет</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredLectures.map((l) => {
                const sub = subjectsById.get(l.subjectId);
                return (
                  <button key={l.id} type="button" onClick={() => onOpenLecture(l)} className="card p-4 text-left hover:border-accent/40">
                    <div className="text-xs font-medium text-accent">
                      {[l.number != null ? `Лекция ${l.number}` : null, sub?.name, l.date ? formatShortDate(l.date) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="mt-1 font-semibold">{l.title}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
