"use client";

import { deleteAttachment } from "@/actions/attachments";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "../ui/modal";
import { useState } from "react";
import { useToast } from "../ui/toast";

type FileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
};

function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function FileGrid({ files }: { files: FileItem[] }) {
  const [del, setDel] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  if (!files.length) return <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((f) => (
          <div key={f.id} className="overflow-hidden rounded-2xl border border-black/5 bg-[var(--bg-elev)] dark:border-white/10">
            {isImage(f.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${f.id}`} alt={f.originalName} className="h-36 w-full object-cover" />
            ) : (
              <div className="grid h-36 place-items-center bg-black/5 text-sm dark:bg-white/5">{f.mimeType}</div>
            )}
            <div className="space-y-2 p-3">
              <div className="truncate text-sm font-medium">{f.originalName}</div>
              <div className="text-xs text-[var(--muted)]">{(f.size / 1024).toFixed(0)} КБ</div>
              <div className="flex gap-2 text-xs">
                <a className="underline" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                  Открыть
                </a>
                <a className="underline" href={`/api/files/${f.id}?download=1`}>
                  Скачать
                </a>
                <button className="text-rose-600" onClick={() => setDel(f.id)}>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="Удалить файл?"
        text="Файл будет удалён безвозвратно."
        onConfirm={async () => {
          if (!del) return;
          const res = await deleteAttachment(del);
          if (!res.ok) toast.push(res.error, "err");
          else toast.push("Файл удалён");
          setDel(null);
          router.refresh();
        }}
      />
    </>
  );
}
