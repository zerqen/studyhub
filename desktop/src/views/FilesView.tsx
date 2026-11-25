import { useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import type { AttachmentDto, DesktopState, LectureDto, NoteDto, TaskDto } from "../../electron/types";
import { formatShortDate } from "../lib/date";
import {
  buildFileFolders,
  extBadge,
  filterAndSortFiles,
  formatBytes,
  isRecentAttachment,
  type FileKind,
  type FileSort,
} from "../lib/files-view";

const KINDS: [FileKind, string][] = [
  ["all", "Все"],
  ["pdf", "PDF"],
  ["docs", "Документы"],
  ["images", "Фото"],
  ["audio", "Аудио"],
  ["zip", "Архивы"],
];

export function FilesView({
  state,
  busyAttachmentId,
  isUploading,
  onOpenAttachment,
  onRevealAttachment,
  onUploadToFolder,
  onDeleteAttachment,
  onOpenLecture,
  onOpenTask,
  onOpenNote,
  onOpenSubject,
}: {
  state: DesktopState;
  busyAttachmentId: string | null;
  isUploading: boolean;
  onOpenAttachment: (att: AttachmentDto) => void;
  onRevealAttachment: (att: AttachmentDto) => void;
  onUploadToFolder: (subjectId: string | null) => void;
  onDeleteAttachment: (att: AttachmentDto) => void;
  onOpenLecture: (lec: LectureDto) => void;
  onOpenTask: (task: TaskDto) => void;
  onOpenNote: (note: NoteDto) => void;
  onOpenSubject: (id: string) => void;
}) {
  const { snapshot, cachedAttachmentIds } = state;
  const cachedSet = useMemo(() => new Set(cachedAttachmentIds), [cachedAttachmentIds]);

  const [folder, setFolder] = useState<string>(() =>
    snapshot.attachments.some((a) => isRecentAttachment(a.createdAt)) ? "recent" : "all",
  );
  const [kind, setKind] = useState<FileKind>("all");
  const [sort, setSort] = useState<FileSort>("new");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AttachmentDto | null>(null);

  const folders = useMemo(() => buildFileFolders(snapshot.attachments, snapshot.subjects), [snapshot.attachments, snapshot.subjects]);
  const recentCount = useMemo(() => snapshot.attachments.filter((a) => isRecentAttachment(a.createdAt)).length, [snapshot.attachments]);
  const looseCount = useMemo(() => snapshot.attachments.filter((a) => a.folder === "loose").length, [snapshot.attachments]);

  const rows = useMemo(
    () => filterAndSortFiles(snapshot.attachments, folder, kind, sort, query),
    [snapshot.attachments, folder, kind, sort, query],
  );

  const subjectsById = useMemo(() => new Map(snapshot.subjects.map((s) => [s.id, s])), [snapshot.subjects]);
  const lecturesById = useMemo(() => new Map(snapshot.lectures.map((l) => [l.id, l])), [snapshot.lectures]);
  const tasksById = useMemo(() => new Map(snapshot.tasks.map((t) => [t.id, t])), [snapshot.tasks]);
  const notesById = useMemo(() => new Map(snapshot.notes.map((n) => [n.id, n])), [snapshot.notes]);

  const activeSubjectId = folder !== "recent" && folder !== "all" && folder !== "loose" && !query.trim() ? folder : null;
  const title = query.trim()
    ? "Поиск"
    : folder === "recent"
      ? "Недавние"
      : folder === "all"
        ? "Все файлы"
        : folder === "loose"
          ? "Не прикреплено"
          : folders.find((f) => f.id === folder)?.label ?? "Файлы";

  function jumpToSource(att: AttachmentDto) {
    if (att.lectureId && lecturesById.has(att.lectureId)) return onOpenLecture(lecturesById.get(att.lectureId)!);
    if (att.taskId && tasksById.has(att.taskId)) return onOpenTask(tasksById.get(att.taskId)!);
    if (att.noteId && notesById.has(att.noteId)) return onOpenNote(notesById.get(att.noteId)!);
    if (att.subjectId && subjectsById.has(att.subjectId)) return onOpenSubject(att.subjectId);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="heading mr-2 text-3xl">Файлы</h1>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по всем файлам — название, предмет, задача"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-8 text-sm outline-none focus:border-accent"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => onUploadToFolder(activeSubjectId)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isUploading ? "Загрузка…" : activeSubjectId ? `Загрузить в «${title}»` : "Загрузить"}
        </button>
      </div>

      <div className="flex items-start gap-5">
        <aside className="card sticky top-4 w-64 shrink-0 p-2.5">
          <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Быстро</div>
          {[
            { id: "recent", label: "Недавние", color: "#2D5BD2", n: recentCount },
            { id: "all", label: "Все файлы", color: "#1D2130", n: snapshot.attachments.length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFolder(item.id);
                setQuery("");
              }}
              className={`flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm ${
                folder === item.id && !query.trim() ? "bg-accent-soft font-semibold text-accent" : "hover:bg-subtle"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: item.color }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="text-xs text-muted">{item.n}</span>
            </button>
          ))}

          {folders.length > 0 ? (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Предметы</div>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFolder(f.id);
                    setQuery("");
                  }}
                  className={`flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm ${
                    folder === f.id && !query.trim() ? "bg-accent-soft font-semibold text-accent" : "hover:bg-subtle"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: f.color ?? "#2D5BD2" }} />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <span className="text-xs text-muted">{f.count}</span>
                </button>
              ))}
            </>
          ) : null}

          {looseCount > 0 ? (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Без места</div>
              <button
                type="button"
                onClick={() => {
                  setFolder("loose");
                  setQuery("");
                }}
                className={`flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm ${
                  folder === "loose" && !query.trim() ? "bg-accent-soft font-semibold text-accent" : "hover:bg-subtle"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-sm bg-muted/50" />
                <span className="min-w-0 flex-1 truncate">Не прикреплено</span>
                <span className="text-xs text-muted">{looseCount}</span>
              </button>
            </>
          ) : null}
        </aside>

        <section className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="heading mr-auto text-xl">
              {title} <span className="font-sans text-sm font-normal text-muted">{rows.length}</span>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={`h-8 rounded-full border px-3 text-xs ${
                    kind === id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as FileSort)}
              className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs outline-none"
            >
              <option value="new">Сначала новые</option>
              <option value="name">По названию</option>
              <option value="size">По размеру</option>
            </select>
          </div>

          <div className="card divide-y divide-line overflow-hidden">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">
                {query.trim() ? "Ничего не нашлось" : "Здесь пока нет файлов"}
              </p>
            ) : (
              rows.map((att) => {
                const isBusy = busyAttachmentId === att.id;
                const isCached = cachedSet.has(att.id);
                const canJump =
                  Boolean(att.lectureId && lecturesById.has(att.lectureId)) ||
                  Boolean(att.taskId && tasksById.has(att.taskId)) ||
                  Boolean(att.noteId && notesById.has(att.noteId)) ||
                  Boolean(att.subjectId && subjectsById.has(att.subjectId));

                return (
                  <div key={att.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-subtle/40">
                    <button
                      type="button"
                      onClick={() => onOpenAttachment(att)}
                      className="grid h-8 w-12 shrink-0 place-items-center rounded-lg bg-accent-soft text-[11px] font-bold text-accent"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : extBadge(att.originalName)}
                    </button>
                    <button type="button" onClick={() => onOpenAttachment(att)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium text-fg hover:text-accent">{att.originalName}</div>
                      <div className="truncate text-xs text-muted">
                        {att.folder !== "loose" && att.folderName ? `${att.folderName} · ` : ""}
                        {att.whereLabel} · {formatShortDate(att.createdAt)}
                        {isCached ? <span className="ml-1.5 text-success">· Оффлайн</span> : null}
                      </div>
                    </button>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">{formatBytes(att.size)}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {canJump ? (
                        <button
                          type="button"
                          title="Перейти к источнику"
                          onClick={() => jumpToSource(att)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-accent hover:bg-accent-soft"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Показать в Проводнике"
                        onClick={() => onRevealAttachment(att)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Удалить"
                        onClick={() => setPendingDelete(att)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setPendingDelete(null)}>
          <div className="card w-full max-w-md space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="heading text-xl">Удалить файл?</h3>
            <p className="text-sm text-muted">Файл «{pendingDelete.originalName}» будет удалён с сервера и из локального кэша.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="rounded-xl border border-line px-4 py-2 text-sm">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAttachment(pendingDelete);
                  setPendingDelete(null);
                }}
                className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
