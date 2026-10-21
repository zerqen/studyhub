"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorPlay, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { EmptyState } from "../ui/empty";
import { PageHeader } from "../ui/page";
import { InteractiveCards, type InteractiveCard } from "./interactive-cards";
import { InteractiveForm, type SubjectOption } from "./interactive-form";

type Item = InteractiveCard & { subject: (InteractiveCard["subject"] & { id: string }) | null };

export function InteractivesGallery({ items, subjects }: { items: Item[]; subjects: SubjectOption[] }) {
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  // Группы по предметам; без предмета — в конце
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; items: Item[] }>();
    for (const it of items) {
      const key = it.subject?.id ?? "";
      if (!map.has(key)) map.set(key, { key, title: it.subject ? `${it.subject.emoji} ${it.subject.name}` : "Без предмета", items: [] });
      map.get(key)!.items.push(it);
    }
    return [...map.values()].sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.title.localeCompare(b.title, "ru")));
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Интерактивы"
        description="Схемы и симуляции, которые запускаются прямо здесь"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Схема
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={MonitorPlay}
          title="Пока пусто"
          hint="Загрузи .html-файл или вставь код страницы — например, симуляцию схемы из чата. Она запустится в защищённой рамке."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Первая схема
            </Button>
          }
        />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-3 text-sm font-semibold text-muted">
                {g.title} <span className="font-normal">{g.items.length}</span>
              </h2>
              <InteractiveCards items={g.items} />
            </section>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Новая схема" description="HTML запускается изолированно: у него нет доступа к твоему аккаунту">
        <InteractiveForm subjects={subjects} onDone={(id) => router.push(`/interactives/${id}`)} />
      </Modal>
    </div>
  );
}
