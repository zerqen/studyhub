"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Plus } from "lucide-react";
import { Button, buttonClass } from "../ui/button";
import { Modal } from "../ui/modal";
import { PageHeader } from "../ui/page";
import { SubjectForm } from "./subject-form";

export function SubjectsHeader({ archived, count }: { archived: boolean; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title={archived ? "Архив предметов" : "Предметы"}
        description={archived ? `${count} в архиве` : count ? `${count} в работе` : undefined}
        back={archived ? { href: "/subjects", label: "Активные предметы" } : undefined}
        actions={
          <>
            {!archived ? (
              <Link href="/subjects?archived=1" className={buttonClass("ghost")}>
                <Archive className="h-4 w-4" /> Архив
              </Link>
            ) : null}
            <Button onClick={() => setOpen(true)}>
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
