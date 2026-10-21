"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, Play, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Запуск схемы в изолированной рамке. Страница схемы приходит с CSP sandbox,
 * а у рамки — sandbox без allow-same-origin: двойная защита, у схемы нет доступа к сайту.
 */
export function InteractiveFrame({
  id,
  title,
  version,
  autoload = true,
  className,
  height = "min(78vh, 760px)",
}: {
  id: string;
  title: string;
  /** Метка версии (updatedAt) — новый адрес после правки, чтобы не показывать старое из кеша */
  version?: string;
  autoload?: boolean;
  className?: string;
  height?: string;
}) {
  const [run, setRun] = useState(autoload);
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);
  const [reload, setReload] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const src = `/api/interactive/${id}${version ? `?v=${encodeURIComponent(version)}` : ""}`;

  const exitFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setFull(false);
  }, []);

  function enterFull() {
    setFull(true);
    // Настоящий полноэкранный режим, где он есть; на iPhone остаётся «окно на весь экран»
    box.current?.requestFullscreen?.().catch(() => undefined);
  }

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitFull();
    const onChange = () => !document.fullscreenElement && setFull(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onChange);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onChange);
      document.body.style.overflow = prev;
    };
  }, [full, exitFull]);

  if (!run) {
    return (
      <button
        type="button"
        onClick={() => setRun(true)}
        className={cn(
          "group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-subtle/40 py-10 text-sm font-medium text-muted transition-colors hover:border-accent/40 hover:text-accent",
          className,
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg transition-transform group-hover:scale-105">
          <Play className="h-4 w-4 translate-x-px" />
        </span>
        Запустить
      </button>
    );
  }

  return (
    <div
      ref={box}
      className={cn(
        "relative flex flex-col overflow-hidden border border-line bg-white",
        full ? "fixed inset-0 z-[70] rounded-none border-0" : "rounded-xl",
        className,
      )}
      style={full ? undefined : { height }}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-surface px-2 py-1">
        <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted">{title}</span>
        <ToolButton label="Перезапустить" onClick={() => { setLoading(true); setReload((n) => n + 1); }}>
          <RotateCw className="h-3.5 w-3.5" />
        </ToolButton>
        <a href={src} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg" title="Открыть в новой вкладке" aria-label="Открыть в новой вкладке">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <ToolButton label={full ? "Свернуть" : "На весь экран"} onClick={full ? exitFull : enterFull}>
          {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </ToolButton>
      </div>
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center bg-surface text-sm text-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        ) : null}
        <iframe
          key={reload}
          src={src}
          title={title}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock"
          allow="fullscreen"
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setLoading(false)}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg" title={label} aria-label={label}>
      {children}
    </button>
  );
}
