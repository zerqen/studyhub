import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-accent text-white hover:bg-ink-600 dark:bg-accent dark:text-ink-950 dark:hover:bg-ink-400",
  secondary:
    "bg-ink-100 text-ink-900 border border-black/10 hover:bg-ink-200 dark:bg-ink-900 dark:text-ink-50 dark:border-white/10 dark:hover:bg-ink-800",
  ghost: "hover:bg-white/10",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
