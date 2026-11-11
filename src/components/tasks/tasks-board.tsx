"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarClock, ChevronDown, CornerDownRight, ListChecks, MoreHorizontal, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { deleteTask, moveTaskDate, toggleTaskDone } from "@/actions/tasks";
import { updateSubtask } from "@/actions/subtasks";
import { cn } from "@/lib/utils";
import { TASK_KINDS, taskKind } from "@/lib/task-kinds";
import { TASK_PRIORITIES, labelOf } from "@/lib/constants";
import { dueKey, localKey } from "@/lib/task-week";
import { buildDueGroups, dueLabel, isUrgent, type DueEntry } from "@/lib/task-groups";
import { plural } from "@/lib/subject-view";
import { Modal } from "../ui/modal";
import { EmptyState } from "../ui/empty";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";
import { Checkbox } from "./checkbox";
import { QuickAddBar } from "./quick-add";

type Step = { id: string; title: string; status: string; dueDate: string | null; parentId: string | null };

type Task = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  subject: { id: string; name: string; color: string } | null;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  kind?: string;
  subtasks: Step[];
  tags: { tag: { name: string } }[];
  questions: { id: string }[];
  _count: { attachments: number; contextualComments?: number };
};

type View = "due" | "subjects";

const closed = (s: string) => s === "DONE" || s === "CANCELLED";
const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return localKey(new Date(y, m - 1, d + n));
};
/** Колонки таблицы на ПК: отметка, срок, задача, предмет, тип, подзадачи, приоритет, меню */
const COLS = "md:grid-cols-[20px_64px_minmax(0,2.2fr)_minmax(0,1.2fr)_74px_120px_88px_34px]";

export function TasksBoard({
  tasks,
  subjects,
  questions,
  tag,
}: {
  tasks: Task[];
  subjects: { id: string; name: string }[];
  questions: { id: string; text: string; subjectId: string }[];
  tag?: string;
}) {
  const toast = useToast();
  const [view, setView] = useState<View>("due");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Оптимистичные изменения: галочки и переносы видны сразу, сервер догоняет
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({});
  const [taskDue, setTaskDue] = useState<Record<string, string>>({});
  const [stepPatch, setStepPatch] = useState<Record<string, Partial<Step>>>({});

  const live = useMemo<Task[]>(
    () =>
      tasks
        .filter((t) => !hidden.has(t.id))
        .map((t) => ({
          ...t,
          status: taskStatus[t.id] ?? t.status,
          dueDate: taskDue[t.id] ?? t.dueDate,
          subtasks: t.subtasks.map((s) => ({ ...s, ...stepPatch[s.id] })),
        })),
    [tasks, hidden, taskStatus, taskDue, stepPatch],
  );

  // Фильтр по предмету и тегу — до подсчёта типов, чтобы числа на кнопках совпадали со списком
  const scoped = useMemo(
    () =>
      live.filter((t) => {
        if (subject && (subject === "none" ? t.subjectId : t.subjectId !== subject)) return false;
        if (tag && !t.tags.some((x) => x.tag.name === tag)) return false;
        return true;
      }),
    [live, subject, tag],
  );
  const filtered = useMemo(() => scoped.filter((t) => !kind || (t.kind ?? "TASK") === kind), [scoped, kind]);

  const today = new Date();
  const todayKey = localKey(today);
  const openAll = live.filter((t) => !closed(t.status)).length;
  const doneAll = live.filter((t) => t.status === "DONE").length;
  const kindCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of scoped) if (!closed(t.status)) m[t.kind ?? "TASK"] = (m[t.kind ?? "TASK"] ?? 0) + 1;
    return m;
  }, [scoped]);
  const openScoped = scoped.filter((t) => !closed(t.status)).length;

  const groups = useMemo(() => {
    if (view === "due") return buildDueGroups(filtered, today, showDone);
    const byDue = (a: Task, b: Task) => (dueKey(a.dueDate) ?? "9999").localeCompare(dueKey(b.dueDate) ?? "9999");
    const map = new Map<string, { id: string; label: string; range: string; color?: string; urgent: boolean; entries: DueEntry<Task>[] }>();
    for (const t of [...filtered].sort(byDue)) {
      if (closed(t.status) && !(showDone && t.status === "DONE")) continue;
      const id = t.subject?.id ?? "none";
      if (!map.has(id)) map.set(id, { id, label: t.subject?.name ?? "Без предмета", range: "", color: t.subject?.color, urgent: false, entries: [] });
      map.get(id)!.entries.push({ type: "task", task: t, key: dueKey(t.dueDate) });
    }
    return [...map.values()]
      .map((g) => ({ ...g, entries: [...g.entries.filter((e) => !closed(e.task.status)), ...g.entries.filter((e) => closed(e.task.status))] }))
      .sort((a, b) => (a.id === "none" ? 1 : b.id === "none" ? -1 : (a.entries[0].key ?? "9999").localeCompare(b.entries[0].key ?? "9999")));
  }, [view, filtered, showDone, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleTask(task: Task) {
    const next = task.status === "DONE" ? "PLANNED" : "DONE";
    setTaskStatus((o) => ({ ...o, [task.id]: next }));
    const r = await toggleTaskDone(task.id);
    if (!r.ok) {
      toast.push(r.error, "err");
      setTaskStatus((o) => {
        const c = { ...o };
        delete c[task.id];
        return c;
      });
    }
  }

  async function toggleStep(step: Step) {
    const next = step.status === "DONE" ? "PLANNED" : "DONE";
    setStepPatch((p) => ({ ...p, [step.id]: { ...p[step.id], status: next } }));
    const r = await updateSubtask(step.id, { status: next });
    if (!r.ok) toast.push(r.error, "err");
  }

  async function setStepDate(step: Step, date: string) {
    const iso = date ? `${date}T00:00:00.000Z` : null;
    setStepPatch((p) => ({ ...p, [step.id]: { ...p[step.id], dueDate: iso } }));
    const r = await updateSubtask(step.id, { dueDate: date || null });
    if (!r.ok) toast.push(r.error, "err");
  }

  async function move(task: Task, key: string) {
    setTaskDue((d) => ({ ...d, [task.id]: `${key}T00:00:00.000Z` }));
    const r = await moveTaskDate(task.id, key);
    if (!r.ok) toast.push(r.error, "err");
    else toast.push(`Перенесено: ${dueLabel(key, todayKey)}`);
  }

  function remove(task: Task) {
    toast.undoable({
      text: `«${task.title.slice(0, 40)}» удалена`,
      hide: () => setHidden((h) => new Set(h).add(task.id)),
      restore: () =>
        setHidden((h) => {
          const n = new Set(h);
          n.delete(task.id);
          return n;
        }),
      commit: () => deleteTask(task.id),
    });
  }

  const rowProps: RowProps = {
    expanded,
    onExpand: (id) =>
      setExpanded((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    onToggle: toggleTask,
    onToggleStep: toggleStep,
    onStepDate: setStepDate,
    onMove: move,
    onEdit: setEditing,
    onRemove: remove,
    todayKey,
  };

  const kinds = [{ value: "", label: "Все", n: openScoped }, ...TASK_KINDS.map((k) => ({ value: k.value, label: k.label, n: kindCounts[k.value] ?? 0 }))].filter((k) => k.value === "" || k.n > 0 || k.value === kind);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="space-y-1.5">
          <h1 className="heading text-[28px] leading-tight sm:text-[34px]">Задачи</h1>
          <p className="text-sm text-muted">
            {openAll ? `${openAll} ${plural(openAll, "открытая", "открытых", "открытых")}` : "Всё сделано"}
            {live.length ? ` · ${doneAll} из ${live.length} закрыто` : ""}
          </p>
        </div>
        <QuickAddBar subjects={subjects} placeholder="Быстро добавить: «лаба 3 физика до 5.12», «кр линал в среду»" className="w-full sm:max-w-[560px] sm:flex-[0_1_560px]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Группировка" className="flex gap-1 rounded-[10px] bg-[#E9E5DC] p-[3px] dark:bg-subtle">
          {(
            [
              ["due", "По срокам"],
              ["subjects", "По предметам"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn("h-[34px] rounded-lg px-3 text-[13px] transition-colors", view === id ? "bg-surface font-semibold text-fg shadow-card" : "text-fg/75 hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Тип задачи" className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k.value || "all"}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cn("h-8 rounded-full border px-3 text-[13px] transition-colors", kind === k.value ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-fg hover:bg-subtle")}
            >
              {k.label} <span className="text-muted">{k.n}</span>
            </button>
          ))}
        </div>
        {tag ? (
          <Link href="/tasks" className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-[13px] font-medium text-accent">
            #{tag} <X className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          <label htmlFor="tasks-subject" className="sr-only">
            Предмет
          </label>
          <select
            id="tasks-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-[38px] min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-fg sm:max-w-56 sm:flex-none"
          >
            <option value="">Все предметы</option>
            <option value="none">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[13px] text-fg/75">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4" />
            Сделанные
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        tasks.length ? (
          <p className="card px-4 py-8 text-center text-sm text-muted">{kind || subject ? "Таких открытых задач нет" : "Открытых задач нет — всё сделано"}</p>
        ) : (
          <EmptyState icon={ListChecks} title="Задач пока нет" hint="Напиши в строке выше, например: «лаба 3 физика до 5.11»." />
        )
      ) : (
        <section aria-label="Список задач" className="card overflow-hidden rounded-[14px]">
          <div className={cn("hidden items-center gap-3.5 px-[18px] py-2.5 text-xs font-semibold text-muted md:grid", COLS)}>
            <span />
            <span>Срок</span>
            <span>Задача</span>
            <span>Предмет</span>
            <span>Тип</span>
            <span>Подзадачи</span>
            <span>Приоритет</span>
            <span />
          </div>
          {groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-baseline gap-2 border-t border-line bg-[#F8F6F1] px-4 py-2.5 first:border-t-0 dark:bg-subtle md:px-[18px] md:first:border-t">
                {"color" in g && g.color ? <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ background: g.color as string }} /> : null}
                <h2 className={cn("heading text-[15px]", g.urgent && "text-urgent")}>{g.label}</h2>
                <span className="text-xs text-muted">
                  {g.range ? `${g.range} · ` : ""}
                  {g.entries.length}
                </span>
              </div>
              <ul>
                {g.entries.map((e) =>
                  e.type === "task" ? (
                    <TaskRow key={`t-${e.task.id}`} task={e.task} {...rowProps} />
                  ) : (
                    <StepRow key={`s-${e.step.id}`} step={e.step} task={e.task} onToggleStep={toggleStep} todayKey={todayKey} />
                  ),
                )}
              </ul>
            </div>
          ))}
        </section>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Редактировать задачу">
        {editing ? (
          <TaskForm
            id={editing.id}
            subjects={subjects}
            questions={questions}
            initial={{
              title: editing.title,
              description: editing.description ?? "",
              subjectId: editing.subjectId ?? "",
              startDate: editing.startDate?.slice(0, 10) ?? "",
              dueDate: editing.dueDate?.slice(0, 10) ?? "",
              dueTime: editing.dueTime ?? "",
              priority: editing.priority,
              status: editing.status,
              kind: editing.kind ?? "TASK",
              tags: editing.tags.map((t) => t.tag.name).join(", "),
              questionId: editing.questions[0]?.id,
            }}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

type RowProps = {
  expanded: Set<string>;
  onExpand: (id: string) => void;
  onToggle: (t: Task) => void;
  onToggleStep: (s: Step) => void;
  onStepDate: (s: Step, date: string) => void;
  onMove: (t: Task, key: string) => void;
  onEdit: (t: Task) => void;
  onRemove: (t: Task) => void;
  todayKey: string;
};

/** Этап со своей датой раньше сдачи — отдельной строкой в своей неделе */
function StepRow({ step, task, onToggleStep, todayKey }: { step: Step; task: Task; onToggleStep: (s: Step) => void; todayKey: string }) {
  const done = closed(step.status);
  const key = dueKey(step.dueDate);
  const urgent = !done && isUrgent(key, todayKey);
  return (
    <li className={cn("flex items-center gap-3 border-t border-[#ECE8DF] px-4 py-2.5 dark:border-line md:grid md:min-h-12 md:gap-3.5 md:px-[18px] md:py-0", COLS)}>
      <Checkbox checked={done} onChange={() => onToggleStep(step)} size="sm" label={done ? `Вернуть этап: ${step.title}` : `Этап сделан: ${step.title}`} />
      <span className={cn("hidden whitespace-nowrap text-[13px] md:block", urgent ? "font-bold text-urgent" : "text-muted")}>{dueLabel(key, todayKey)}</span>
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 md:col-span-2">
        <span className={cn("flex items-center gap-1.5 truncate text-sm", done && "text-muted line-through")}>
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          {step.title}
        </span>
        <span className="block truncate pl-5 text-xs text-muted">
          <span className={cn("md:hidden", urgent && "font-semibold text-urgent")}>{dueLabel(key, todayKey)} · </span>
          этап задачи «{task.title}»{task.subject ? ` · ${task.subject.name}` : ""}
        </span>
      </Link>
    </li>
  );
}

function TaskRow({ task, expanded, onExpand, onToggle, onToggleStep, onStepDate, onMove, onEdit, onRemove, todayKey }: RowProps & { task: Task }) {
  // Меню рисуется поверх страницы (порталом), чтобы его не обрезала карточка списка
  const [menu, setMenu] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const done = closed(task.status);
  const steps = task.subtasks;
  const stepsDone = steps.filter((s) => closed(s.status)).length;
  const open = expanded.has(task.id);
  const key = dueKey(task.dueDate);
  const urgent = !done && isUrgent(key, todayKey);
  const kindLabel = task.kind && task.kind !== "TASK" ? taskKind(task.kind).label : null;
  const prio = labelOf(TASK_PRIORITIES, task.priority).toLowerCase();
  const highPrio = task.priority === "HIGH" || task.priority === "CRITICAL";
  const comments = task._count.contextualComments ?? 0;
  const desc = task.description?.split("\n").find((l) => l.trim())?.replace(/[#*_`>]/g, "").trim();

  // Свайпы на телефоне: вправо — готово, влево — на завтра
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    if (Math.abs(e.clientY - s.y) > 30 && Math.abs(x) < 30) {
      start.current = null;
      setDx(0);
      return;
    }
    setDx(Math.max(-120, Math.min(120, x)));
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (dx > 90) onToggle(task);
    else if (dx < -90 && !done) onMove(task, addDaysKey(todayKey, 1));
    setDx(0);
  };

  const stepsBar = steps.length ? (
    <button type="button" onClick={() => onExpand(task.id)} aria-expanded={open} aria-label={`Подзадачи: ${stepsDone} из ${steps.length}`} className="flex w-full items-center gap-2 rounded-md text-xs text-muted hover:text-fg">
      <span className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {stepsDone} из {steps.length}
      </span>
      <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", !open && "-rotate-90")} />
    </button>
  ) : null;

  return (
    <li className="relative overflow-hidden border-t border-[#ECE8DF] dark:border-line">
      {dx !== 0 ? (
        <div className={cn("absolute inset-0 flex items-center px-5 text-sm font-medium", dx > 0 ? "justify-start bg-success/15 text-success" : "justify-end bg-accent/15 text-accent")}>
          {dx > 0 ? (done ? "Вернуть" : "Готово") : "На завтра"}
        </div>
      ) : null}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cn("group relative bg-surface transition-colors hover:bg-subtle/40", !dx && "transition-transform")}
      >
        <div className={cn("flex items-start gap-3 px-4 py-3 md:grid md:min-h-[54px] md:items-center md:gap-3.5 md:px-[18px] md:py-1.5", COLS)}>
          <Checkbox checked={done} onChange={() => onToggle(task)} className="mt-0.5 md:mt-0" label={done ? `Вернуть в работу: ${task.title}` : `Выполнено: ${task.title}`} />
          <span className={cn("hidden whitespace-nowrap text-[13px] md:block", urgent ? "font-bold text-urgent" : "text-muted")}>
            {dueLabel(key, todayKey)}
            {task.dueTime ? <span className="block text-[11px] font-normal text-muted">{task.dueTime}</span> : null}
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("truncate text-sm font-medium transition-colors group-hover:text-accent", done && "font-normal text-muted line-through")}>
                {task.title}
                {comments ? <span className="text-xs font-normal text-muted"> · {comments} комм.</span> : null}
                {task._count.attachments ? (
                  <span className="ml-1 inline-flex items-center text-xs font-normal text-muted">
                    <Paperclip className="h-3 w-3" />
                    {task._count.attachments}
                  </span>
                ) : null}
              </span>
              {desc && !done ? <span className="truncate text-xs text-muted">{desc}</span> : null}
            </Link>
            {/* На телефоне — всё одной строкой под названием */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted md:hidden">
              <span className={cn(urgent && "font-semibold text-urgent")}>
                {key ? dueLabel(key, todayKey) : "без срока"}
                {task.dueTime ? `, ${task.dueTime}` : ""}
              </span>
              {task.subject ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-sm" style={{ background: task.subject.color }} />
                  <span className="truncate">{task.subject.name}</span>
                </span>
              ) : null}
              {kindLabel ? <span className={cn("rounded-md px-1.5 py-px", urgent ? "bg-urgent-soft text-urgent" : "bg-subtle text-fg/75")}>{kindLabel}</span> : null}
              {highPrio ? <span className="font-semibold text-urgent">{prio}</span> : null}
              {steps.length ? <span className="w-28">{stepsBar}</span> : null}
            </div>
          </div>
          <span className="hidden min-w-0 items-center gap-1.5 text-[13px] text-fg/75 md:flex">
            {task.subject ? (
              <>
                <span className="h-[7px] w-[7px] shrink-0 rounded-sm" style={{ background: task.subject.color }} />
                <span className="truncate">{task.subject.name}</span>
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </span>
          <span className="hidden md:block">
            {kindLabel ? <span className={cn("whitespace-nowrap rounded-md px-[7px] py-0.5 text-xs", urgent ? "bg-urgent-soft text-urgent" : "bg-subtle text-fg/75")}>{kindLabel}</span> : null}
          </span>
          <span className="hidden md:block">{stepsBar}</span>
          <span className={cn("hidden text-xs md:block", highPrio ? "font-semibold text-urgent" : "text-muted")}>{prio}</span>
          <div className="shrink-0">
            <button
              type="button"
              aria-label={`Действия: ${task.title}`}
              aria-expanded={Boolean(menu)}
              onClick={(e) => {
                if (menu) return setMenu(null);
                const r = e.currentTarget.getBoundingClientRect();
                // Внизу экрана меню открывается вверх
                const up = r.bottom + 190 > window.innerHeight;
                const left = Math.max(8, Math.min(r.right - 192, window.innerWidth - 200));
                setMenu(up ? { bottom: window.innerHeight - r.top + 6, left } : { top: r.bottom + 6, left });
              }}
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-fg/75 transition-colors hover:text-fg"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu
              ? createPortal(
                  <>
                    <button className="fixed inset-0 z-[60] cursor-default" onClick={() => setMenu(null)} aria-hidden tabIndex={-1} />
                    <div role="menu" className="fixed z-[61] w-48 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop" style={{ top: menu.top, bottom: menu.bottom, left: menu.left }}>
                      {!done ? (
                        <>
                          <MenuButton icon={CalendarClock} onClick={() => { setMenu(null); onMove(task, addDaysKey(todayKey, 1)); }}>
                            На завтра
                          </MenuButton>
                          <MenuButton icon={CalendarClock} onClick={() => { setMenu(null); onMove(task, addDaysKey(key && key > todayKey ? key : todayKey, 7)); }}>
                            На неделю позже
                          </MenuButton>
                        </>
                      ) : null}
                      <MenuButton icon={Pencil} onClick={() => { setMenu(null); onEdit(task); }}>
                        Изменить
                      </MenuButton>
                      <MenuButton icon={Trash2} danger onClick={() => { setMenu(null); onRemove(task); }}>
                        Удалить
                      </MenuButton>
                    </div>
                  </>,
                  document.body,
                )
              : null}
          </div>
        </div>

        {open && steps.length ? (
          <ul className="animate-slide-up space-y-1 px-4 pb-3 md:pl-[116px] md:pr-[18px]">
            {steps.map((s) => {
              const sDone = closed(s.status);
              const sKey = dueKey(s.dueDate);
              const late = !sDone && sKey !== null && sKey < todayKey;
              return (
                <li key={s.id} className={cn("flex items-center gap-2 border-l border-line pl-3", s.parentId && "ml-4")}>
                  <Checkbox checked={sDone} onChange={() => onToggleStep(s)} size="sm" label={sDone ? `Вернуть: ${s.title}` : `Сделано: ${s.title}`} />
                  <span className={cn("min-w-0 flex-1 truncate text-[13px]", sDone && "text-muted line-through", late && "text-urgent")}>{s.title}</span>
                  <label className={cn("relative shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11.5px] tabular-nums hover:bg-subtle", sKey ? (late ? "text-urgent" : "text-muted") : "text-muted/60")}>
                    {sKey ? dueLabel(sKey, todayKey) : "дата"}
                    <input type="date" value={sKey ?? ""} max={key ?? undefined} onChange={(e) => onStepDate(s, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Дата этапа «${s.title}»`} />
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function MenuButton({ icon: Icon, children, onClick, danger }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", danger ? "text-danger hover:bg-danger/10" : "hover:bg-subtle")}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
