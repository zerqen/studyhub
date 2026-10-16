"use client";

import { useState } from "react";
import { Download, ExternalLink, File, FileArchive, FileAudio, FileImage, FileText, Trash2 } from "lucide-react";
import { deleteAttachment } from "@/actions/attachments";
import { ConfirmDialog } from "../ui/modal";
import { useToast } from "../ui/toast";
import { cn } from "@/lib/utils";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime === "application/zip") return FileArchive;
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word") || mime.includes("presentation")) return FileText;
  return File;
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase() : "";
}

export function FileGrid({ files, compact }: { files: FileItem[]; compact?: boolean }) {
  const [del, setDel] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toast = useToast();
  const visible = files.filter((f) => !hidden.has(f.id));

  if (!visible.length) return compact ? null : <p className="text-sm text-muted">Файлов пока нет.</p>;

  if (compact) {
    return (
      <ul className="space-y-1">
        {visible.map((f) => {
          const Icon = fileIcon(f.mimeType);
          return (
            <li key={f.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-accent">
                {f.originalName}
              </a>
              <button className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100" onClick={() => setDel(f.id)} aria-label="Удалить файл">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
        <Confirm del={del} setDel={setDel} onDeleted={(id) => setHidden((s) => new Set(s).add(id))} toast={toast} />
      </ul>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((f) => {
          const Icon = fileIcon(f.mimeType);
          const image = f.mimeType.startsWith("image/");
          return (
            <div key={f.id} className="card group overflow-hidden">
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="block">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${f.id}`} alt={f.originalName} loading="lazy" className="aspect-[4/3] w-full bg-subtle object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-subtle/60">
                    <div className="flex flex-col items-center gap-1.5 text-muted">
                      <Icon className="h-8 w-8" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold tracking-wide">{ext(f.originalName)}</span>
                    </div>
                  </div>
                )}
              </a>
              <div className="flex items-center gap-1 p-2.5 pl-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" title={f.originalName}>
                    {f.originalName}
                  </div>
                  <div className="text-xs text-muted">{fileSize(f.size)}</div>
                </div>
                <div className={cn("flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100")}>
                  <a className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" aria-label="Открыть">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg" href={`/api/files/${f.id}?download=1`} aria-label="Скачать">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setDel(f.id)} aria-label="Удалить">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Confirm del={del} setDel={setDel} onDeleted={(id) => setHidden((s) => new Set(s).add(id))} toast={toast} />
    </>
  );
}

function Confirm({
  del,
  setDel,
  onDeleted,
  toast,
}: {
  del: string | null;
  setDel: (v: string | null) => void;
  onDeleted: (id: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  return (
    <ConfirmDialog
      open={!!del}
      onClose={() => setDel(null)}
      title="Удалить файл?"
      text="Файл будет удалён безвозвратно."
      onConfirm={async () => {
        if (!del) return;
        const res = await deleteAttachment(del);
        if (!res.ok) toast.push(res.error, "err");
        else {
          onDeleted(del);
          toast.push("Файл удалён");
        }
        setDel(null);
      }}
    />
  );
}
