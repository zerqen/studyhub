"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowUpRight, FileText, HelpCircle, Link2, MonitorPlay, MoreHorizontal, Paperclip, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { archiveTrack, deleteTrack } from "@/actions/learn";
import { cn, formatRelative } from "@/lib/utils";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/modal";
import { EmptyState } from "../ui/empty";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";
import { LectureForm } from "../lectures/lecture-form";
import { StudyMode, type StudyQuestion } from "../study/study-mode";
import { InteractiveCards, type InteractiveCard } from "../interactive/interactive-cards";
import { TrackForm } from "./track-form";

type Track = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
  archived: boolean;
  linkedSubjectId: string | null;
  linkedSubject: { id: string; name: string; emoji: string } | null;
};

type Topic = { id: string; number: number | null; title: string; words: number; questions: number; interactives: number; files: number; updatedAt: string };

export function TrackView({
  track,
  topics,
  interactives,
  questions,
  subjects,
}: {
  track: Track;
  topics: Topic[];
  interactives: InteractiveCard[];
  questions: StudyQuestion[];
  subjects: { id: string; name: string; emoji: string }[];
}) {
  const [open, setOpen] = useState<null | "topic" | "edit">(null);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const [training, setTraining] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function toggleArchive() {
    setMenu(false);
    const r = await archiveTrack(track.id, !track.archived);
    if (!r.ok) return toast.push(r.error, "err");
    toast.push(track.archived ? "Направление вернулось" : "Направление в архиве");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/learn" className="mb-4 inline-flex items-center text-sm text-muted transition-colors hover:text-fg">
        ← Изучаю
      </Link>

      <div className="card relative mb-6 overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: track.color }} />
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${track.color}1a` }}>
            {track.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{track.name}</h1>
            {track.description ? (
              <div className="mt-1 text-sm text-muted">
                <Markdown>{track.description}</Markdown>
              </div>
            ) : null}
            {track.linkedSubject ? (
              <Link href={`/subjects/${track.linkedSubject.id}?tab=lectures`} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-accent">
                <Link2 className="h-3 w-3" /> {track.linkedSubject.emoji} {track.linkedSubject.name}
              </Link>
            ) : null}
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setMenu((m) => !m)} aria-label="Ещё">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menu ? (
              <>
                <button className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-hidden tabIndex={-1} />
                <div className="absolute right-0 top-10 z-40 w-48 animate-pop-in rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <MenuItem onClick={() => { setMenu(false); setOpen("edit"); }} icon={Pencil}>Изменить</MenuItem>
                  <MenuItem onClick={() => void toggleArchive()} icon={track.archived ? ArchiveRestore : Archive}>{track.archived ? "Из архива" : "В архив"}</MenuItem>
                  <MenuItem onClick={() => { setMenu(false); setDel(true); }} icon={Trash2} danger>Удалить</MenuItem>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted">Темы {topics.length ? <span className="font-normal">{topics.length}</span> : null}</h2>
            <Button size="sm" onClick={() => setOpen("topic")}>
              <Plus className="h-3.5 w-3.5" /> Тема
            </Button>
          </div>
          {topics.length === 0 ? (
            <EmptyState
              title="Тем пока нет"
              hint="Тема — то, что разобрал: конспект-книга с формулами и рисунками, схемы, вопросы для самопроверки. Конспект можно вставить прямо из чата."
              action={
                <Button onClick={() => setOpen("topic")}>
                  <Plus className="h-4 w-4" /> Первая тема
                </Button>
              }
            />
          ) : (
            <ol className="card divide-y divide-line overflow-hidden">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link href={`/lectures/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums" style={{ background: `${track.color}1a`, color: track.color }}>
                      {t.number ?? "·"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                        {t.words ? (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" /> конспект
                          </span>
                        ) : (
                          <span>пусто</span>
                        )}
                        {t.interactives ? (
                          <span className="inline-flex items-center gap-1">
                            <MonitorPlay className="h-3 w-3" /> {t.interactives}
                          </span>
                        ) : null}
                        {t.questions ? (
                          <span className="inline-flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" /> {t.questions}
                          </span>
                        ) : null}
                        {t.files ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> {t.files}
                          </span>
                        ) : null}
                        <span className="ml-auto">{formatRelative(t.updatedAt)}</span>
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-sm font-semibold">Самопроверка</h2>
            <p className="mt-1 text-sm text-muted">
              {questions.length
                ? `${questions.length} вопросов из тем. Они же приходят в общее повторение.`
                : "Вопросов пока нет — добавь их на странице темы или попроси ИИ составить по конспекту."}
            </p>
            {questions.length ? (
              <Button className="mt-3 w-full" variant={training ? "secondary" : "primary"} onClick={() => setTraining((v) => !v)}>
                {training ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />} {training ? "Закрыть" : "Прогнать вопросы"}
              </Button>
            ) : null}
          </section>
        </aside>
      </div>

      {training ? (
        <div className="mt-6">
          <StudyMode questions={questions} color={track.color} />
        </div>
      ) : null}

      {interactives.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Интерактивы <span className="font-normal">{interactives.length}</span>
          </h2>
          <InteractiveCards items={interactives} />
        </section>
      ) : null}

      <Modal open={open === "topic"} onClose={() => setOpen(null)} title="Новая тема">
        <LectureForm subjectId={track.id} topic onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "edit"} onClose={() => setOpen(null)} title="Изменить направление">
        <TrackForm
          id={track.id}
          initial={{ name: track.name, emoji: track.emoji, color: track.color, description: track.description ?? "", linkedSubjectId: track.linkedSubjectId ?? "" }}
          subjects={subjects}
          onDone={() => setOpen(null)}
        />
      </Modal>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Удалить направление?"
        text={`«${track.name}» удалится вместе со всеми темами, конспектами и вопросами. Можно вместо этого убрать в архив.`}
        onConfirm={async () => {
          const r = await deleteTrack(track.id);
          if (!r.ok) return toast.push(r.error, "err");
          toast.push("Направление удалено");
          router.push("/learn");
        }}
      />
    </div>
  );
}

function MenuItem({ onClick, icon: Icon, danger, children }: { onClick: () => void; icon: typeof Pencil; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-subtle", danger && "text-danger hover:bg-danger/10")}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}
