import { useEffect } from "react";
import type { DesktopState } from "../../electron/types";
import { QuickAddBar } from "../components/QuickAddBar";

export function QuickAddPopup({ state }: { state: DesktopState }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void window.studyhub.hideQuickAdd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col justify-center bg-bg p-4">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted">
        <span className="font-semibold text-fg">Быстрая задача · StudyHub</span>
        <span>Enter — добавить · Esc — скрыть</span>
      </div>
      <QuickAddBar
        autoFocus
        subjects={state.snapshot.subjects}
        onCreate={(parsed) => {
          void window.studyhub.createTask({
            title: parsed.title,
            subjectId: parsed.subjectId,
            dueDate: parsed.dueDateIso,
            dueTime: parsed.dueTime,
            priority: "MEDIUM",
            kind: parsed.kind,
          });
          void window.studyhub.hideQuickAdd();
        }}
      />
    </div>
  );
}
