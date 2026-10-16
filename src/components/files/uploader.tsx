"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "../ui/toast";
import { buttonClass } from "../ui/button";

export function FileUploader({
  parent,
  compact,
}: {
  parent?: {
    subjectId?: string;
    taskId?: string;
    subtaskId?: string;
    ticketId?: string;
    questionId?: string;
    noteId?: string;
    commentId?: string;
    avatar?: boolean;
  };
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      // Файлы грузятся параллельно
      await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.set("file", file);
          for (const key of ["subjectId", "taskId", "subtaskId", "ticketId", "questionId", "noteId", "commentId"] as const) {
            const v = parent?.[key];
            if (v) fd.set(key, v);
          }
          if (parent?.avatar) fd.set("avatar", "1");
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const json = await res.json().catch(() => ({ ok: false, error: "Ошибка загрузки" }));
          if (!json.ok) throw new Error(json.error ?? "Ошибка загрузки");
        }),
      );
      toast.push(files.length === 1 ? "Файл загружен" : `Загружено файлов: ${files.length}`);
      router.refresh();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Ошибка загрузки", "err");
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      multiple={!parent?.avatar}
      accept={parent?.avatar ? "image/*" : undefined}
      onChange={(e) => {
        void onFiles(e.target.files);
        e.currentTarget.value = "";
      }}
    />
  );

  if (compact || parent?.avatar) {
    return (
      <label className={cn(buttonClass("secondary", "sm"), "cursor-pointer", busy && "pointer-events-none opacity-60")}>
        {input}
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {busy ? "Загрузка…" : parent?.avatar ? "Сменить фото" : "Прикрепить"}
      </label>
    );
  }

  return (
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
      <span className="text-sm font-medium">{busy ? "Загружаю…" : dragging ? "Отпусти, чтобы загрузить" : "Перетащи файлы или нажми, чтобы выбрать"}</span>
      <span className="text-xs text-muted">PDF, документы, картинки, аудио · до 15 МБ</span>
    </label>
  );
}
