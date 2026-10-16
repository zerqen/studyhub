import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = Sparkles,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center", className)}>
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-subtle text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-medium">{title}</h3>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
