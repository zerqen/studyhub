import { FolderOpen, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { AttachmentDto } from "../../electron/types";
import { extBadge, formatBytes, kindOf } from "../lib/files-view";

export function AttachmentList({
  attachments,
  cachedIds,
  busyId,
  transcribingId,
  onOpen,
  onReveal,
  onDelete,
  onTranscribe,
}: {
  attachments: AttachmentDto[];
  cachedIds: ReadonlySet<string>;
  busyId: string | null;
  transcribingId?: string | null;
  onOpen: (att: AttachmentDto) => void;
  onReveal?: (att: AttachmentDto) => void;
  onDelete?: (att: AttachmentDto) => void;
  onTranscribe?: (att: AttachmentDto) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att) => {
        const kind = kindOf(att.originalName, att.mimeType);
        const isAudio = kind === "audio";
        const isCached = cachedIds.has(att.id);
        const isBusy = busyId === att.id;
        const isTrans = transcribingId === att.id;

        return (
          <div key={att.id} className="rounded-xl border border-line bg-subtle/60 p-2.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpen(att)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <span className="grid h-8 w-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-[11px] font-bold text-accent">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : extBadge(att.originalName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg hover:text-accent">{att.originalName}</div>
                  <div className="text-xs text-muted">
                    {formatBytes(att.size)}
                    {isCached ? <span className="ml-1.5 text-success">· Оффлайн</span> : null}
                  </div>
                </div>
              </button>

              {onReveal ? (
                <button
                  type="button"
                  title="Показать в папке"
                  onClick={() => onReveal(att)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  title="Удалить файл"
                  onClick={() => onDelete(att)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {isAudio && onTranscribe ? (
              <button
                type="button"
                disabled={isTrans}
                onClick={() => onTranscribe(att)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface py-1.5 text-xs font-medium text-fg hover:border-accent/50 disabled:opacity-60"
              >
                {isTrans ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />}
                {isTrans ? "Расшифровываем аудио…" : "Расшифровать аудио (ИИ)"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
