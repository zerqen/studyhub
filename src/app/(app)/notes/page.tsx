import Link from "next/link";
import { Pin, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cn, formatDate } from "@/lib/utils";
import { NoteEditor } from "@/components/notes/note-editor";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Заметки" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ open?: string; taskId?: string; questionId?: string }> }) {
  const user = await requireUser();
  const { open, taskId, questionId } = await searchParams;
  const [notes, subjects] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      include: { tags: { include: { tag: true } }, subject: { select: { name: true } } },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const selected = open ? notes.find((note) => note.id === open) : undefined;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заметки</h1>
          <p className="mt-1 text-sm text-muted">{notes.length ? `${notes.length} заметок` : "Конспекты, формулы, шпаргалки"}</p>
        </div>
        {selected ? (
          <Link href="/notes" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> Новая
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav className={cn("space-y-1", selected && "max-lg:hidden")}>
          <Link
            href="/notes"
            className={cn(
              "flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm transition-colors",
              !selected ? "border-accent/50 bg-accent/5 text-accent" : "border-line text-muted hover:text-fg",
            )}
          >
            <Plus className="h-4 w-4" /> Новая заметка
          </Link>
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes?open=${note.id}`}
              className={cn("relative block overflow-hidden rounded-xl px-3 py-2.5 pl-4 transition-colors", note.id === open ? "bg-surface shadow-card ring-1 ring-line" : "hover:bg-subtle/60")}
            >
              <span className="absolute inset-y-2 left-1.5 w-1 rounded-full" style={{ background: note.color }} />
              <div className="flex items-center gap-1.5">
                {note.pinned ? <Pin className="h-3 w-3 shrink-0 text-muted" /> : null}
                <span className="truncate text-sm font-medium">{note.title}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {formatDate(note.updatedAt, "d MMM")}
                {note.subject ? ` · ${note.subject.name}` : ""}
                {note.content ? ` · ${note.content.slice(0, 60)}` : ""}
              </div>
            </Link>
          ))}
        </nav>

        <section className="min-w-0">
          {selected ? (
            <Link href="/notes" className="mb-3 inline-flex text-sm text-muted hover:text-fg lg:hidden">
              ← Все заметки
            </Link>
          ) : null}
          <NoteEditor
            key={selected?.id ?? "new"}
            subjects={subjects}
            initialTaskId={taskId}
            initialQuestionId={questionId}
            note={selected ? { ...selected, tags: selected.tags } : undefined}
          />
        </section>
      </div>
    </div>
  );
}
