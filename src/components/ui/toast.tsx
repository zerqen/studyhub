"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Action = { label: string; onClick: () => void };
type Toast = { id: number; text: string; kind: "ok" | "err"; action?: Action };
type Push = (text: string, kind?: "ok" | "err", options?: { action?: Action; duration?: number }) => void;

const Ctx = createContext<{ push: Push; undoable: Undoable } | null>(null);

/**
 * Удаление с возможностью отмены: элемент сразу скрывается,
 * а настоящее удаление выполняется через 5 секунд, если не нажали «Отменить».
 */
type Undoable = (options: { text: string; hide: () => void; restore: () => void; commit: () => Promise<{ ok: boolean; error?: string }> }) => void;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((s) => s.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback<Push>(
    (text, kind = "ok", options) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { id, text, kind, action: options?.action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), options?.duration ?? (kind === "err" ? 4500 : 2400)));
    },
    [dismiss],
  );

  const undoable = useCallback<Undoable>(
    ({ text, hide, restore, commit }) => {
      hide();
      let cancelled = false;
      const timer = setTimeout(async () => {
        if (cancelled) return;
        const r = await commit();
        if (!r.ok) {
          restore();
          push(r.error ?? "Не удалось удалить", "err");
        }
      }, 5000);
      push(text, "ok", {
        duration: 5000,
        action: {
          label: "Отменить",
          onClick: () => {
            cancelled = true;
            clearTimeout(timer);
            restore();
          },
        },
      });
    },
    [push],
  );

  const value = useMemo(() => ({ push, undoable }), [push, undoable]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-pop">
            {t.kind === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <XCircle className="h-4 w-4 shrink-0 text-danger" />}
            <span>{t.text}</span>
            {t.action ? (
              <button
                className="-my-1 ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-accent hover:bg-accent/10"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
