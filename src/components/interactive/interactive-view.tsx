"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteInteractive } from "@/actions/interactives";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/modal";
import { PageHeader } from "../ui/page";
import { useToast } from "../ui/toast";
import { InteractiveFrame } from "./interactive-frame";
import { InteractiveForm, type SubjectOption } from "./interactive-form";

type Item = {
  id: string;
  title: string;
  description: string;
  size: number;
  updatedAt: string;
  subjectId: string | null;
  lectureId: string | null;
  subject: { id: string; name: string; emoji: string; color: string } | null;
  lecture: { id: string; title: string; number: number | null } | null;
};

export function InteractiveView({ item, subjects }: { item: Item; subjects: SubjectOption[] }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const back = item.lecture
    ? { href: `/lectures/${item.lecture.id}`, label: `Лекция ${item.lecture.number ?? ""} · ${item.lecture.title}` }
    : item.subject
      ? { href: `/subjects/${item.subject.id}?tab=interactives`, label: item.subject.name }
      : { href: "/interactives", label: "Интерактивы" };

  return (
    <div>
      <PageHeader
        back={back}
        title={item.title}
        description={item.description || undefined}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Изменить">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-danger" onClick={() => setDeleting(true)} aria-label="Удалить">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <InteractiveFrame id={item.id} title={item.title} version={item.updatedAt} height="min(80vh, 860px)" />
      <p className="mt-2 text-xs text-muted">
        Схема работает в изолированной рамке: её скрипты не видят твой аккаунт и данные сайта.
      </p>

      <Modal open={editing} onClose={() => setEditing(false)} title="Изменить схему">
        <InteractiveForm
          initial={{ id: item.id, title: item.title, description: item.description, subjectId: item.subjectId, lectureId: item.lectureId }}
          subjects={subjects}
          onDone={() => setEditing(false)}
        />
      </Modal>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить схему?"
        text={`«${item.title}» удалится насовсем.`}
        onConfirm={async () => {
          const r = await deleteInteractive(item.id);
          if (!r.ok) return toast.push(r.error, "err");
          toast.push("Схема удалена");
          router.replace(back.href);
          router.refresh();
        }}
      />
    </div>
  );
}
