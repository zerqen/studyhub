import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  CloudOff,
  FolderOpen,
  Home,
  RefreshCw,
  School,
  Search,
  Settings,
} from "lucide-react";
import type { AttachmentDto, DesktopState } from "../electron/types";
import { GlobalSearchModal } from "./components/GlobalSearchModal";
import { LectureModal } from "./components/LectureModal";
import { NoteModal } from "./components/NoteModal";
import { TaskModal } from "./components/TaskModal";
import { CalendarView } from "./views/CalendarView";
import { FilesView } from "./views/FilesView";
import { HomeView } from "./views/HomeView";
import { LoginView } from "./views/LoginView";
import { MaterialsView } from "./views/MaterialsView";
import { QuickAddPopup } from "./views/QuickAddPopup";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";
import { TasksView } from "./views/TasksView";

type Tab = "home" | "tasks" | "materials" | "files" | "calendar" | "review" | "settings";

export function App() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskDueDate, setCreateTaskDueDate] = useState<string | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [createNoteSubjectId, setCreateNoteSubjectId] = useState<string | null>(null);

  const [readingLectureId, setReadingLectureId] = useState<string | null>(null);
  const [showCreateLecture, setShowCreateLecture] = useState(false);
  const [createLectureSubjectId, setCreateLectureSubjectId] = useState<string | null>(null);

  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [transcribingAttId, setTranscribingAttId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isQuickAddWindow = typeof window !== "undefined" && window.location.hash === "#quick-add";

  useEffect(() => {
    void window.studyhub.getState().then(setState);
    return window.studyhub.onStateChange(setState);
  }, []);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    const dark =
      state.prefs.themeMode === "dark" ||
      (state.prefs.themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  }, [state]);

  useEffect(() => {
    if (isQuickAddWindow) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isQuickAddWindow]);

  function notify(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3500);
  }

  async function runBusy(id: string, fn: () => Promise<void>) {
    setBusyAttachmentId(id);
    try {
      await fn();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Ошибка работы с файлом");
    } finally {
      setBusyAttachmentId(null);
    }
  }

  async function runUpload(key: string, parentType: string | null, parentId: string | null, mode: "all" | "audio" = "all") {
    setUploadingKey(key);
    try {
      const uploaded = await window.studyhub.pickAndUploadAttachment(parentType, parentId, mode);
      if (uploaded) notify(`Файл «${uploaded.originalName}» загружен`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Ошибка загрузки файла");
    } finally {
      setUploadingKey(null);
    }
  }

  const cachedSet = useMemo(() => new Set(state?.cachedAttachmentIds ?? []), [state?.cachedAttachmentIds]);

  if (!state) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">Загрузка StudyHub…</div>;
  }

  if (isQuickAddWindow) {
    return <QuickAddPopup state={state} />;
  }

  if (!state.session.isLoggedIn) {
    return <LoginView />;
  }

  const { snapshot } = state;
  const editingTask = editingTaskId ? snapshot.tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const editingNote = editingNoteId ? snapshot.notes.find((n) => n.id === editingNoteId) ?? null : null;
  const readingLecture = readingLectureId ? snapshot.lectures.find((l) => l.id === readingLectureId) ?? null : null;

  const navItems: { id: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { id: "home", label: "Главная", icon: Home },
    { id: "tasks", label: "Задачи", icon: CheckSquare, badge: snapshot.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length },
    { id: "materials", label: "Конспекты", icon: BookOpen },
    { id: "files", label: "Файлы", icon: FolderOpen, badge: snapshot.attachments.length },
    { id: "calendar", label: "Календарь", icon: CalendarDays },
    { id: "review", label: "Повтор", icon: School },
    { id: "settings", label: "Настройки", icon: Settings },
  ];

  const handleOpenAttachment = (att: AttachmentDto) => runBusy(att.id, () => window.studyhub.openAttachment(att.id));
  const handleRevealAttachment = (att: AttachmentDto) => runBusy(att.id, () => window.studyhub.revealAttachment(att.id));
  const handleDeleteAttachment = (att: AttachmentDto) =>
    runBusy(att.id, async () => {
      await window.studyhub.deleteAttachment(att.id);
      notify("Файл удалён");
    });

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-fg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface p-3.5">
        <div className="mb-4 flex items-center justify-between px-2">
          <span className="heading text-2xl">StudyHub</span>
          <button
            type="button"
            disabled={snapshot.isSyncing}
            onClick={() => void window.studyhub.syncNow()}
            title="Синхронизировать"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-fg"
          >
            <RefreshCw className={`h-4 w-4 ${snapshot.isSyncing ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="mb-4 flex h-9 items-center justify-between rounded-xl border border-line bg-bg/60 px-3 text-xs text-muted hover:border-accent/50"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" /> Поиск…
          </span>
          <kbd className="rounded bg-subtle px-1.5 py-0.5 text-[10px]">Ctrl+K</kbd>
        </button>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  if (item.id !== "materials") setSelectedSubjectId(null);
                }}
                className={`flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
                  active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-subtle hover:text-fg"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && item.badge > 0 ? <span className="text-xs opacity-75">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 rounded-xl bg-subtle/70 p-2.5 text-xs text-muted">
          {snapshot.lastError ? (
            <div className="flex items-center gap-1.5 text-urgent">
              <CloudOff className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{snapshot.lastError}</span>
            </div>
          ) : (
            <div>Оффлайн-кэш готов · Очередь: {snapshot.pendingOpsCount}</div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {tab === "home" ? (
            <HomeView
              state={state}
              onToggleTask={(id) => void window.studyhub.toggleTask(id)}
              onPostponeTask={(id) => void window.studyhub.postponeTask(id)}
              onQuickCreate={(p) =>
                void window.studyhub.createTask({
                  title: p.title,
                  subjectId: p.subjectId,
                  dueDate: p.dueDateIso,
                  dueTime: p.dueTime,
                  kind: p.kind,
                  priority: "MEDIUM",
                })
              }
              onOpenTask={(t) => setEditingTaskId(t.id)}
              onOpenCreateTask={() => {
                setCreateTaskDueDate(null);
                setShowCreateTask(true);
              }}
              onOpenTab={(t) => setTab(t)}
              onOpenSubject={(id) => {
                setSelectedSubjectId(id);
                setTab("materials");
              }}
            />
          ) : null}

          {tab === "tasks" ? (
            <TasksView
              state={state}
              onToggleTask={(id) => void window.studyhub.toggleTask(id)}
              onPostponeTask={(id) => void window.studyhub.postponeTask(id)}
              onQuickCreate={(p) =>
                void window.studyhub.createTask({
                  title: p.title,
                  subjectId: p.subjectId,
                  dueDate: p.dueDateIso,
                  dueTime: p.dueTime,
                  kind: p.kind,
                  priority: "MEDIUM",
                })
              }
              onOpenTask={(t) => setEditingTaskId(t.id)}
              onOpenCreate={() => {
                setCreateTaskDueDate(null);
                setShowCreateTask(true);
              }}
            />
          ) : null}

          {tab === "materials" ? (
            <MaterialsView
              state={state}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={setSelectedSubjectId}
              onOpenNote={(n) => setEditingNoteId(n.id)}
              onCreateNote={(sid) => {
                setCreateNoteSubjectId(sid);
                setShowCreateNote(true);
              }}
              onOpenLecture={(l) => setReadingLectureId(l.id)}
              onCreateLecture={(sid) => {
                setCreateLectureSubjectId(sid);
                setShowCreateLecture(true);
              }}
              onOpenTask={(t) => setEditingTaskId(t.id)}
              busyAttachmentId={busyAttachmentId}
              uploadingKey={uploadingKey}
              onOpenAttachment={handleOpenAttachment}
              onRevealAttachment={handleRevealAttachment}
              onUploadSubjectFile={(sid) => void runUpload(`subject:${sid}`, "subject", sid)}
              onDeleteAttachment={handleDeleteAttachment}
            />
          ) : null}

          {tab === "files" ? (
            <FilesView
              state={state}
              busyAttachmentId={busyAttachmentId}
              isUploading={uploadingKey === "files:all"}
              onOpenAttachment={handleOpenAttachment}
              onRevealAttachment={handleRevealAttachment}
              onUploadToFolder={(sid) => void runUpload("files:all", sid ? "subject" : null, sid)}
              onDeleteAttachment={handleDeleteAttachment}
              onOpenLecture={(l) => setReadingLectureId(l.id)}
              onOpenTask={(t) => setEditingTaskId(t.id)}
              onOpenNote={(n) => setEditingNoteId(n.id)}
              onOpenSubject={(id) => {
                setSelectedSubjectId(id);
                setTab("materials");
              }}
            />
          ) : null}

          {tab === "calendar" ? (
            <CalendarView
              state={state}
              onToggleLessons={(show) => void window.studyhub.updatePrefs({ showLessons: show })}
              onToggleTask={(id) => void window.studyhub.toggleTask(id)}
              onOpenTask={(t) => setEditingTaskId(t.id)}
              onCreateTaskOnDate={(iso) => {
                setCreateTaskDueDate(iso);
                setShowCreateTask(true);
              }}
            />
          ) : null}

          {tab === "review" ? (
            <ReviewView state={state} onReviewQuestion={(id, g) => void window.studyhub.reviewQuestion(id, g)} />
          ) : null}

          {tab === "settings" ? (
            <SettingsView
              state={state}
              onSyncNow={() => void window.studyhub.syncNow()}
              onLogout={() => void window.studyhub.logout()}
            />
          ) : null}
        </div>
      </main>

      {(showCreateTask || editingTask) ? (
        <TaskModal
          existingTask={editingTask}
          subjects={snapshot.subjects}
          attachments={editingTask ? snapshot.attachments.filter((a) => a.taskId === editingTask.id) : []}
          cachedIds={cachedSet}
          busyAttachmentId={busyAttachmentId}
          isUploading={Boolean(editingTask && uploadingKey === `task:${editingTask.id}`)}
          initialDueDate={createTaskDueDate}
          onClose={() => {
            setShowCreateTask(false);
            setEditingTaskId(null);
          }}
          onCreate={(input) => void window.studyhub.createTask(input)}
          onUpdate={(id, patch) => void window.studyhub.updateTask(id, patch)}
          onDelete={(id) => void window.studyhub.deleteTask(id)}
          onToggleDone={(id) => void window.studyhub.toggleTask(id)}
          onAddSubtask={(id, title) => void window.studyhub.addSubtask(id, title)}
          onToggleSubtask={(tid, sid) => void window.studyhub.toggleSubtask(tid, sid)}
          onDeleteSubtask={(sid) => void window.studyhub.deleteSubtask(sid)}
          onUploadFile={() => editingTask && void runUpload(`task:${editingTask.id}`, "task", editingTask.id)}
          onOpenAttachment={handleOpenAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      ) : null}

      {(showCreateNote || editingNote) ? (
        <NoteModal
          existingNote={editingNote}
          subjects={snapshot.subjects}
          initialSubjectId={createNoteSubjectId}
          attachments={editingNote ? snapshot.attachments.filter((a) => a.noteId === editingNote.id) : []}
          cachedIds={cachedSet}
          busyAttachmentId={busyAttachmentId}
          isUploading={Boolean(editingNote && uploadingKey === `note:${editingNote.id}`)}
          onClose={() => {
            setShowCreateNote(false);
            setEditingNoteId(null);
          }}
          onCreate={(input) => void window.studyhub.createNote(input)}
          onUpdate={(id, input) => void window.studyhub.updateNote(id, input)}
          onDelete={(id) => void window.studyhub.deleteNote(id)}
          onUploadFile={() => editingNote && void runUpload(`note:${editingNote.id}`, "note", editingNote.id)}
          onOpenAttachment={handleOpenAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      ) : null}

      {(showCreateLecture || readingLecture) ? (
        <LectureModal
          existingLecture={readingLecture}
          subjects={snapshot.subjects}
          initialSubjectId={createLectureSubjectId}
          attachments={readingLecture ? snapshot.attachments.filter((a) => a.lectureId === readingLecture.id) : []}
          cachedIds={cachedSet}
          busyAttachmentId={busyAttachmentId}
          isUploading={Boolean(readingLecture && uploadingKey === `lecture:${readingLecture.id}`)}
          transcribingAttachmentId={transcribingAttId}
          onClose={() => {
            setShowCreateLecture(false);
            setReadingLectureId(null);
          }}
          onCreate={(input) => void window.studyhub.createLecture(input)}
          onUpdate={(id, input) => void window.studyhub.updateLecture(id, input)}
          onDelete={(id) => void window.studyhub.deleteLecture(id)}
          onUploadFile={(mode) => readingLecture && void runUpload(`lecture:${readingLecture.id}`, "lecture", readingLecture.id, mode)}
          onOpenAttachment={handleOpenAttachment}
          onRevealAttachment={handleRevealAttachment}
          onDeleteAttachment={handleDeleteAttachment}
          onTranscribeAudio={async (att) => {
            if (!readingLecture) return;
            setTranscribingAttId(att.id);
            try {
              await window.studyhub.transcribeLectureAudio(readingLecture.id, att.id);
              notify("Расшифровка готова!");
            } catch (err) {
              notify(err instanceof Error ? err.message : "Ошибка расшифровки");
            } finally {
              setTranscribingAttId(null);
            }
          }}
        />
      ) : null}

      {showSearch ? (
        <GlobalSearchModal
          snapshot={snapshot}
          cachedIds={cachedSet}
          busyAttachmentId={busyAttachmentId}
          onClose={() => setShowSearch(false)}
          onOpenSubject={(id) => {
            setSelectedSubjectId(id);
            setTab("materials");
          }}
          onOpenTask={(t) => setEditingTaskId(t.id)}
          onOpenNote={(n) => setEditingNoteId(n.id)}
          onOpenLecture={(l) => setReadingLectureId(l.id)}
          onOpenAttachment={handleOpenAttachment}
        />
      ) : null}

      {toastMsg ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg shadow-lg">
          {toastMsg}
        </div>
      ) : null}
    </div>
  );
}
