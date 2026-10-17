"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Paperclip, UploadCloud } from "lucide-react";
import { DIRECT_UPLOAD_THRESHOLD, MAX_DIRECT_FILE_SIZE, maxServerSize } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "../ui/toast";
import { buttonClass } from "../ui/button";

export type UploadParent = {
  subjectId?: string;
  taskId?: string;
  subtaskId?: string;
  ticketId?: string;
  questionId?: string;
  noteId?: string;
  commentId?: string;
  lectureId?: string;
  examItemId?: string;
  avatar?: boolean;
};

const KEYS = ["subjectId", "taskId", "subtaskId", "ticketId", "questionId", "noteId", "commentId", "lectureId", "examItemId"] as const;

let directEnabled: Promise<boolean> | null = null;
function canUploadDirect() {
  directEnabled ??= fetch("/api/upload/blob")
    .then((r) => r.json())
    .then((j: { enabled?: boolean }) => Boolean(j.enabled))
    .catch(() => false);
  return directEnabled;
}

/** Обычные файлы — через сервер; большие (записи лекций) — напрямую в Vercel Blob */
export async function uploadFile(file: File, parent: UploadParent | undefined, onProgress?: (pct: number) => void) {
  if (!parent?.avatar && file.size > DIRECT_UPLOAD_THRESHOLD && (await canUploadDirect())) {
    if (file.size > MAX_DIRECT_FILE_SIZE) throw new Error(`«${file.name}» больше ${MAX_DIRECT_FILE_SIZE / 1024 / 1024} МБ`);
    const payload = Object.fromEntries(KEYS.filter((k) => parent?.[k]).map((k) => [k, parent![k]]));
    {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`studyhub/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload/blob",
        clientPayload: JSON.stringify(payload),
        multipart: file.size > 50 * 1024 * 1024,
        onUploadProgress: (e) => onProgress?.(Math.round(e.percentage)),
      });
      const res = await fetch("/api/upload/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, pathname: blob.pathname, name: file.name, mimeType: file.type, size: file.size, parent: payload }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка загрузки");
      return;
    }
  }
  // Без Vercel Blob (локальная разработка) всё идёт через сервер: записи — до 90 МБ, остальное — до 15 МБ
  const limit = maxServerSize(file.type);
  if (file.size > limit && !parent?.avatar) {
    throw new Error(`«${file.name}» больше ${limit / 1024 / 1024} МБ`);
  }
  const fd = new FormData();
  fd.set("file", file);
  for (const key of KEYS) {
    const v = parent?.[key];
    if (v) fd.set(key, v);
  }
  if (parent?.avatar) fd.set("avatar", "1");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json().catch(() => ({
    ok: false,
    // На Vercel через сервер проходит не больше 4,5 МБ — большие файлы идут напрямую в Vercel Blob
    error: res.status === 413 ? "Файл слишком большой для загрузки через сервер — подключи Vercel Blob (Storage → Blob) в проекте Vercel" : "Ошибка загрузки",
  }));
  if (!json.ok) throw new Error(json.error ?? "Ошибка загрузки");
}

export function FileUploader({
  parent,
  compact,
  camera,
  accept,
  label,
  hint,
}: {
  parent?: UploadParent;
  compact?: boolean;
  /** Показать кнопку «Снять фото» (на телефоне открывает камеру) */
  camera?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy(true);
    setProgress(null);
    try {
      await Promise.all(list.map((file) => uploadFile(file, parent, list.length === 1 ? setProgress : undefined)));
      toast.push(list.length === 1 ? "Файл загружен" : `Загружено файлов: ${list.length}`);
      router.refresh();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Ошибка загрузки", "err");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      multiple={!parent?.avatar}
      accept={parent?.avatar ? "image/*" : accept}
      onChange={(e) => {
        void onFiles(e.target.files);
        e.currentTarget.value = "";
      }}
    />
  );
  const busyLabel = progress !== null && progress < 100 ? `Загрузка ${progress}%` : "Загрузка…";

  const cameraButton = camera ? (
    <label className={cn(buttonClass("secondary", compact ? "sm" : "md"), "cursor-pointer sm:hidden", busy && "pointer-events-none opacity-60")}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <Camera className="h-3.5 w-3.5" /> Снять фото
    </label>
  ) : null;

  if (compact || parent?.avatar) {
    return (
      <span className="inline-flex flex-wrap gap-2">
        <label className={cn(buttonClass("secondary", "sm"), "cursor-pointer", busy && "pointer-events-none opacity-60")}>
          {input}
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {busy ? busyLabel : parent?.avatar ? "Сменить фото" : label ?? "Прикрепить"}
        </label>
        {cameraButton}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-line hover:border-fg/20 hover:bg-subtle/40",
          busy && "pointer-events-none opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void onFiles(event.dataTransfer.files);
        }}
      >
        {input}
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-muted" /> : <UploadCloud className={cn("h-6 w-6", dragging ? "text-accent" : "text-muted")} />}
        <span className="text-sm font-medium">{busy ? busyLabel : dragging ? "Отпусти, чтобы загрузить" : label ?? "Перетащи файлы или нажми, чтобы выбрать"}</span>
        <span className="text-xs text-muted">{hint ?? "PDF, документы, картинки, аудио · записи лекций — до 300 МБ"}</span>
        {progress !== null ? (
          <span className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-subtle">
            <span className="block h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </label>
      {cameraButton ? <div className="flex justify-center">{cameraButton}</div> : null}
    </div>
  );
}
