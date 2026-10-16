import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export type Tone = keyof typeof tones;

export function Badge({
  children,
  className,
  tone = "neutral",
  dot,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium", tones[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${v}%`, background: color ?? "rgb(var(--accent))" }} />
    </div>
  );
}

/** Круговой индикатор прогресса */
export function ProgressRing({ value, size = 44, stroke = 4, color }: { value: number; size?: number; stroke?: number; color?: string }) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--subtle))" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color ?? "rgb(var(--accent))"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (v / 100) * c}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}
