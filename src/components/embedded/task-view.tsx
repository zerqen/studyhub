"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clipboard, Clock, Lightbulb, Play, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Segmented, Skeleton } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { buildReviewText } from "@/lib/embedded/driver";
import type { Task, TestOutcome } from "@/lib/embedded/types";
import type { LoadProgress, Toolchain } from "@/lib/embedded/toolchain";
import { checkSolution, runProgram, type CheckReport, type RunReport } from "@/lib/embedded/engine";
import { markEmbeddedSolved, saveEmbeddedCode, saveEmbeddedHelp } from "@/actions/embedded";
import { Diagram } from "./diagram";

const CodeEditor = dynamic(() => import("./code-editor"), { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> });

const BUSY_KEY = "embedded:compiling";
const CRASHED_KEY = "embedded:compiler-crashed";

function storage(action: (s: Storage) => void) {
  try {
    action(window.localStorage);
  } catch {
    // в приватном режиме хранилище может быть недоступно
  }
}

type Busy = null | "run" | "check";
export type ClientTask = Omit<Task, "wrongSolutions"> & { wrongSolutions?: undefined };
type Initial = { code: string | null; solved: boolean; hintsShown: number; revealed: boolean };

export function TaskView({ task, initial, next }: { task: ClientTask; initial: Initial; next: { slug: string; title: string } | null }) {
  const { push } = useToast();
  const fullTask = useMemo(() => ({ ...task, wrongSolutions: [] }) as Task, [task]);
  const [code, setCode] = useState(initial.code ?? task.starter);
  const [resetKey, setResetKey] = useState(0);
  const [saved, setSaved] = useState(true);
  const [solved, setSolved] = useState(initial.solved);
  const [hintsShown, setHintsShown] = useState(initial.hintsShown);
  const [revealed, setRevealed] = useState(initial.revealed);
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [load, setLoad] = useState<LoadProgress | null>(null);
  const [tab, setTab] = useState<"output" | "tests">("output");
  const [run, setRun] = useState<RunReport | null>(null);
  const [check, setCheck] = useState<CheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crashed, setCrashed] = useState(false);
  const toolchain = useRef<Toolchain | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    void saveEmbeddedCode(task.slug, value).then((r) => {
      if (r.ok) setSaved(true);
    });
  }, [task.slug]);

  // Падение вкладки из-за нехватки памяти: при следующем открытии отметка «компиляция» осталась на месте
  useEffect(() => {
    storage((s) => {
      if (s.getItem(BUSY_KEY)) {
        s.removeItem(BUSY_KEY);
        s.setItem(CRASHED_KEY, "1");
      }
      if (s.getItem(CRASHED_KEY)) setCrashed(true);
    });
    const onHide = () => {
      flush();
      storage((s) => s.removeItem(BUSY_KEY));
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
      toolchain.current?.dispose();
    };
  }, [flush]);

  const onChange = useCallback(
    (value: string) => {
      setCode(value);
      setSaved(false);
      pending.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1200);
    },
    [flush],
  );

  const withToolchain = useCallback(
    async (kind: Exclude<Busy, null>, action: (tc: Toolchain, onProgress: (p: LoadProgress) => void) => Promise<void>) => {
      setBusy(kind);
      setError(null);
      setLoad(null);
      storage((s) => s.setItem(BUSY_KEY, "1"));
      try {
        if (!toolchain.current) {
          const { Toolchain } = await import("@/lib/embedded/toolchain");
          toolchain.current = new Toolchain();
        }
        await action(toolchain.current, setLoad);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось запустить компилятор");
      } finally {
        storage((s) => s.removeItem(BUSY_KEY));
        setBusy(null);
        setLoad(null);
      }
    },
    [],
  );

  const onRun = () =>
    withToolchain("run", async (tc, onProgress) => {
      setTab("output");
      setRun(await runProgram(tc, fullTask, code, onProgress));
    });

  const onCheck = () =>
    withToolchain("check", async (tc, onProgress) => {
      setTab("tests");
      const report = await checkSolution(tc, fullTask, code, onProgress);
      setCheck(report);
      if (report.built && report.outcomes.length > 0 && report.outcomes.every((o) => o.status === "passed")) {
        setSolved(true);
        pending.current = null;
        setSaved(true);
        const r = await markEmbeddedSolved(task.slug, code);
        if (!r.ok) push(r.error, "err");
      }
    });

  const showHint = () => {
    const value = hintsShown + 1;
    setHintsShown(value);
    void saveEmbeddedHelp(task.slug, { hintsShown: value });
  };

  const reveal = () => {
    setRevealed(true);
    void saveEmbeddedHelp(task.slug, { revealed: true });
  };

  const copy = async () => {
    const log = check && !check.built ? check.log : (run?.log ?? "");
    try {
      await navigator.clipboard.writeText(buildReviewText(fullTask, code, check?.built ? check.outcomes : null, log));
      push("Скопировано");
    } catch {
      push("Браузер не разрешил доступ к буферу обмена", "err");
    }
  };

  const reset = () => {
    onChange(task.starter);
    setResetKey((k) => k + 1);
    setAskReset(false);
  };

  const retryCompiler = () => {
    storage((s) => s.removeItem(CRASHED_KEY));
    setCrashed(false);
  };

  const passed = check?.outcomes.filter((o) => o.status === "passed").length ?? 0;
  const showSolution = solved || revealed;

  return (
    <div>
      <PageHeader
        back={{ href: "/embedded", label: "Embedded" }}
        title={task.title}
        description={task.summary}
        actions={solved ? <Badge tone="success">Решено</Badge> : null}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="card p-4">
            <h2 className="label-xs mb-2">Теория</h2>
            {task.theory.map((block, i) =>
              block.kind === "text" ? (
                <Markdown key={i}>{block.md}</Markdown>
              ) : block.kind === "code" ? (
                <pre key={i} className="my-3 overflow-x-auto rounded-xl bg-subtle p-3 font-mono text-[13px] leading-relaxed">
                  {block.code}
                </pre>
              ) : (
                <Diagram key={i} block={block} />
              ),
            )}
            {task.lecture ? <p className="mt-3 text-xs text-muted">Подробнее: {task.lecture}</p> : null}
          </section>

          <section className="card p-4">
            <h2 className="label-xs mb-2">Задание</h2>
            <Markdown>{task.statement}</Markdown>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="label-xs">Подсказки</h2>
            {task.hints.slice(0, hintsShown).map((hint, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <Markdown className="min-w-0">{hint}</Markdown>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {hintsShown < task.hints.length ? (
                <Button variant="secondary" size="sm" onClick={showHint}>
                  Подсказка {hintsShown + 1} из {task.hints.length}
                </Button>
              ) : null}
              {!showSolution ? (
                <Button variant="ghost" size="sm" onClick={reveal}>
                  Показать эталон
                </Button>
              ) : null}
            </div>
            {showSolution ? <pre className="overflow-x-auto rounded-xl bg-subtle p-3 font-mono text-[13px] leading-relaxed">{task.solution}</pre> : null}
          </section>
        </div>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-4">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <span className="font-mono text-xs text-muted">{task.lang === "c" ? "solution.c" : "solution.cpp"}</span>
              <span className="text-xs text-muted">{saved ? "Сохранено" : "Сохраняется…"}</span>
            </div>
            <div className="h-[46vh] min-h-[320px]">
              <CodeEditor value={code} onChange={onChange} resetKey={resetKey} />
            </div>
          </section>

          {crashed ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                На этом устройстве компилятору не хватило памяти. Код можно писать и сохранять, а запускать лучше на компьютере.
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={retryCompiler}>
                Попробовать снова
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onRun} loading={busy === "run"} disabled={Boolean(busy) || crashed}>
              {busy === "run" ? null : <Play className="h-4 w-4" />} Запустить
            </Button>
            <Button onClick={onCheck} loading={busy === "check"} disabled={Boolean(busy) || crashed}>
              {busy === "check" ? null : <ShieldCheck className="h-4 w-4" />} Проверить
            </Button>
            <Button variant="ghost" onClick={copy}>
              <Clipboard className="h-4 w-4" /> Скопировать для разбора
            </Button>
            <Button variant="ghost" size="icon" aria-label="Сбросить к заготовке" title="Сбросить к заготовке" onClick={() => setAskReset(true)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {load ? (
            <div className="text-xs text-muted">
              Загружаю компилятор: {Math.min(100, Math.round((load.loaded / load.total) * 100))}% из {Math.round(load.total / 1048576)} МБ. Это нужно только один раз.
              <div className="mt-1 h-1 overflow-hidden rounded bg-subtle">
                <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.min(100, (load.loaded / load.total) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}

          <section className="card p-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                ["output", "Вывод"],
                ["tests", check?.built ? `Тесты ${passed}/${check.outcomes.length}` : "Тесты"],
              ]}
              className="mb-3"
            />
            {tab === "output" ? <OutputPanel report={run} /> : <TestsPanel report={check} />}
          </section>

          {solved && next ? (
            <Link href={`/embedded/${next.slug}`} className={buttonClass("secondary", "md", "w-full")}>
              Дальше: {next.title} <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
      <ConfirmDialog open={askReset} title="Сбросить код?" text="Текущий код заменится заготовкой." confirmLabel="Сбросить" onConfirm={reset} onClose={() => setAskReset(false)} />
    </div>
  );
}

const pre = "max-h-72 overflow-auto rounded-xl bg-subtle p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words";

function OutputPanel({ report }: { report: RunReport | null }) {
  if (!report) return <p className="text-sm text-muted">Нажми «Запустить», чтобы собрать и выполнить программу.</p>;
  return (
    <div className="space-y-2">
      {report.log.trim() ? <pre className={cn(pre, !report.built && "text-danger")}>{report.log.trim()}</pre> : null}
      {report.timedOut ? <Notice icon={Clock}>Программа остановлена: она не завершилась за 3 с.</Notice> : null}
      {report.result ? (
        <>
          <pre className={pre}>{report.result.stdout + report.result.stderr || "Программа ничего не вывела."}</pre>
          {report.result.truncated ? <Notice icon={AlertTriangle}>Вывод обрезан: программа напечатала слишком много.</Notice> : null}
          {report.result.trap ? <Notice icon={XCircle}>Программа упала: {report.result.trap}</Notice> : null}
          {!report.result.trap && report.result.exit !== 0 ? <Notice icon={AlertTriangle}>Код завершения: {report.result.exit}</Notice> : null}
        </>
      ) : null}
    </div>
  );
}

function Notice({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-sm text-warning">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function TestsPanel({ report }: { report: CheckReport | null }) {
  if (!report) return <p className="text-sm text-muted">Нажми «Проверить», чтобы запустить автотесты.</p>;
  if (!report.built) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-danger">Код не собрался.</p>
        <pre className={cn(pre, "text-danger")}>{report.log.trim()}</pre>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {report.outcomes.map((o, i) => (
        <OutcomeRow key={i} outcome={o} />
      ))}
    </ul>
  );
}

function OutcomeRow({ outcome: o }: { outcome: TestOutcome }) {
  const ok = o.status === "passed";
  const Icon = ok ? CheckCircle2 : o.status === "timeout" ? Clock : XCircle;
  return (
    <li className="text-sm">
      <div className="flex gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-success" : "text-danger")} />
        <span className="min-w-0">{o.name}</span>
      </div>
      {!ok ? (
        <div className="ml-6 mt-1 space-y-0.5 rounded-lg bg-subtle p-2 font-mono text-xs break-words">
          {o.expr ? <div className="text-muted">{o.expr}</div> : null}
          {o.expected !== undefined ? <div>ожидалось: {o.expected}</div> : null}
          {o.got !== undefined ? <div>получено: {o.got}</div> : null}
          {o.message ? <div className="font-sans">{o.message}</div> : null}
        </div>
      ) : null}
    </li>
  );
}
