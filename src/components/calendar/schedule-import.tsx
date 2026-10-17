"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, FileUp, Link2, RefreshCw, Unplug } from "lucide-react";
import { disconnectSchedule, importScheduleFile, importScheduleUrl, syncScheduleNow } from "@/actions/schedule";
import { normalizeName, parseIcs, summarizeIcs } from "@/lib/ics";
import { kindMeta } from "@/lib/schedule";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/field";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";

type Sync = { url: string | null; syncedAt: string | null };
type Result = { total: number; created: number; updated: number; removed: number; subjectsCreated: string[]; subjectsUpdated: number };

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Импорт расписания из .ics: файлом или по ссылке (с автообновлением) */
export function ScheduleImport({ subjects, sync, onDone }: { subjects: { id: string; name: string }[]; sync: Sync; onDone: () => void }) {
  const [mode, setMode] = useState<"file" | "url">(sync.url ? "url" : "file");
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState(sync.url ?? "");
  const [autoSync, setAutoSync] = useState(true);
  const [createSubjects, setCreateSubjects] = useState(true);
  const [fillSubjects, setFillSubjects] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const toast = useToast();

  const known = useMemo(() => new Set(subjects.map((s) => normalizeName(s.name))), [subjects]);
  const preview = useMemo(() => {
    if (!text) return null;
    try {
      const parsed = parseIcs(text);
      return { name: parsed.name, ...summarizeIcs(parsed.events) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Не удалось прочитать файл" };
    }
  }, [text]);

  async function run() {
    setBusy(true);
    setError(null);
    const opts = { createSubjects, fillSubjects, removeMissing: true };
    const res = mode === "file" && text ? await importScheduleFile(text, opts) : await importScheduleUrl(url, { ...opts, autoSync });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data ?? null);
    toast.push("Расписание загружено");
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <CalendarCheck2 className="mx-auto h-10 w-10 text-success" />
        <div>
          <p className="font-semibold">Готово: {result.total} {plural(result.total, "занятие", "занятия", "занятий")}</p>
          <p className="mt-1 text-sm text-muted">
            новых {result.created} · обновлено {result.updated}
            {result.removed ? ` · убрано ${result.removed}` : ""}
          </p>
        </div>
        {result.subjectsCreated.length ? (
          <div className="rounded-xl bg-subtle p-3 text-left text-sm">
            <div className="label-xs mb-1.5">Созданы предметы</div>
            <div className="flex flex-wrap gap-1.5">
              {result.subjectsCreated.map((s) => (
                <Badge key={s} tone="accent">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {result.subjectsUpdated ? <p className="text-xs text-muted">У {result.subjectsUpdated} предметов заполнены даты экзаменов и преподаватели.</p> : null}
        <Button className="w-full" onClick={onDone}>
          Открыть календарь
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sync.url ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-subtle/50 p-3 text-sm">
          <RefreshCw className="h-4 w-4 text-success" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Автообновление включено</span>
            <span className="block truncate text-xs text-muted">
              {sync.syncedAt ? `обновлено ${formatRelative(sync.syncedAt)}` : "ещё не обновлялось"} · {sync.url}
            </span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await syncScheduleNow();
              setBusy(false);
              if (!r.ok) toast.push(r.error, "err");
              else setResult(r.data ?? null);
            }}
          >
            Обновить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const r = await disconnectSchedule(false);
              if (!r.ok) toast.push(r.error, "err");
              else {
                toast.push("Автообновление выключено");
                onDone();
              }
            }}
            title="Выключить автообновление (пары останутся)"
          >
            <Unplug className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          ["file", "Файл .ics"],
          ["url", "По ссылке"],
        ]}
        className="w-full [&>button]:flex-1"
      />

      {mode === "file" ? (
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed px-6 py-6 text-center transition-colors hover:bg-subtle/40",
            text ? "border-accent/50" : "border-line",
          )}
        >
          <input
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              setText(await f.text());
              setError(null);
            }}
          />
          <FileUp className="h-6 w-6 text-muted" />
          <span className="text-sm font-medium">{fileName || "Выбери файл расписания"}</span>
          <span className="text-xs text-muted">Экспорт из расписания вуза, Google или Яндекс Календаря</span>
        </label>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… или webcal://…" className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            Обновлять автоматически (раз в 6 часов) — переносы пар подтянутся сами
          </label>
        </div>
      )}

      {mode === "file" && preview ? (
        "error" in preview ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{preview.error}</p>
        ) : (
          <div className="rounded-xl border border-line">
            <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
              <span className="text-sm font-semibold">{preview.name ?? "Расписание"}</span>
              <span className="text-xs text-muted">
                {preview.total} {plural(preview.total, "занятие", "занятия", "занятий")}
                {preview.from && preview.to ? ` · ${formatDate(preview.from, "d MMM")} – ${formatDate(preview.to, "d MMM yyyy")}` : ""}
              </span>
            </div>
            <ul className="max-h-56 divide-y divide-line overflow-y-auto">
              {preview.subjects.map((s) => {
                const exists = known.has(normalizeName(s.name));
                return (
                  <li key={s.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-xs text-muted">
                        {Object.entries(s.kinds)
                          .map(([k, n]) => `${kindMeta(k).label.toLowerCase()} ${n}`)
                          .join(" · ")}
                        {s.exam ? ` · экзамен ${formatDate(s.exam, "d MMM")}` : ""}
                      </span>
                    </span>
                    {exists ? <Badge>есть</Badge> : <Badge tone="accent">новый</Badge>}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : null}

      <div className="space-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={createSubjects} onChange={(e) => setCreateSubjects(e.target.checked)} />
          Создать недостающие предметы
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fillSubjects} onChange={(e) => setFillSubjects(e.target.checked)} />
          Проставить даты экзаменов и преподавателей
        </label>
      </div>

      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <Button
        className="w-full"
        loading={busy}
        disabled={mode === "file" ? !preview || "error" in preview : !url.trim()}
        onClick={() => void run()}
      >
        {mode === "file" && preview && !("error" in preview) ? `Загрузить ${preview.total} ${plural(preview.total, "занятие", "занятия", "занятий")}` : "Загрузить расписание"}
      </Button>
      <p className="text-center text-xs text-muted">Повторная загрузка обновит пары, а не создаст дубли.</p>
    </div>
  );
}
