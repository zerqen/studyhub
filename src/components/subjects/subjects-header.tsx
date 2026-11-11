"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, buttonClass } from "../ui/button";
import { Modal } from "../ui/modal";
import { PageHeader } from "../ui/page";
import { SubjectForm } from "./subject-form";

export function SubjectsHeader({ archived, count, semester, startOpen }: { archived: boolean; count: number; semester?: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(startOpen));
  return (
    <>
      <PageHeader
        title={archived ? "Архив предметов" : "Предметы"}
        description={archived ? `${count} в архиве` : count ? `${count} в работе${semester ? ` · ${semester}` : ""}` : undefined}
        back={archived ? { href: "/subjects", label: "Активные предметы" } : undefined}
        actions={
          <>
            {!archived ? (
              <Link href="/subjects?archived=1" className={buttonClass("secondary", "md", "h-10 rounded-[10px] px-3.5")}>
                Архив
              </Link>
            ) : null}
            <Button onClick={() => setOpen(true)} className="h-10 rounded-[10px] px-4 font-semibold">
              <Plus className="h-4 w-4" /> Новый предмет
            </Button>
          </>
        }
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Новый предмет">
        <SubjectForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
