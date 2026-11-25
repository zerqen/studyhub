import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { AttachmentDto, SubjectDto, TaskDto } from "../../electron/types";
import { AttachmentList } from "./AttachmentList";

const STAGE_TEMPLATES: Record<string, string[]> = {
  LAB: ["Прочитать методичку", "Теория в конспект", "Подготовить таблицы", "Выполнить на паре", "Расчёты и графики", "Оформить отчёт", "Защитить"],
  TEST: ["Составить список тем", "Повторить конспекты", "Прорешать типовые задачи", "Решить пробный вариант", "Разобрать ошибки"],
  DRAWING: ["Получить задание", "Эскиз", "Чертёж", "Проверить по методичке", "Сдать"],
};

const KINDS = [
  ["HOMEWORK", "ДЗ"],
  ["LAB", "Лаба"],
  ["TEST", "КР"],
  ["DRAWING", "Чертёж"],
  ["TASK", "Другое"],
];

const PRIORITIES = [
  ["LOW", "Низкий"],
  ["MEDIUM", "Обычный"],
  ["HIGH", "Высокий"],
  ["CRITICAL", "Срочный"],
];

export function TaskModal({
  existingTask,
  subjects,
  attachments,
  cachedIds,
  busyAttachmentId,
  isUploading,
  initialDueDate,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onToggleDone,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUploadFile,
  onOpenAttachment,
  onDeleteAttachment,
}: {
  existingTask: TaskDto | null;
  subjects: SubjectDto[];
  attachments: AttachmentDto[];
  cachedIds: ReadonlySet<string>;
  busyAttachmentId: string | null;
  isUploading: boolean;
  initialDueDate?: string | null;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string | null;
    subjectId: string | null;
    dueDate: string | null;
    dueTime: string | null;
    priority: string;
    kind: string;
    stages: string[];
  }) => void;
  onUpdate: (
    taskId: string,
    patch: { title: string; description: string | null; subjectId: string | null; dueDate: string | null; dueTime: string | null; priority: string; kind: string },
  ) => void;
  onDelete: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subId: string) => void;
  onDeleteSubtask: (subId: string) => void;
  onUploadFile: () => void;
  onOpenAttachment: (att: AttachmentDto) => void;
  onDeleteAttachment: (att: AttachmentDto) => void;
}) {
  const [title, setTitle] = useState(existingTask?.title ?? "");
  const [description, setDescription] = useState(existingTask?.description ?? "");
  const [kind, setKind] = useState(existingTask?.kind ?? "HOMEWORK");
  const [subjectId, setSubjectId] = useState<string>(existingTask?.subjectId ?? "");
  const [dueDate, setDueDate] = useState(existingTask?.dueDate?.slice(0, 10) ?? initialDueDate ?? "");
  const [dueTime, setDueTime] = useState(existingTask?.dueTime ?? "");
  const [priority, setPriority] = useState(existingTask?.priority ?? "MEDIUM");
  const [useTemplate, setUseTemplate] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const dueIso = dueDate.trim() ? `${dueDate.trim()}T00:00:00.000Z` : null;
    const cleanTime = /^\d{2}:\d{2}$/.test(dueTime.trim()) ? dueTime.trim() : null;
    const cleanDesc = description.trim() || null;
    const cleanSubj = subjectId || null;

    if (existingTask) {
      onUpdate(existingTask.id, {
        title: title.trim(),
        description: cleanDesc,
        subjectId: cleanSubj,
        dueDate: dueIso,
        dueTime: cleanTime,
        priority,
        kind,
      });
    } else {
      onCreate({
        title: title.trim(),
        description: cleanDesc,
        subjectId: cleanSubj,
        dueDate: dueIso,
        dueTime: cleanTime,
        priority,
        kind,
        stages: useTemplate ? STAGE_TEMPLATES[kind] ?? [] : [],
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="heading text-xl">{existingTask ? "Задача" : "Новая задача"}</h2>
          <div className="flex items-center gap-1.5">
            {existingTask ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggleDone(existingTask.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    existingTask.status === "DONE" ? "border-success bg-success/10 text-success" : "border-line text-fg"
                  }`}
                >
                  {existingTask.status === "DONE" ? "Сделано" : "Отметить"}
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

        <form onSubmit={save} className="flex-1 space-y-3.5 overflow-y-auto p-5">
          <input
            type="text"
            required
            autoFocus={!existingTask}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название задачи"
            className="h-10 w-full rounded-xl border border-line bg-bg/50 px-3 text-sm font-medium outline-none focus:border-accent"
          />

          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setKind(val)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  kind === val ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="col-span-3 h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent sm:col-span-1"
            >
              <option value="">Без предмета</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="h-9 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPriority(val)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  priority === val ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание или заметка к задаче…"
            className="w-full rounded-xl border border-line bg-bg/50 p-3 text-sm outline-none focus:border-accent"
          />

          {!existingTask && STAGE_TEMPLATES[kind] ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} />
              Добавить шаблон этапов ({STAGE_TEMPLATES[kind].length} шт.)
            </label>
          ) : null}

          <button
            type="submit"
            disabled={!title.trim()}
            className="h-10 w-full rounded-xl bg-accent text-sm font-medium text-accent-fg hover:opacity-95 disabled:opacity-40"
          >
            {existingTask ? "Сохранить изменения" : "Создать задачу"}
          </button>

          {existingTask ? (
            <>
              <div className="border-t border-line pt-3">
                <div className="mb-2 text-sm font-semibold">Этапы ({existingTask.subtasks.length})</div>
                <div className="space-y-1.5">
                  {existingTask.subtasks.map((st) => {
                    const done = st.status === "DONE";
                    return (
                      <div key={st.id} className="flex items-center gap-2 rounded-xl bg-subtle/60 px-3 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => onToggleSubtask(existingTask.id, st.id)}
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                            done ? "border-accent bg-accent text-white" : "border-muted"
                          }`}
                        >
                          {done ? <Check className="h-3 w-3" /> : null}
                        </button>
                        <span className={`flex-1 ${done ? "text-muted line-through" : ""}`}>{st.title}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteSubtask(st.id)}
                          className="text-muted hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newSubtask.trim()) {
                          onAddSubtask(existingTask.id, newSubtask);
                          setNewSubtask("");
                        }
                      }
                    }}
                    placeholder="Новый этап…"
                    className="h-9 flex-1 rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubtask.trim()) {
                        onAddSubtask(existingTask.id, newSubtask);
                        setNewSubtask("");
                      }
                    }}
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-subtle px-3 text-sm font-medium hover:bg-accent-soft hover:text-accent"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-line pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Файлы ({attachments.length})</span>
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
            </>
          ) : null}
        </form>

        {confirmDelete && existingTask ? (
          <div className="border-t border-line bg-urgent-soft/60 px-5 py-3 flex items-center justify-between text-sm">
            <span>Удалить задачу безвозвратно?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1 hover:bg-surface">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(existingTask.id);
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
