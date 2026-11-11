"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { deleteAttachment } from "@/actions/attachments";
import { extTone } from "@/lib/subject-view";
import { fileSize, kindOf, matchFile, type FileItem, type Folder, type Kind } from "@/lib/files-view";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { useToast } from "../ui/toast";
import { FileUploader } from "./uploader";

const KINDS: [Kind, string][] = [
  ["all", "Все"],
  ["pdf", "PDF"],
  ["docs", "Документы"],
  ["images", "Фото"],
  ["zip", "Архивы"],
];
type Sort = "new" | "name" | "size";
const RECENT_DAYS = 7;

const ext = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase().slice(0, 4) : "ФАЙЛ";
};

/** «Файлы»: папки по предметам слева, таблица справа. Всё фильтруется в браузере. */
export function FilesBrowser({ items, subjects, learn, loose }: { items: FileItem[]; subjects: Folder[]; learn: Folder[]; loose: number }) {
  // Открываем «Недавние», если за неделю что-то добавлялось, иначе — все файлы
  const [folder, setFolder] = useState<string>(() => (items.some((f) => Date.now() - new Date(f.createdAt).getTime() < RECENT_DAYS * 864e5) ? "recent" : "all"));
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("new");
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toast = useToast();

  const names = useMemo(() => new Map([...subjects, ...learn].map((f) => [f.id, f.name])), [subjects, learn]);
  const live = useMemo(() => items.filter((f) => !hidden.has(f.id)), [items, hidden]);
  const recentFrom = Date.now() - RECENT_DAYS * 864e5;
  const recent = live.filter((f) => new Date(f.createdAt).getTime() >= recentFrom);

  type Row = { head: string } | { id: string; label: string; color: string; n: number };
  const countIn = (id: string) => live.filter((i) => i.folder === id).length;
  const tree: Row[] = [
    { head: "Быстро" },
    { id: "recent", label: "Недавние", color: "#2D5BD2", n: recent.length },
    { id: "all", label: "Все файлы", color: "#1D2130", n: live.length },
  ];
  if (subjects.length) tree.push({ head: "Предметы" }, ...subjects.map((f) => ({ id: f.id, label: f.name, color: f.color, n: countIn(f.id) })));
  if (learn.length) tree.push({ head: "Изучаю" }, ...learn.map((f) => ({ id: f.id, label: f.name, color: f.color, n: countIn(f.id) })));
  if (loose) tree.push({ head: "Без места" }, { id: "loose", label: "Загружено, не прикреплено", color: "#B9B4A6", n: countIn("loose") });
  const title = folder === "recent" ? "Недавние" : folder === "all" ? "Все файлы" : folder === "loose" ? "Не прикреплено" : (names.get(folder) ?? "Файлы");
  // Поиск ищет по всем файлам, а не только в открытой папке
  const searching = q.trim().length > 0;

  const rows = useMemo(() => {
    let list = searching ? live : folder === "recent" ? recent : folder === "all" ? live : live.filter((f) => f.folder === folder);
    if (searching) list = list.filter((f) => matchFile(q, f, names.get(f.folder) ?? ""));
    if (kind !== "all") list = list.filter((f) => kindOf(f.name, f.mimeType) === kind);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else if (sort === "size") sorted.sort((a, b) => b.size - a.size);
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [live, recent, folder, kind, sort, q, searching, names]);

  function remove(f: FileItem) {
    toast.undoable({
      text: `Файл «${f.name.slice(0, 30)}» удалён`,
      hide: () => setHidden((s) => new Set(s).add(f.id)),
      restore: () =>
        setHidden((s) => {
          const n = new Set(s);
          n.delete(f.id);
          return n;
        }),
      commit: () => deleteAttachment(f.id),
    });
  }

  const subjectFolder = folder !== "recent" && folder !== "all" && folder !== "loose" ? folder : null;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="heading mr-2 text-[28px] sm:text-[34px]">Файлы</h1>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по всем файлам — название, предмет, задача"
          aria-label="Поиск по всем файлам"
          className="h-[42px] min-w-0 flex-[1_1_320px] rounded-[10px] border border-line bg-surface px-3.5 text-sm outline-none transition-shadow placeholder:text-muted/70 focus:border-[#9DB4EE] focus:ring-[3px] focus:ring-accent-soft"
        />
        <FileUploader parent={subjectFolder ? { subjectId: subjectFolder } : undefined} compact label={subjectFolder ? `Загрузить в «${title}»` : "Загрузить"} />
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        {/* Папки: на телефоне — выпадающий список */}
        <label className="w-full md:hidden">
          <span className="sr-only">Папка</span>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
          >
            {tree.map((t, i) =>
              "head" in t ? (
                <option key={`h${i}`} disabled>
                  — {t.head} —
                </option>
              ) : (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.n}
                </option>
              ),
            )}
          </select>
        </label>
        <aside aria-label="Папки" className="sticky top-20 hidden w-[260px] shrink-0 rounded-[14px] border border-line bg-surface p-2.5 md:block">
          {tree.map((t, i) =>
            "head" in t ? (
              <div key={`h${i}`} className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted/90 first:pt-1.5">
                {t.head}
              </div>
            ) : (
              <button
                key={t.id}
                type="button"
                aria-pressed={folder === t.id && !searching}
                onClick={() => {
                  setFolder(t.id);
                  setQ("");
                }}
                className={cn(
                  "flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors",
                  folder === t.id && !searching ? "bg-accent-soft font-semibold text-[#234AB0] dark:text-accent" : "hover:bg-subtle",
                )}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: t.color }} />
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                <span className="text-xs font-normal text-muted">{t.n}</span>
              </button>
            ),
          )}
        </aside>

        <section aria-label="Файлы в папке" className="flex min-w-0 flex-[4_1_520px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="heading mr-auto text-[22px]">
              {searching ? "Поиск" : title} <span className="font-sans text-sm font-normal text-muted">{rows.length}</span>
            </h2>
            <div role="group" aria-label="Тип" className="flex flex-wrap gap-1.5">
              {KINDS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors",
                    kind === id ? "border-accent bg-accent-soft text-[#234AB0] dark:text-accent" : "border-line bg-surface hover:border-fg/30",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка" className="h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px]">
              <option value="new">Сначала новые</option>
              <option value="name">По названию</option>
              <option value="size">По размеру</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
            <div className="hidden grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.4fr)_80px_76px] items-center gap-3.5 border-b border-line px-[18px] py-2.5 text-xs font-semibold text-muted md:grid">
              <span>Тип</span>
              <span>Название</span>
              <span>Откуда</span>
              <span>Размер</span>
              <span />
            </div>
            <ul>
              {rows.map((f) => {
                const [fg, bg] = extTone(f.name);
                return (
                  <li
                    key={f.id}
                    className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-t border-[#ECE8DF] px-4 py-2.5 first:border-t-0 dark:border-line md:min-h-[52px] md:grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.4fr)_80px_76px] md:gap-x-3.5 md:px-[18px] md:py-1.5"
                  >
                    <span className="rounded-md py-1 text-center text-[11px] font-bold" style={{ color: fg, background: bg }}>
                      {ext(f.name)}
                    </span>
                    <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col gap-0.5 hover:text-accent" title={f.name}>
                      <span className="truncate text-sm font-medium">{f.name}</span>
                      <span className="truncate text-xs text-muted">
                        <span className="md:hidden">{f.where} · {fileSize(f.size)} · </span>
                        добавлен {Date.now() - new Date(f.createdAt).getTime() < 3 * 864e5 ? formatRelative(f.createdAt) : formatDate(f.createdAt, "d MMM")}
                      </span>
                    </a>
                    {f.whereHref ? (
                      <Link href={f.whereHref} className="hidden truncate text-[13px] text-[#234AB0] hover:underline dark:text-accent md:block">
                        {f.where}
                      </Link>
                    ) : (
                      <span className="hidden truncate text-[13px] text-muted md:block">{f.where}</span>
                    )}
                    <span className="hidden text-[13px] tabular-nums text-muted md:block">{fileSize(f.size)}</span>
                    <span className="flex justify-end gap-1">
                      <a
                        href={`/api/files/${f.id}?download=1`}
                        aria-label={`Скачать ${f.name}`}
                        title="Скачать"
                        className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-line bg-surface text-[#234AB0] transition-colors hover:bg-subtle dark:text-accent"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => remove(f)}
                        aria-label={`Удалить ${f.name}`}
                        title="Удалить"
                        className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {rows.length === 0 ? (
              <p className="px-[18px] py-6 text-sm text-muted">{searching ? "Ничего не нашлось" : items.length ? "Здесь пока пусто" : "Файлов пока нет — прикрепляй материалы к предметам, задачам и заметкам"}</p>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            Папки создаются сами: файл попадает туда, где ты его прикрепил — в предмет, задачу, лекцию или заметку. Перекладывать вручную не нужно.
          </p>
        </section>
      </div>
    </div>
  );
}
