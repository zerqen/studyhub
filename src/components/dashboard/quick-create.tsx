"use client";

import { useState } from "react";
import { Modal } from "../ui/modal";
import { SubjectForm } from "../subjects/subject-form";
import { TaskForm } from "../tasks/task-form";
import { NoteEditor } from "../notes/note-editor";
import { Button } from "../ui/button";

export function QuickCreate({ subjects = [] }: { subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState<null | "subject" | "task" | "note">(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen("subject")}>Предмет</Button>
      <Button variant="secondary" onClick={() => setOpen("task")}>
        Задача
      </Button>
      <Button variant="secondary" onClick={() => setOpen("note")}>
        Заметка
      </Button>
      <Modal open={open === "subject"} onClose={() => setOpen(null)} title="Новый предмет">
        <SubjectForm onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "task"} onClose={() => setOpen(null)} title="Новая задача">
        <TaskForm subjects={subjects} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "note"} onClose={() => setOpen(null)} title="Новая заметка" className="sm:max-w-2xl">
        <NoteEditor subjects={subjects} />
      </Modal>
    </div>
  );
}
