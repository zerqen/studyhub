"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft, ListChecks, MoreHorizontal, Paperclip, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createTask, deleteTask, moveTaskDate, toggleTaskDone } from "@/actions/tasks";
import { updateSubtask } from "@/actions/subtasks";
import { cn } from "@/lib/utils";
import { KIND_STAGES, TASK_KINDS, taskKind } from "@/lib/task-kinds";
import { parseQuickTask } from "@/lib/quick-task";
import { buildWeek, dueKey, localKey, openCount, OVERLOAD, weekStart, type Entry } from "@/lib/task-week";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { PageHeader, Segmented } from "../ui/page";
import { EmptyState } from "../ui/empty";
import { Select } from "../ui/field";
import { useToast } from "../ui/toast";
import { TaskForm } from "./task-form";
import { Checkbox } from "./checkbox";
import { KIND_ICONS, KindChip } from "./kind-chip";

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
  _count: { attachments: number };
};

type View = "week" | "subjects" | "all";

const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const WD_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (key: string) => {
  const d = fromKey(key);
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};
const addDaysKey = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return localKey(d);
};
const closed = (s: string) => s === "DONE" || s === "CANCELLED";


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
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState("");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [noDateOpen, setNoDateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live.filter((t) => {
      if (subject && (subject === "none" ? t.subjectId : t.subjectId !== subject)) return false;
      if (kinds.size && !kinds.has(t.kind ?? "TASK")) return false;
      if (tag && !t.tags.some((x) => x.tag.name === tag)) return false;
      if (q && !`${t.title} ${t.description ?? ""} ${t.subtasks.map((s) => s.title).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [live, query, subject, kinds, tag]);

  const today = new Date();
  const todayKey = localKey(today);
  const week = useMemo(() => buildWeek(filtered, anchor, today, showDone), [filtered, anchor, showDone, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeCount = live.filter((t) => !closed(t.status)).length;
  const doneCount = filtered.filter((t) => t.status === "DONE").length;

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
    else toast.push(`Перенесено на ${shortDate(key)}`);
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

  const rowProps = {
    expanded,
    onExpand: (id: string) =>
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

  const isCurrentWeek = week.keys.includes(todayKey);
  const weekEmpty = [...week.days.values()].every((l) => l.length === 0);
  const empty = view === "week" ? week.overdue.length + week.noDate.length + [...week.days.values()].reduce((a, l) => a + l.length, 0) === 0 : false;

  return (
    <div>
      <PageHeader
        title="Задачи"
        description={activeCount ? `${activeCount} активных` : "Всё сделано"}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Новая задача
          </Button>
        }
      />

      <QuickAdd subjects={subjects} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            ["week", "Неделя"],
            ["subjects", "По предметам"],
            ["all", "Все"],
          ]}
        />
        <div className="flex flex-wrap gap-1">
          {TASK_KINDS.map((k) => {
            const on = kinds.has(k.value);
            return (
              <button
                key={k.value}
                onClick={() =>
                  setKinds((s) => {
                    const n = new Set(s);
                    if (n.has(k.value)) n.delete(k.value);
                    else n.add(k.value);
                    return n;
                  })
                }
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
                  on ? "border-fg/20 bg-fg text-bg" : "border-line text-muted hover:text-fg",
                )}
              >
                {(() => {
                  const Icon = KIND_ICONS[k.value];
                  return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                })()}
                {k.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 w-auto max-w-44 text-[13px]">
            <option value="">Все предметы</option>
            <option value="none">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {searching ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                className="h-8 w-44 rounded-lg border border-line bg-surface pl-8 pr-7 text-[13px] outline-none focus:border-accent/60"
                placeholder="Найти"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg" onClick={() => { setQuery(""); setSearching(false); }} aria-label="Закрыть поиск">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button variant="ghost" size="icon-sm" onClick={() => setSearching(true)} aria-label="Поиск">
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
        {tag ? (
          <Link href="/tasks" className="inline-flex h-8 items-center gap-1 rounded-full bg-accent/10 px-3 text-[13px] font-medium text-accent">
            #{tag} <X className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {view === "week" ? (
        <>
          <div className="mb-3 flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() - 7))} aria-label="Прошлая неделя">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 text-center text-[15px] font-semibold">
              {isCurrentWeek ? "Эта неделя" : `${fromKey(week.keys[0]).getDate()} ${MONTHS[fromKey(week.keys[0]).getMonth()]} – ${fromKey(week.keys[6]).getDate()} ${MONTHS[fromKey(week.keys[6]).getMonth()]}`}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7))} aria-label="Следующая неделя">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek ? (
              <Button variant="secondary" size="sm" className="ml-1" onClick={() => setAnchor(weekStart(new Date()))}>
                Сегодня
              </Button>
            ) : null}
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[13px] text-muted">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              сделанные
            </label>
          </div>

          {empty && !tasks.length ? (
            <EmptyState icon={ListChecks} title="Задач пока нет" hint="Напиши в строке выше, например: «лаба 3 физика до 5.11»." />
          ) : (
            <div className="space-y-4">
              {week.overdue.length ? (
                <DayBlock title="Просрочено" tone="danger" entries={week.overdue} {...rowProps} showDates />
              ) : null}
              {weekEmpty ? <p className="card px-4 py-6 text-center text-sm text-muted">На этой неделе сдач и этапов нет</p> : null}
              {week.keys.map((key) => {
                const entries = week.days.get(key) ?? [];
                // Пустые дни не показываем
                if (!entries.length) return null;
                const d = fromKey(key);
                const past = key < todayKey;
                const n = openCount(entries);
                return (
                  <DayBlock
                    key={key}
                    dayKey={key}
                    title={key === todayKey ? `Сегодня, ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${WD_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`}
                    tone={key === todayKey ? "accent" : past ? "muted" : undefined}
                    overload={n >= OVERLOAD}
                    entries={entries}
                    pastOpenDanger={past}
                    {...rowProps}
                  />
                );
              })}
              {week.noDate.length ? (
                <section>
                  <button className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold" onClick={() => setNoDateOpen((v) => !v)}>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", !noDateOpen && "-rotate-90")} />
                    Без срока <span className="font-normal text-muted">{week.noDate.length}</span>
                  </button>
                  {noDateOpen ? (
                    <ul className="card divide-y divide-line overflow-hidden">
                      {week.noDate.map((t) => (
                        <TaskRow key={t.id} task={t} {...rowProps} showDate={false} />
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <ListView view={view} tasks={filtered} showDone={showDone} doneCount={doneCount} onShowDone={() => setShowDone((v) => !v)} rowProps={rowProps} />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Новая задача">
        <TaskForm subjects={subjects} questions={questions} onDone={() => setCreating(false)} />
      </Modal>
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

function DayBlock({
  title,
  tone,
  entries,
  overload,
  showDates,
  pastOpenDanger,
  dayKey,
  ...rowProps
}: RowProps & {
  title: string;
  tone?: "danger" | "accent" | "muted";
  entries: Entry<Task>[];
  overload?: boolean;
  showDates?: boolean;
  pastOpenDanger?: boolean;
  dayKey?: string;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <h3 className={cn("text-[13px] font-semibold", tone === "danger" && "text-danger", tone === "accent" && "text-accent", tone === "muted" && "text-muted")}>{title}</h3>
        {entries.length ? <span className="text-xs text-muted">{entries.length}</span> : null}
        {overload ? (
          <span className="rounded-full bg-warning/15 px-2 py-px text-[11px] font-medium text-warning" title="Много дел на один день — начни что-то раньше">
            много
          </span>
        ) : null}
      </div>
      {entries.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {entries.map((e) =>
            e.type === "task" ? (
              <TaskRow key={`t-${e.task.id}`} task={e.task} {...rowProps} showDate={Boolean(showDates)} danger={pastOpenDanger && !closed(e.task.status)} />
            ) : (
              <StepRow key={`s-${e.step.id}`} step={e.step} task={e.task} onToggleStep={rowProps.onToggleStep} showDate={showDates} danger={(pastOpenDanger || showDates) && !closed(e.step.status)} />
            ),
          )}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-4 py-2 text-xs text-muted/70">{dayKey ? "—" : "пусто"}</div>
      )}
    </section>
  );
}

function StepRow({ step, task, onToggleStep, showDate, danger }: { step: Step; task: Task; onToggleStep: (s: Step) => void; showDate?: boolean; danger?: boolean }) {
  const done = closed(step.status);
  return (
    <li className="flex items-start gap-3 px-4 py-2.5 pl-6 transition-colors hover:bg-subtle/50">
      <Checkbox checked={done} onChange={() => onToggleStep(step)} size="sm" className="mt-0.5" label={done ? "Вернуть" : "Сделано"} />
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <div className={cn("text-[13.5px] leading-snug", done && "text-muted line-through", danger && "text-danger")}>{step.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            {task.title}
          </span>
          {task.subject ? <span>· {task.subject.name}</span> : null}
          {task.dueDate ? <span>· сдать {shortDate(dueKey(task.dueDate)!)}</span> : null}
          {showDate && step.dueDate ? <span className={cn(danger && "text-danger")}>· план {shortDate(dueKey(step.dueDate)!)}</span> : null}
        </div>
      </Link>
    </li>
  );
}

function TaskRow({
  task,
  expanded,
  onExpand,
  onToggle,
  onToggleStep,
  onStepDate,
  onMove,
  onEdit,
  onRemove,
  todayKey,
  showDate = true,
  danger,
}: RowProps & { task: Task; showDate?: boolean; danger?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const done = closed(task.status);
  const steps = task.subtasks;
  const stepsDone = steps.filter((s) => closed(s.status)).length;
  const open = expanded.has(task.id);
  const key = dueKey(task.dueDate);
  const overdue = !done && key !== null && key < todayKey;

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

  return (
    <li className="relative overflow-hidden">
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
        className={cn("group relative flex items-start gap-3 bg-surface px-4 py-3 transition-colors hover:bg-subtle/50", !dx && "transition-transform")}
      >
        <Checkbox checked={done} onChange={() => onToggle(task)} className="mt-0.5" label={done ? "Вернуть в работу" : "Выполнить"} />
        <div className="min-w-0 flex-1">
          <Link href={`/tasks/${task.id}`} className="block">
            <div className={cn("text-sm leading-snug", done && "text-muted line-through", (danger || overdue) && !done && "text-danger")}>{task.title}</div>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <KindChip kind={task.kind} />
            {task.subject ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: task.subject.color }} />
                {task.subject.name}
              </span>
            ) : null}
            {key && showDate ? (
              <span className={cn(overdue && "font-medium text-danger")}>
                {shortDate(key)}
                {task.dueTime ? `, ${task.dueTime}` : ""}
              </span>
            ) : task.dueTime ? (
              <span>{task.dueTime}</span>
            ) : null}
            {steps.length ? (
              <button onClick={() => onExpand(task.id)} className="inline-flex items-center gap-1.5 rounded-md px-1 hover:bg-subtle hover:text-fg" aria-expanded={open}>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-success" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
                </span>
                {stepsDone}/{steps.length}
                <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
              </button>
            ) : null}
            {task._count.attachments ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {task._count.attachments}
              </span>
            ) : null}
          </div>
          {open && steps.length ? (
            <ul className="mt-2 animate-slide-up space-y-1 border-l border-line pl-3">
              {steps.map((s) => {
                const sDone = closed(s.status);
                const sKey = dueKey(s.dueDate);
                const late = !sDone && sKey !== null && sKey < todayKey;
                return (
                  <li key={s.id} className={cn("flex items-center gap-2", s.parentId && "pl-4")}>
                    <Checkbox checked={sDone} onChange={() => onToggleStep(s)} size="sm" label={sDone ? "Вернуть" : "Сделано"} />
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", sDone && "text-muted line-through", late && "text-danger")}>{s.title}</span>
                    <label className={cn("relative shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11.5px] tabular-nums hover:bg-subtle", sKey ? (late ? "text-danger" : "text-muted") : "text-muted/60")}>
                      {sKey ? shortDate(sKey) : "дата"}
                      <input
                        type="date"
                        value={sKey ?? ""}
                        max={key ?? undefined}
                        onChange={(e) => onStepDate(s, e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label={`Дата этапа «${s.title}»`}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="relative flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <Button variant="ghost" size="icon-sm" aria-label="Действия" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menu ? (
            <>
              <button className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-hidden tabIndex={-1} />
              <div className="absolute right-0 top-9 z-40 w-48 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                {!done ? (
                  <>
                    <MenuButton icon={CalendarClock} onClick={() => { setMenu(false); onMove(task, addDaysKey(todayKey, 1)); }}>
                      На завтра
                    </MenuButton>
                    <MenuButton icon={CalendarClock} onClick={() => { setMenu(false); onMove(task, addDaysKey(key && key > todayKey ? key : todayKey, 7)); }}>
                      На неделю позже
                    </MenuButton>
                  </>
                ) : null}
                <MenuButton icon={Pencil} onClick={() => { setMenu(false); onEdit(task); }}>
                  Изменить
                </MenuButton>
                <MenuButton icon={Trash2} danger onClick={() => { setMenu(false); onRemove(task); }}>
                  Удалить
                </MenuButton>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function MenuButton({ icon: Icon, children, onClick, danger }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", danger ? "text-danger hover:bg-danger/10" : "hover:bg-subtle")}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/** «По предметам» и «Все» — списки по сроку */
function ListView({
  view,
  tasks,
  showDone,
  doneCount,
  onShowDone,
  rowProps,
}: {
  view: "subjects" | "all";
  tasks: Task[];
  showDone: boolean;
  doneCount: number;
  onShowDone: () => void;
  rowProps: RowProps;
}) {
  const byDue = (a: Task, b: Task) => (dueKey(a.dueDate) ?? "9999").localeCompare(dueKey(b.dueDate) ?? "9999") || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99");
  const open = tasks.filter((t) => !closed(t.status)).sort(byDue);
  const done = tasks.filter((t) => t.status === "DONE");
  const groups: { id: string; title: string; color?: string; items: Task[] }[] = [];
  if (view === "subjects") {
    const map = new Map<string, { title: string; color?: string; items: Task[] }>();
    for (const t of open) {
      const id = t.subject?.id ?? "none";
      if (!map.has(id)) map.set(id, { title: t.subject?.name ?? "Без предмета", color: t.subject?.color, items: [] });
      map.get(id)!.items.push(t);
    }
    groups.push(
      ...[...map.entries()]
        .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : byDue(a[1].items[0], b[1].items[0])))
        .map(([id, g]) => ({ id, ...g })),
    );
  } else if (open.length) groups.push({ id: "all", title: "", items: open });

  return (
    <div className="space-y-5">
      {!open.length ? <EmptyState icon={ListChecks} title="Открытых задач нет" hint="Всё сделано — или добавь новую строкой выше." /> : null}
      {groups.map((g) => (
        <section key={g.id}>
          {g.title ? (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              {g.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /> : null}
              <h3 className="text-[13px] font-semibold">{g.title}</h3>
              <span className="text-xs text-muted">{g.items.length}</span>
            </div>
          ) : null}
          <ul className="card divide-y divide-line overflow-hidden">
            {g.items.map((t) => (
              <TaskRow key={t.id} task={t} {...rowProps} />
            ))}
          </ul>
        </section>
      ))}
      {doneCount ? (
        <section>
          <button className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-muted hover:text-fg" onClick={onShowDone}>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showDone && "-rotate-90")} />
            {showDone ? "Скрыть сделанные" : `Показать сделанные (${doneCount})`}
          </button>
          {showDone ? (
            <ul className="card divide-y divide-line overflow-hidden">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** Строка быстрого добавления: «лаба 3 физика до 5.11» */
function QuickAdd({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const parsed = useMemo(() => (text.trim().length >= 2 ? parseQuickTask(text, subjects) : null), [text, subjects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || busy) return;
    setBusy(true);
    const stages = KIND_STAGES[parsed.kind] ?? [];
    const r = await createTask({
      title: parsed.title,
      kind: parsed.kind,
      subjectId: parsed.subjectId,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: "MEDIUM",
      status: "PLANNED",
      ...(stages.length ? { stages } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      toast.push(r.error, "err");
      return;
    }
    toast.push(stages.length ? `Добавлено с этапами (${stages.length}) — даты поставь, развернув задачу` : "Задача добавлена");
    setText("");
  }

  const k = parsed ? taskKind(parsed.kind) : null;
  return (
    <form onSubmit={submit} className="mb-4">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-[border-color,box-shadow] focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
        <Plus className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Быстро добавить: «лаба 3 физика до 5.11», «кр линал в среду»"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          aria-label="Быстро добавить задачу"
        />
        {parsed ? (
          <button type="submit" disabled={busy} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-accent px-2 text-xs font-medium text-accent-fg disabled:opacity-60">
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {parsed ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted">
          {k && k.value !== "TASK" ? <KindChip kind={k.value} /> : null}
          <span className="font-medium text-fg">{parsed.title}</span>
          {parsed.subjectName ? <span>· {parsed.subjectName}</span> : <span className="text-muted/70">· без предмета</span>}
          {parsed.dueDate ? (
            <span>
              · срок {shortDate(parsed.dueDate)}
              {parsed.dueTime ? `, ${parsed.dueTime}` : ""}
            </span>
          ) : (
            <span className="text-muted/70">· без срока</span>
          )}
          {KIND_STAGES[parsed.kind]?.length ? <span>· этапов {KIND_STAGES[parsed.kind]!.length}</span> : null}
        </div>
      ) : null}
    </form>
  );
}
