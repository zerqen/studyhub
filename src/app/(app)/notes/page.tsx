import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NoteEditor } from "@/components/notes/note-editor";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ open?: string; taskId?: string; questionId?: string }> }) {
  const user = await requireUser();
  const { open, taskId, questionId } = await searchParams;
  const [notes, subjects] = await Promise.all([
    prisma.note.findMany({ where: { userId: user.id }, include: { tags: { include: { tag: true } } }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const selected = open ? notes.find((note) => note.id === open) : undefined;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Заметки</h1>
        {notes.length === 0 ? <p className="rounded-2xl bg-[var(--bg-elev)] p-6 text-sm text-[var(--muted)]">Создайте первую заметку справа.</p> : notes.map((note) => (
          <a key={note.id} href={`/notes?open=${note.id}`} className="block rounded-2xl p-4 shadow-card" style={{ background: note.color }}>
            <div className="font-medium text-ink-950">{note.pinned ? "📌 " : ""}{note.title}</div>
            <p className="mt-1 line-clamp-2 text-sm text-ink-800/70">{note.content}</p>
          </a>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{selected ? "Редактирование" : "Новая заметка"}</h2>
        <NoteEditor
          subjects={subjects}
          initialTaskId={taskId}
          initialQuestionId={questionId}
          note={selected ? { ...selected, tags: selected.tags } : undefined}
        />
      </section>
    </div>
  );
}
