import { cn } from "@/lib/utils";
import type { DiagramTone, TheoryBlock } from "@/lib/embedded/types";

const tones: Record<DiagramTone, string> = {
  plain: "border-line bg-surface",
  accent: "border-accent/40 bg-accent/10",
  warn: "border-warning/40 bg-warning/10",
  muted: "border-line bg-subtle text-muted",
};

export function Diagram({ block }: { block: Extract<TheoryBlock, { kind: "diagram" }> }) {
  return (
    <figure className="my-3 overflow-x-auto">
      <div className="inline-flex min-w-full flex-col gap-1.5">
        {block.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {row.label ? <span className="w-[4.5rem] shrink-0 font-mono text-xs text-muted">{row.label}</span> : null}
            <div className="flex gap-0.5">
              {row.cells.map((cell, k) => (
                <div key={k} className={cn("min-w-8 rounded-md border px-1.5 py-1 text-center font-mono text-[13px] leading-tight whitespace-nowrap", tones[cell.tone ?? "plain"])}>
                  {cell.text}
                  {cell.sub ? <span className="block font-sans text-[10px] text-muted">{cell.sub}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-muted">{block.caption}</figcaption>
    </figure>
  );
}
