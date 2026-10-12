"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { SubjectForm } from "./subject-form";

export function SubjectsHeader({ archived }: { archived: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="mr-auto text-2xl font-semibold">Предметы</h1>
      <Link href={archived ? "/subjects" : "/subjects?archived=1"} className="text-sm underline">
        {archived ? "Активные" : "Архив"}
      </Link>
      <Button onClick={() => setOpen(true)}>Новый предмет</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новый предмет">
        <SubjectForm onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
