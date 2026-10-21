import { BookOpen, ClipboardCheck, FlaskConical, PencilRuler, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskKind } from "@/lib/task-kinds";

export const KIND_ICONS: Record<string, LucideIcon | undefined> = {
  HOMEWORK: BookOpen,
  LAB: FlaskConical,
  TEST: ClipboardCheck,
  DRAWING: PencilRuler,
};

/** Тип задачи — спокойная метка с иконкой, в строке с предметом и сроком */
export function KindChip({ kind, className }: { kind?: string | null; className?: string }) {
  if (!kind || kind === "TASK") return null;
  const k = taskKind(kind);
  const Icon = KIND_ICONS[kind];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 text-[11px] font-medium leading-none text-fg/75", className)}>
      {Icon ? <Icon className="h-3 w-3 text-muted" /> : null}
      {k.label}
    </span>
  );
}
