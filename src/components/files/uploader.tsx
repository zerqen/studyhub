"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/toast";
import { Button } from "../ui/button";

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
  const toast = useToast();
  const router = useRouter();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        if (parent?.subjectId) fd.set("subjectId", parent.subjectId);
        if (parent?.taskId) fd.set("taskId", parent.taskId);
        if (parent?.subtaskId) fd.set("subtaskId", parent.subtaskId);
        if (parent?.ticketId) fd.set("ticketId", parent.ticketId);
        if (parent?.questionId) fd.set("questionId", parent.questionId);
        if (parent?.noteId) fd.set("noteId", parent.noteId);
        if (parent?.commentId) fd.set("commentId", parent.commentId);
        if (parent?.avatar) fd.set("avatar", "1");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
      }
      toast.push("Файл загружен");
      router.refresh();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Ошибка загрузки", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={compact ? "inline-flex" : "block"}>
      <input type="file" className="hidden" multiple={!parent?.avatar} onChange={(e) => onFiles(e.target.files)} />
      <span>
        <Button type="button" variant="secondary" disabled={busy} className="pointer-events-none">
          {busy ? "Загрузка…" : parent?.avatar ? "Сменить аватар" : "Прикрепить файл"}
        </Button>
      </span>
    </label>
  );
}
