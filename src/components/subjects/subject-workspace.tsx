"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowUpRight, GraduationCap, GripVertical, Headphones, ListChecks, Image as ImageIcon, MonitorPlay, MoreHorizontal, Pencil, Plus, Printer, Search, Sigma, Trash2 } from "lucide-react";
import { archiveSubject, deleteSubject } from "@/actions/subjects";
import { deleteQuestions, reorderQuestions, updateQuestion } from "@/actions/questions";
import { SUBJECT_TYPES, labelOf } from "@/lib/constants";
import { cn, daysUntil, formatDate, isOverdue } from "@/lib/utils";
import { Button } from "../ui/button";
import { Modal, ConfirmDialog } from "../ui/modal";
import { ProgressBar } from "../ui/badge";
import { EmptyState } from "../ui/empty";
import { useToast } from "../ui/toast";
import { SubjectForm } from "./subject-form";
import { QuestionForm } from "../questions/question-form";
import { QuestionImport } from "../questions/question-import";
import { TaskForm } from "../tasks/task-form";
import { NoteEditor } from "../notes/note-editor";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { StudyMode, type StudyQuestion } from "../study/study-mode";
import { Markdown } from "../ui/markdown";
import { LectureForm } from "../lectures/lecture-form";
import { QuestionGenerator } from "../ai/question-generator";
import { useAiEnabled } from "../ai/use-ai";
import { Segmented } from "../ui/page";
import type { InteractiveCard } from "../interactive/interactive-cards";
import { InteractiveForm } from "../interactive/interactive-form";
import { Checkbox } from "../tasks/checkbox";
import { QuickAddBar } from "../tasks/quick-add";
import { toggleTaskDone } from "@/actions/tasks";
import { subjectShort } from "@/lib/home";
import { matchQuestion, NEXT_STATUS, nextReviewLabel, paceText, plural, questionCat, questionSplit, untilText, type QCat } from "@/lib/subject-view";
import { taskKind } from "@/lib/task-kinds";

export type SubjectData = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  teacher: string | null;
  description: string | null;
  type: string;
  examDate: string;
  archived: boolean;
  questions: StudyQuestion[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: string | null; kind: string; description: string | null }[];
  notes: { id: string; title: string; content: string; color: string; updatedAt: string }[];
  attachments: { id: string; originalName: string; mimeType: string; size: number }[];
  interactives: InteractiveCard[];
  /** Направления «Изучаю», связанные с предметом */
  tracks: { id: string; name: string; emoji: string; color: string; topics: number }[];
  lectures: { id: string; number: number | null; title: string; date: string | null; questions: number; photos: number; media: number }[];
};

const tabs = [
  ["questions", "Вопросы"],
  ["materials", "Материалы"],
  ["tasks", "Задачи"],
  ["info", "О предмете"],
] as const;
/** «Тренировка» открывается кнопкой в шапке и во вкладках не показывается */
type Tab = (typeof tabs)[number][0] | "study";

type Kind = "all" | "interactives" | "files" | "lectures" | "notes";
const KINDS: readonly (readonly [Kind, string])[] = [
  ["all", "Все"],
  ["interactives", "Интерактивы"],
  ["files", "Файлы"],
  ["lectures", "Лекции"],
  ["notes", "Заметки"],
];

/** Старые ссылки ?tab=lectures и т.п. ведут в «Материалы» с нужным фильтром */
function parseTab(initial: string): { tab: Tab; kind: Kind } {
  if (initial === "study" || tabs.some(([id]) => id === initial)) return { tab: initial as Tab, kind: "all" };
  if (["lectures", "interactives", "notes", "files"].includes(initial)) return { tab: "materials", kind: initial as Kind };
  return { tab: "questions", kind: "all" };
}

const DONE_SHOWN = 2;
const Q_PAGE = 30;

const Q_FILTERS: readonly (readonly ["all" | QCat, string])[] = [
  ["all", "Все"],
  ["new", "Не начато"],
  ["learn", "В процессе"],
  ["hard", "Сложные"],
  ["done", "Выучено"],
];
/** Чип статуса — цвета из макета */
const Q_CAT: Record<QCat, { label: string; cls: string }> = {
  new: { label: "не начато", cls: "bg-subtle text-[#424655] hover:bg-[#E7E3DA] dark:text-muted" },
  learn: { label: "в процессе", cls: "bg-accent-soft text-[#234AB0] hover:bg-[#DCE5FA] dark:text-accent" },
  hard: { label: "сложный", cls: "bg-urgent-soft text-urgent hover:brightness-95" },
  done: { label: "выучено", cls: "bg-accent text-white hover:bg-accent/90" },
};

export function SubjectWorkspace({
  subject,
  initialTab,
  qProgress,
}: {
  subject: SubjectData;
  initialTab: string;
  /** Общий процент теперь показан полосой «выучено / в процессе / не начато» */
  progress?: number;
  qProgress: number;
  /** Больше не показывается отдельно — оставлено для совместимости вызова */
  taskProgress?: number;
}) {
  const start = parseTab(initialTab);
  const [tab, setTabState] = useState<Tab>(start.tab);
  const [kind, setKind] = useState<Kind>(start.kind);
  const [open, setOpen] = useState<null | "edit" | "question" | "import" | "task" | "note" | "lecture" | "interactive">(null);
  const [addMenu, setAddMenu] = useState(false);
  const [attach, setAttach] = useState(false);
  const [moreDone, setMoreDone] = useState(false);
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  // Порядок вопросов можно менять перетаскиванием — держим его локально
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const [qFilter, setQFilter] = useState<"all" | QCat>("all");
  const [qSearch, setQSearch] = useState("");
  const [qLimit, setQLimit] = useState(Q_PAGE);
  // Статусы, сменённые кликом по чипу (до обновления данных с сервера)
  const [statusOver, setStatusOver] = useState<Record<string, string>>({});
  const [studyFirst, setStudyFirst] = useState<string | undefined>(undefined);
  // Выбор вопросов для удаления
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDel, setBulkDel] = useState(false);
  const [importMode, setImportMode] = useState<"ai" | "json">("ai");
  const ai = useAiEnabled();
  const router = useRouter();
  const toast = useToast();
  const d = daysUntil(subject.examDate || null);

  // Вкладки переключаются мгновенно на клиенте: данные уже загружены, сервер не нужен
  function setTab(next: Tab) {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  const split = questionSplit(subject.questions.map((q) => ({ status: statusOver[q.id] ?? q.status, srsReps: q.srsReps })));
  const pace = paceText(split, subject.examDate ? d : null);
  const isDone = (t: { id: string; status: string }) => doneIds[t.id] ?? t.status === "DONE";
  const openTasks = subject.tasks.filter((t) => !isDone(t) && t.status !== "CANCELLED");
  const doneTasks = subject.tasks.filter((t) => isDone(t)).sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  async function toggleTask(id: string, was: boolean) {
    setDoneIds((m) => ({ ...m, [id]: !was }));
    const r = await toggleTaskDone(id);
    if (!r.ok) {
      setDoneIds((m) => ({ ...m, [id]: was }));
      toast.push(r.error, "err");
    }
  }
  const ordered = useMemo(() => {
    if (!order) return subject.questions;
    const byId = new Map(subject.questions.map((q) => [q.id, q]));
    const list = order.map((id) => byId.get(id)).filter((q): q is StudyQuestion => Boolean(q));
    // новые вопросы, которых ещё нет в локальном порядке — в конец
    return [...list, ...subject.questions.filter((q) => !order.includes(q.id))];
  }, [order, subject.questions]);
  const numberOf = useMemo(() => new Map(ordered.map((q, i) => [q.id, i + 1])), [ordered]);
  const catOf = (q: StudyQuestion) => questionCat({ status: statusOver[q.id] ?? q.status, srsReps: q.srsReps });
  const catCounts = useMemo(() => {
    const c: Record<QCat, number> = { new: 0, learn: 0, hard: 0, done: 0 };
    for (const q of ordered) c[questionCat({ status: statusOver[q.id] ?? q.status, srsReps: q.srsReps })]++;
    return c;
  }, [ordered, statusOver]);
  const shownQuestions = useMemo(
    () =>
      ordered.filter(
        (q) =>
          (qFilter === "all" || questionCat({ status: statusOver[q.id] ?? q.status, srsReps: q.srsReps }) === qFilter) &&
          matchQuestion(qSearch, numberOf.get(q.id) ?? 0, q.text, q.ticketNo),
      ),
    [qFilter, qSearch, ordered, numberOf, statusOver],
  );
  const visibleQuestions = shownQuestions.slice(0, qLimit);
  const now = new Date();
  const canDrag = qFilter === "all" && !qSearch && ordered.length > 1 && !selecting;
  const allShownSelected = shownQuestions.length > 0 && shownQuestions.every((q) => selected.has(q.id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function removeSelected() {
    const ids = [...selected];
    const r = await deleteQuestions(ids);
    if (!r.ok) return toast.push(r.error, "err");
    toast.push(`Удалено вопросов: ${r.data?.count ?? ids.length}`);
    setOrder((o) => (o ? o.filter((id) => !selected.has(id)) : o));
    setBulkDel(false);
    stopSelecting();
    router.refresh();
  }

  async function cycleStatus(q: StudyQuestion, cat: QCat) {
    // Уже повторявшийся вопрос не бывает «не начатым» — после «выучено» он возвращается в «в процессе»
    const status = cat === "done" && q.srsReps > 0 ? "IN_PROGRESS" : NEXT_STATUS[cat];
    const before = statusOver[q.id];
    setStatusOver((m) => ({ ...m, [q.id]: status }));
    const r = await updateQuestion(q.id, { status });
    if (!r.ok) {
      setStatusOver((m) => ({ ...m, [q.id]: before ?? q.status }));
      toast.push(r.error, "err");
    }
  }

  function moveOver(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((q) => q.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids);
  }

  async function saveOrder() {
    setDragId(null);
    if (!order) return;
    const r = await reorderQuestions(subject.id, order);
    if (!r.ok) toast.push(r.error, "err");
  }
  const kindCounts: Record<Kind, number> = {
    all: subject.interactives.length + subject.attachments.length + subject.lectures.length + subject.notes.length,
    interactives: subject.interactives.length,
    files: subject.attachments.length,
    lectures: subject.lectures.length,
    notes: subject.notes.length,
  };
  const counts: Record<(typeof tabs)[number][0], number | null> = {
    questions: subject.questions.length,
    materials: kindCounts.all,
    tasks: subject.tasks.length,
    info: null,
  };
  const show = (k: Exclude<Kind, "all">) => kind === "all" || kind === k;

  function addMaterial(k: Exclude<Kind, "all">) {
    setAddMenu(false);
    if (k === "files") {
      setKind(kind === "all" ? "all" : "files");
      setAttach(true);
    } else setOpen(k === "interactives" ? "interactive" : k === "lectures" ? "lecture" : "note");
  }

  return (
    <div>
      <Link href="/subjects" className="mb-4 inline-flex text-[13px] text-accent hover:underline">
        ← Предметы
      </Link>

      {/* Шапка предмета */}
      <header className="card mb-5 flex flex-col gap-[18px] rounded-2xl p-5 sm:px-6 sm:py-[22px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl text-base font-bold" style={{ background: `${subject.color}1f`, color: subject.color }} aria-hidden>
            {subjectShort(subject.name)}
          </span>
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
            <h1 className="heading text-[26px] leading-tight sm:text-[32px]">{subject.name}</h1>
            <p className="text-sm text-muted">
              <span className="mr-2 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent">{labelOf(SUBJECT_TYPES, subject.type)}</span>
              {subject.archived ? <span className="mr-2 rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning">В архиве</span> : null}
              {[subject.examDate ? `${formatDate(subject.examDate, "d MMMM")} · ${untilText(d)}` : null, subject.teacher].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {subject.questions.length ? (
              <>
                <button
                  type="button"
                  onClick={() => setTab("study")}
                  aria-pressed={tab === "study"}
                  className="h-[42px] rounded-[10px] bg-accent px-[18px] text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90"
                >
                  Тренировка
                </button>
                <Link
                  href={`/subjects/${subject.id}/ten`}
                  className="inline-flex h-[42px] items-center rounded-[10px] border border-line bg-surface px-3.5 text-sm font-semibold text-accent transition-colors hover:bg-subtle"
                  title="10 минут: самые слабые вопросы к экзамену"
                >
                  10 мин
                </Link>
              </>
            ) : (
              <button type="button" onClick={() => setOpen("import")} className="h-[42px] rounded-[10px] bg-accent px-[18px] text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90">
                + Билеты
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-label="Ещё: пробный экзамен, лист формул, изменить, в архив"
                aria-expanded={menu}
                className="grid h-[42px] w-[42px] place-items-center rounded-[10px] border border-line bg-surface text-fg/75 transition-colors hover:bg-subtle"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {menu ? (
                <>
                  <button className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-hidden tabIndex={-1} />
                  <div className="absolute right-0 z-40 mt-1 w-56 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                    <MenuItem icon={GraduationCap} onClick={() => { setMenu(false); router.push(`/subjects/${subject.id}/exam`); }}>
                      Пробный экзамен
                    </MenuItem>
                    <MenuItem icon={Sigma} onClick={() => { setMenu(false); router.push(`/subjects/${subject.id}/formulas`); }}>
                      Лист формул
                    </MenuItem>
                    <MenuItem icon={Printer} onClick={() => { setMenu(false); window.open(`/subjects/${subject.id}/print`, "_blank"); }}>
                      Шпаргалка для печати
                    </MenuItem>
                    <MenuItem icon={Pencil} onClick={() => { setMenu(false); setOpen("edit"); }}>
                      Изменить
                    </MenuItem>
                    <MenuItem
                      icon={subject.archived ? ArchiveRestore : Archive}
                      onClick={async () => {
                        setMenu(false);
                        const r = await archiveSubject(subject.id, !subject.archived);
                        if (!r.ok) toast.push(r.error, "err");
                        else toast.push(subject.archived ? "Предмет возвращён" : "Предмет в архиве");
                      }}
                    >
                      {subject.archived ? "Вернуть из архива" : "В архив"}
                    </MenuItem>
                    <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setDel(true); }}>
                      Удалить
                    </MenuItem>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Прогресс: выучено / в процессе / не начато и темп до экзамена */}
        <div className="flex flex-col gap-2 border-t border-[#ECE8DF] pt-4 dark:border-line">
          {split.total ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                <span className="text-sm">
                  <b className="font-semibold">Выучено {split.learned}</b>{" "}
                  <span className="text-muted">
                    из {split.total} {plural(split.total, "вопроса", "вопросов", "вопросов")}
                  </span>
                </span>
                {pace ? <span className="text-[13px] text-muted">{pace}</span> : null}
              </div>
              <div
                role="img"
                aria-label={`Выучено ${split.learned}, в процессе ${split.started}, не начато ${split.fresh}`}
                className="flex h-2 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle"
              >
                <span className="bg-accent transition-[width] duration-500" style={{ width: `${(split.learned / split.total) * 100}%` }} />
                <span className="bg-[#9DB4EE] transition-[width] duration-500" style={{ width: `${(split.started / split.total) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-accent" />
                  выучено {split.learned}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[#9DB4EE]" />в процессе {split.started}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm border border-line bg-[#E7E3DA] dark:bg-subtle" />
                  не начато {split.fresh}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                <b className="text-sm font-semibold">Вопросов пока нет</b>
                <span className="text-[13px] text-muted">Импортируй билеты — здесь появится прогресс и темп</span>
              </div>
              <div className="h-2 rounded-full bg-[#E7E3DA] dark:bg-subtle" aria-hidden />
            </>
          )}
        </div>
      </header>

      {/* Вкладки */}
      <div role="tablist" aria-label="Разделы предмета" className="scrollbar-none -mx-4 mb-5 flex gap-0.5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-sm transition-colors",
              tab === id ? "border-accent font-semibold text-fg" : "border-transparent text-fg/75 hover:text-fg",
            )}
          >
            {label}
            {counts[id] ? <span className="font-normal text-muted">{counts[id]}</span> : null}
          </button>
        ))}
        {tab === "study" ? (
          <span role="tab" aria-selected className="flex h-11 shrink-0 items-center border-b-2 border-accent px-3.5 text-sm font-semibold">
            Тренировка
          </span>
        ) : null}
      </div>

      {tab === "questions" && (
        <section aria-label="Вопросы" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex h-[42px] min-w-0 flex-[1_1_260px] items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-muted transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="search"
                value={qSearch}
                onChange={(e) => {
                  setQSearch(e.target.value);
                  setQLimit(Q_PAGE);
                }}
                placeholder="Номер или слово из вопроса"
                aria-label="Поиск по вопросам"
                className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-0"
              />
            </label>
            {subject.questions.length ? (
              <button
                type="button"
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                aria-pressed={selecting}
                title="Выбрать несколько — чтобы удалить"
                className={cn(
                  "inline-flex h-[42px] items-center gap-1.5 rounded-[10px] border px-3 text-sm transition-colors",
                  selecting ? "border-accent bg-accent-soft font-semibold text-[#234AB0] dark:text-accent" : "border-line bg-surface hover:bg-subtle",
                )}
              >
                <ListChecks className="h-4 w-4" /> <span className="max-sm:sr-only">{selecting ? "Готово" : "Выбрать"}</span>
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen("import")} className="h-[42px] rounded-[10px] border border-line bg-surface px-3.5 text-sm transition-colors hover:bg-subtle">
              Вставить списком
            </button>
            <button type="button" onClick={() => setOpen("question")} className="h-[42px] rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90">
              + Вопрос
            </button>
          </div>

          {subject.questions.length ? (
            <div role="group" aria-label="Фильтр по статусу" className="flex flex-wrap gap-1.5">
              {Q_FILTERS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={qFilter === id}
                  onClick={() => {
                    setQFilter(id);
                    setQLimit(Q_PAGE);
                  }}
                  className={cn(
                    "h-[34px] rounded-full border px-3 text-[13px] font-medium transition-colors",
                    qFilter === id ? "border-fg bg-fg text-bg" : "border-line bg-surface text-fg hover:border-fg/30",
                  )}
                >
                  {label} <span className="opacity-70">{id === "all" ? ordered.length : catCounts[id]}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selecting ? (
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                  checked={allShownSelected}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const q of shownQuestions) {
                        if (allShownSelected) next.delete(q.id);
                        else next.add(q.id);
                      }
                      return next;
                    })
                  }
                />
                {qFilter === "all" && !qSearch ? "Все" : "Все найденные"}
              </label>
              <span className="text-sm text-muted">выбрано {selected.size}</span>
              <Button size="sm" variant="danger" className="ml-auto" disabled={!selected.size} onClick={() => setBulkDel(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Удалить
              </Button>
              <Button size="sm" variant="ghost" onClick={stopSelecting}>
                Отмена
              </Button>
            </div>
          ) : null}

          {subject.questions.length === 0 ? (
            <EmptyState
              title="Вопросов пока нет"
              hint="Добавь вопросы по одному или вставь сразу весь список билетов."
              action={
                <Button onClick={() => setOpen("import")}>
                  <Plus className="h-4 w-4" /> Вставить списком
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
              <div className="hidden h-[38px] grid-cols-[52px_minmax(0,1fr)_120px_130px_92px] items-center gap-3 bg-[#F8F6F1] px-5 text-xs font-semibold uppercase tracking-[0.04em] text-muted dark:bg-subtle md:grid">
                <span>№</span>
                <span>Вопрос</span>
                <span>Статус</span>
                <span>Повторить</span>
                <span />
              </div>
              <ol>
                {visibleQuestions.map((q) => {
                  const cat = catOf(q);
                  const st = Q_CAT[cat];
                  const picked = selecting && selected.has(q.id);
                  return (
                    <li
                      key={q.id}
                      draggable={canDrag}
                      onDragStart={(e) => {
                        setDragId(q.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        moveOver(q.id);
                      }}
                      onDragEnd={() => void saveOrder()}
                      className={cn(
                        "group/row grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 md:items-center md:gap-x-3 border-t border-[#ECE8DF] px-4 py-3 text-sm first:border-t-0 dark:border-line md:min-h-[52px] md:grid-cols-[52px_minmax(0,1fr)_120px_130px_92px] md:px-5 md:py-2 md:first:border-t",
                        dragId === q.id && "opacity-40",
                        picked && "bg-accent/5",
                      )}
                    >
                      <span className="relative flex items-center gap-1.5 font-semibold tabular-nums text-muted max-md:pt-px">
                        {selecting ? (
                          <input
                            type="checkbox"
                            checked={picked}
                            onChange={() => toggleSelected(q.id)}
                            className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                            aria-label={`Выбрать вопрос ${numberOf.get(q.id)}`}
                          />
                        ) : canDrag ? (
                          <GripVertical aria-hidden className="absolute -left-4 hidden h-4 w-4 cursor-grab text-muted/60 opacity-0 transition-opacity group-hover/row:opacity-100 md:block" />
                        ) : null}
                        {numberOf.get(q.id)}
                      </span>
                      <Link
                        href={`/questions/${q.id}`}
                        draggable={false}
                        onClick={(e) => {
                          if (!selecting) return;
                          e.preventDefault();
                          toggleSelected(q.id);
                        }}
                        className="min-w-0 hover:text-accent"
                        title={q.text.length > 90 ? q.text : undefined}
                      >
                        <span className="line-clamp-2 md:line-clamp-1">
                          <Markdown inline>{q.text}</Markdown>
                        </span>
                        {q.kind === "PROBLEM" || !q.answer ? (
                          <span className="mt-0.5 block text-xs text-muted">{[q.kind === "PROBLEM" ? "задача" : null, !q.answer ? "без ответа" : null].filter(Boolean).join(" · ")}</span>
                        ) : null}
                      </Link>
                      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:contents">
                        <button
                          type="button"
                          onClick={() => void cycleStatus(q, cat)}
                          title="Нажми, чтобы сменить статус"
                          className={cn("h-[26px] justify-self-start whitespace-nowrap rounded-full px-2.5 text-xs font-semibold transition-colors", st.cls)}
                        >
                          {st.label}
                        </button>
                        <span className={cn("whitespace-nowrap text-[13px] text-muted", !q.srsReps && "max-md:hidden")} title="Когда повторить">
                          {nextReviewLabel(q.srsDue, q.srsReps, now)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStudyFirst(q.id);
                            setTab("study");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-[#234AB0] transition-colors hover:border-accent dark:text-accent max-md:ml-auto"
                        >
                          Учить
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {shownQuestions.length === 0 ? (
                <p className="border-t border-[#ECE8DF] px-5 py-7 text-center text-sm text-muted dark:border-line">Ничего не нашлось</p>
              ) : (
                <div className="flex min-h-12 items-center justify-between gap-2.5 border-t border-[#ECE8DF] px-5 text-[13px] text-muted dark:border-line">
                  <span>
                    Показано {visibleQuestions.length} из {shownQuestions.length}
                  </span>
                  {visibleQuestions.length < shownQuestions.length ? (
                    <button type="button" onClick={() => setQLimit((n) => n + Q_PAGE)} className="min-h-8 text-[13px] font-semibold text-[#234AB0] hover:underline dark:text-accent">
                      Показать ещё
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "materials" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Тип материала" className="flex flex-wrap gap-1.5">
              {KINDS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors",
                    kind === id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-fg hover:bg-subtle",
                  )}
                >
                  {label} <span className="text-muted">{kindCounts[id]}</span>
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => (kind === "all" ? setAddMenu((v) => !v) : addMaterial(kind))}
                aria-expanded={kind === "all" ? addMenu : undefined}
                className="h-[38px] rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-accent-fg transition-colors hover:bg-accent/90"
              >
                + {kind === "all" ? "Материал" : kind === "interactives" ? "Схема" : kind === "files" ? "Файл" : kind === "lectures" ? "Лекция" : "Заметка"}
              </button>
              {addMenu ? (
                <>
                  <button className="fixed inset-0 z-30 cursor-default" onClick={() => setAddMenu(false)} aria-hidden tabIndex={-1} />
                  <div className="absolute right-0 z-40 mt-1 w-48 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                    <MenuItem icon={Headphones} onClick={() => addMaterial("lectures")}>
                      Лекция
                    </MenuItem>
                    <MenuItem icon={MonitorPlay} onClick={() => addMaterial("interactives")}>
                      Схема
                    </MenuItem>
                    <MenuItem icon={ImageIcon} onClick={() => addMaterial("files")}>
                      Файл
                    </MenuItem>
                    <MenuItem icon={Pencil} onClick={() => addMaterial("notes")}>
                      Заметка
                    </MenuItem>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {show("interactives") && subject.interactives.length ? (
            <section aria-labelledby="m-inter" className="flex flex-col gap-2.5">
              <h2 id="m-inter" className="heading text-xl">
                Интерактивы
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2.5">
                {subject.interactives.map((it) => (
                  <Link key={it.id} href={`/interactives/${it.id}`} className="card card-hover flex items-center gap-3 rounded-xl p-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px]" style={{ background: `${subject.color}1f`, color: subject.color }}>
                      <MonitorPlay className="h-[18px] w-[18px]" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{it.title}</span>
                      <span className="truncate text-xs text-muted">
                        {it.lecture ? `Лекция ${it.lecture.number ?? ""} · ` : ""}
                        {formatDate(it.updatedAt, "d MMM")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {show("files") && (subject.attachments.length || attach) ? (
            <section aria-labelledby="m-files" className="card overflow-hidden rounded-[14px]">
              <div className="flex items-baseline justify-between px-4 py-3.5 sm:px-5">
                <h2 id="m-files" className="heading text-xl">
                  Файлы
                </h2>
                <button
                  type="button"
                  onClick={() => setAttach((v) => !v)}
                  aria-expanded={attach}
                  className="h-[34px] rounded-lg border border-dashed border-[#CFC9B8] bg-surface px-3 text-[13px] text-fg/75 transition-colors hover:bg-subtle dark:border-line"
                >
                  {attach ? "Скрыть" : "Прикрепить"}
                </button>
              </div>
              {attach ? (
                <div className="border-t border-[#ECE8DF] px-4 py-3 dark:border-line sm:px-5">
                  <FileUploader parent={{ subjectId: subject.id }} />
                </div>
              ) : null}
              <FileGrid files={subject.attachments} list />
            </section>
          ) : null}

          {show("lectures") && subject.lectures.length ? (
            <section aria-labelledby="m-lect" className="card overflow-hidden rounded-[14px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3.5 sm:px-5">
                <h2 id="m-lect" className="heading text-xl">
                  Лекции
                </h2>
                {subject.tracks.length ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">Доп. темы:</span>
                    {subject.tracks.map((t) => (
                      <Link key={t.id} href={`/learn/${t.id}`} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs transition-colors hover:bg-subtle">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted">{t.topics}</span>
                      </Link>
                    ))}
                  </span>
                ) : null}
              </div>
              <ul>
                {subject.lectures.map((l) => (
                  <li key={l.id} className="border-t border-[#ECE8DF] dark:border-line">
                    <Link href={`/lectures/${l.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 sm:px-5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums" style={{ background: `${subject.color}1f`, color: subject.color }}>
                        {l.number ?? "·"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{l.title}</span>
                        <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          {l.date ? <span>{formatDate(l.date, "d MMMM")}</span> : null}
                          {l.media ? (
                            <span className="inline-flex items-center gap-1">
                              <Headphones className="h-3 w-3" /> запись
                            </span>
                          ) : null}
                          {l.photos ? (
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" /> {l.photos} фото
                            </span>
                          ) : null}
                          {l.questions ? (
                            <span>
                              {l.questions} {plural(l.questions, "вопрос", "вопроса", "вопросов")}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {show("notes") && subject.notes.length ? (
            <section aria-labelledby="m-notes" className="flex flex-col gap-2.5">
              <h2 id="m-notes" className="heading text-xl">
                Заметки
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {subject.notes.map((n) => (
                  <Link key={n.id} href={`/notes?open=${n.id}`} className="card card-hover relative overflow-hidden rounded-xl p-4 pl-5">
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: n.color }} />
                    <div className="truncate font-medium">{n.title}</div>
                    {n.content ? <p className="mt-1 line-clamp-3 text-sm text-muted">{n.content}</p> : null}
                    <div className="mt-2 text-xs text-muted">{formatDate(n.updatedAt, "d MMM")}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Пустые разделы — пунктиром внизу, с кнопкой добавить */}
          {(() => {
            const empty = (
              [
                ["interactives", "Интерактивы", "Схемы и симуляции в HTML — запускаются прямо на сайте.", "+ Схема", subject.interactives.length],
                ["files", "Файлы", "Методички, бланки лабораторных, сканы — всё в одном месте.", "+ Файл", subject.attachments.length + (attach ? 1 : 0)],
                ["lectures", "Лекции", "Пока пусто. Загрузи запись или конспект — из него можно сделать вопросы.", "+ Лекция", subject.lectures.length],
                ["notes", "Заметки", "Формулы, шпаргалки, мысли по ходу лабораторных.", "+ Заметка", subject.notes.length],
              ] as const
            ).filter(([k, , , , n]) => show(k) && n === 0);
            if (!empty.length) return null;
            return (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
                {empty.map(([k, title, hint, action]) => (
                  <section key={k} aria-label={title} className="flex flex-col gap-2 rounded-[14px] border border-dashed border-[#CFC9B8] px-[18px] py-4 dark:border-line">
                    <h2 className="heading text-lg">{title}</h2>
                    <p className="text-[13px] text-muted">{hint}</p>
                    <button
                      type="button"
                      onClick={() => addMaterial(k)}
                      className="h-9 self-start rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-subtle"
                    >
                      {action}
                    </button>
                  </section>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {tab === "study" && <StudyMode key={studyFirst ?? "all"} questions={ordered} color={subject.color} first={studyFirst} />}

      {tab === "tasks" && (
        <section aria-label="Задачи предмета" className="flex flex-col gap-3.5">
          <QuickAddBar
            subjects={[{ id: subject.id, name: subject.name }]}
            fixedSubjectId={subject.id}
            placeholder="Новая задача: «ДЗ 950–960 к четвергу»"
            label={`Новая задача по предмету «${subject.name}»`}
            button="Добавить"
            className="w-full"
          />
          {subject.tasks.length === 0 ? (
            <EmptyState title="Задач нет" hint="Например: «лаба 3 к пятнице» или «кр через неделю» — тип и срок поймутся сами." />
          ) : (
            <div className="card overflow-hidden rounded-[14px]">
              {(
                [
                  ["Открытые", openTasks],
                  ["Сделано", doneTasks],
                ] as const
              ).map(([title, list], gi) => {
                if (!list.length) return null;
                const done = gi === 1;
                const shown = done && !moreDone ? list.slice(0, DONE_SHOWN) : list;
                return (
                  <div key={title}>
                    <div className={cn("bg-[#F8F6F1] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted dark:bg-subtle sm:px-5", gi > 0 && "border-t border-line")}>
                      {title} · {list.length}
                    </div>
                    <ul>
                      {shown.map((t) => {
                        const k = t.kind === "TASK" ? null : taskKind(t.kind).label;
                        const late = !done && isOverdue(t.dueDate, t.status);
                        return (
                          <li
                            key={t.id}
                            className={cn(
                              "grid grid-cols-[22px_56px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-[#ECE8DF] px-4 text-sm dark:border-line sm:grid-cols-[22px_70px_minmax(0,1fr)_70px] sm:px-5",
                              done ? "min-h-12 text-muted" : "min-h-[60px] py-2",
                            )}
                          >
                            <Checkbox checked={done} onChange={() => toggleTask(t.id, done)} label={done ? `Вернуть: ${t.title}` : `Выполнено: ${t.title}`} />
                            <span className={cn("text-[13px] tabular-nums sm:text-sm", !done && "font-semibold", late && "text-urgent")}>{t.dueDate ? formatDate(t.dueDate, done ? "d MMM" : "EEEEEE d").replace(".", "") : "—"}</span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <Link href={`/tasks/${t.id}`} className={cn("truncate font-medium transition-colors hover:text-accent", done ? "font-normal line-through" : "text-fg")}>
                                {t.title}
                              </Link>
                              {!done && t.description ? <span className="truncate text-xs text-muted">{t.description.split("\n")[0]}</span> : null}
                            </span>
                            <span>
                              {k ? (
                                done ? (
                                  <span className="text-xs">{k}</span>
                                ) : (
                                  <span className={cn("inline-block whitespace-nowrap rounded-md px-[7px] py-0.5 text-xs", late ? "bg-urgent-soft text-urgent" : "bg-subtle text-fg/75")}>{k}</span>
                                )
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {done && list.length > DONE_SHOWN ? (
                      <button
                        type="button"
                        onClick={() => setMoreDone((v) => !v)}
                        className="h-11 w-full border-t border-[#ECE8DF] bg-surface text-[13px] font-semibold text-accent transition-colors hover:bg-subtle dark:border-line"
                      >
                        {moreDone ? "Свернуть" : `Показать ещё ${list.length - DONE_SHOWN} ${plural(list.length - DONE_SHOWN, "сделанную", "сделанных", "сделанных")}`}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "info" && (
        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="card p-5">
            <div className="label-xs mb-2">Описание</div>
            {subject.description ? <Markdown className="text-sm">{subject.description}</Markdown> : <p className="text-sm text-muted">Описания пока нет.</p>}
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen("edit")}>
              <Pencil className="h-3.5 w-3.5" /> Изменить
            </Button>
          </div>
          <div className="card space-y-4 p-5">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted">Готовность — выучено вопросов</span>
                <span className="font-semibold tabular-nums">{qProgress}%</span>
              </div>
              <ProgressBar value={qProgress} color={subject.color} />
            </div>
            <div className="border-t border-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Задач закрыто</span>
                <span className="tabular-nums text-muted">
                  {subject.tasks.filter((t) => t.status === "DONE").length} из {subject.tasks.length}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <Modal open={open === "edit"} onClose={() => setOpen(null)} title="Редактировать предмет">
        <SubjectForm
          id={subject.id}
          initial={{
            name: subject.name,
            color: subject.color,
            emoji: subject.emoji,
            teacher: subject.teacher ?? "",
            description: subject.description ?? "",
            type: subject.type,
            examDate: subject.examDate,
          }}
          onDone={() => setOpen(null)}
        />
      </Modal>
      <Modal open={open === "question"} onClose={() => setOpen(null)} title="Новый вопрос">
        <QuestionForm subjectId={subject.id} lectures={subject.lectures} onDone={() => setOpen(null)} />
      </Modal>
      <ConfirmDialog
        open={bulkDel}
        onClose={() => setBulkDel(false)}
        title={`Удалить ${selected.size} ${selected.size % 10 === 1 && selected.size % 100 !== 11 ? "вопрос" : selected.size % 10 >= 2 && selected.size % 10 <= 4 && (selected.size % 100 < 12 || selected.size % 100 > 14) ? "вопроса" : "вопросов"}?`}
        text="Вместе с ответами, комментариями, файлами и историей повторений. Отменить нельзя."
        onConfirm={removeSelected}
      />
      <Modal open={open === "interactive"} onClose={() => setOpen(null)} title="Новая схема" description="HTML запускается изолированно: у него нет доступа к твоему аккаунту">
        <InteractiveForm subjectId={subject.id} onDone={(id) => router.push(`/interactives/${id}`)} />
      </Modal>
      <Modal open={open === "lecture"} onClose={() => setOpen(null)} title="Новая лекция">
        <LectureForm subjectId={subject.id} onDone={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "import"}
        onClose={() => setOpen(null)}
        title="Добавить вопросы списком"
        description={importMode === "ai" ? "Вставь конспект или методичку — ИИ составит вопросы с ответами" : "Вставь JSON-массив — вопросы добавятся в конец списка"}
        className="sm:max-w-2xl"
      >
        {ai ? (
          <Segmented
            value={importMode}
            onChange={setImportMode}
            options={[
              ["ai", "Из текста (ИИ)"],
              ["json", "JSON"],
            ]}
            className="mb-4 w-full [&>button]:flex-1"
          />
        ) : null}
        {open === "import" && ai && importMode === "ai" ? (
          <QuestionGenerator subjectId={subject.id} onDone={() => setOpen(null)} />
        ) : (
          <QuestionImport subjectId={subject.id} onDone={() => setOpen(null)} />
        )}
      </Modal>
      <Modal open={open === "task"} onClose={() => setOpen(null)} title="Новая задача">
        <TaskForm subjects={[{ id: subject.id, name: subject.name }]} initial={{ subjectId: subject.id }} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "note"} onClose={() => setOpen(null)} title="Новая заметка" className="sm:max-w-2xl">
        <NoteEditor subjects={[{ id: subject.id, name: subject.name }]} defaultSubjectId={subject.id} onDone={() => setOpen(null)} />
      </Modal>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Удалить предмет?"
        text="Вопросы и файлы предмета будут удалены. Задачи останутся, но отвяжутся от предмета."
        onConfirm={async () => {
          const r = await deleteSubject(subject.id);
          if (!r.ok) {
            toast.push(r.error, "err");
            return;
          }
          toast.push("Предмет удалён");
          router.push("/subjects");
        }}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", danger ? "text-danger hover:bg-danger/10" : "hover:bg-subtle")}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
