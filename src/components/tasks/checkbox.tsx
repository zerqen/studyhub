"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  className,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-150",
        size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]",
        checked ? "border-success bg-success text-white" : "border-fg/25 text-transparent hover:border-success hover:text-success/50",
        className,
      )}
    >
      <Check className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />
    </button>
  );
}
