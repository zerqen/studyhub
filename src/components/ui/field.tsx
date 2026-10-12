import { cn } from "@/lib/utils";
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none ring-info/40 focus:ring-2 dark:border-white/10 dark:bg-ink-900 dark:text-ink-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none ring-info/40 focus:ring-2 dark:border-white/10 dark:bg-ink-900 dark:text-ink-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none ring-info/40 focus:ring-2 dark:border-white/10 dark:bg-ink-900 dark:text-ink-50",
        className,
      )}
      {...props}
    />
  );
}
