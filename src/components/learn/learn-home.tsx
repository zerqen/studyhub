"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Compass, Link2, Plus } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { EmptyState } from "../ui/empty";
import { PageHeader } from "../ui/page";
import { TrackForm } from "./track-form";

type Track = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
  linkedSubject: { id: string; name: string; emoji: string } | null;
  topics: number;
  questions: number;
  interactives: number;
  lastAt: string;
};

type Recent = { id: string; title: string; number: number | null; updatedAt: string; subject: { id: string; name: string; emoji: string; color: string } };

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

export function LearnHome({
  tracks,
  recent,
  subjects,
  archived,
  archivedCount,
}: {
  tracks: Track[];
  recent: Recent[];
  subjects: { id: string; name: string; emoji: string }[];
  archived: boolean;
  archivedCount: number;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        title={archived ? "Архив направлений" : "Изучаю"}
        description={archived ? undefined : "Саморазвитие вне вуза: курсы, доп. темы, что интересно"}
        back={archived ? { href: "/learn", label: "Изучаю" } : undefined}
        actions={
          archived ? null : (
            <>
              {archivedCount ? (
                <Link href="/learn?archived=1" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg">
                  <Archive className="h-4 w-4" /> Архив {archivedCount}
                </Link>
              ) : null}
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Направление
              </Button>
            </>
          )
        }
      />

      {recent.length ? (
        <section className="mb-7">
          <h2 className="mb-3 text-sm font-semibold text-muted">Недавно</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {recent.map((r) => (
              <Link key={r.id} href={`/lectures/${r.id}`} className="card card-hover relative w-64 shrink-0 snap-start overflow-hidden p-4 pl-5 sm:w-auto">
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: r.subject.color }} />
                <div className="truncate text-xs text-muted">
                  {r.subject.emoji} {r.subject.name}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{r.title}</div>
                <div className="mt-2 text-xs text-muted">{formatRelative(r.updatedAt)}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {tracks.length === 0 ? (
        archived ? (
          <EmptyState icon={Archive} title="Архив пуст" action={<Link href="/learn" className="inline-flex items-center gap-1 text-sm text-accent"><ArrowLeft className="h-4 w-4" /> Назад</Link>} />
        ) : (
          <EmptyState
            icon={Compass}
            title="Пока ни одного направления"
            hint="Направление — это папка для свободного изучения: «Матан глубже», «Схемотехника для себя», курс, который проходишь. Внутри темы с конспектами, схемами и вопросами."
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Первое направление
              </Button>
            }
          />
        )
      ) : (
        <section>
          {!archived ? <h2 className="mb-3 text-sm font-semibold text-muted">Направления</h2> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => (
              <Link key={t.id} href={`/learn/${t.id}`} className="card card-hover group flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl transition-transform duration-200 group-hover:scale-105" style={{ background: `${t.color}1a` }}>
                    {t.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="block text-xs text-muted">
                      {t.topics} {plural(t.topics, "тема", "темы", "тем")}
                      {t.questions ? ` · ${t.questions} ${plural(t.questions, "вопрос", "вопроса", "вопросов")}` : ""}
                      {t.interactives ? ` · ${t.interactives} ${plural(t.interactives, "схема", "схемы", "схем")}` : ""}
                    </span>
                  </span>
                </div>
                {t.description ? <p className="mt-3 line-clamp-2 text-sm text-muted">{t.description}</p> : null}
                <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
                  {t.linkedSubject ? (
                    <span className="inline-flex min-w-0 items-center gap-1 truncate">
                      <Link2 className="h-3 w-3 shrink-0" /> {t.linkedSubject.emoji} {t.linkedSubject.name}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0">{formatRelative(t.lastAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Новое направление" description="Без целей и счётчиков — просто место, где копится то, что разобрал">
        <TrackForm subjects={subjects} onDone={() => setAdding(false)} />
      </Modal>
    </div>
  );
}
