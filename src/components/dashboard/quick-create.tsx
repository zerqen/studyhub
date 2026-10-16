"use client";

import { useState } from "react";
import { BookOpen, NotebookPen, Plus } from "lucide-react";
import { Modal } from "../ui/modal";
import { SubjectForm } from "../subjects/subject-form";
import { TaskForm } from "../tasks/task-form";
import { NoteEditor } from "../notes/note-editor";
import { Button } from "../ui/button";

export function QuickCreate({ subjects = [] }: { subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState<null | "subject" | "task" | "note">(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen("task")}>
        <Plus className="h-4 w-4" /> Задача
      </Button>
      <Button variant="secondary" onClick={() => setOpen("subject")}>
        <BookOpen className="h-4 w-4" /> Предмет
      </Button>
      <Button variant="secondary" onClick={() => setOpen("note")}>
        <NotebookPen className="h-4 w-4" /> Заметка
      </Button>
      <Modal open={open === "subject"} onClose={() => setOpen(null)} title="Новый предмет">
        <SubjectForm onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "task"} onClose={() => setOpen(null)} title="Новая задача">
        <TaskForm subjects={subjects} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "note"} onClose={() => setOpen(null)} title="Новая заметка" className="sm:max-w-2xl">
        <NoteEditor subjects={subjects} onDone={() => setOpen(null)} />
      </Modal>
    </div>
  );
}
