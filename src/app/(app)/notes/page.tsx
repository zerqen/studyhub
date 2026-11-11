import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesShell, type NoteRow } from "@/components/notes/notes-shell";

export const metadata = { title: "Заметки" };

/** Первая непустая строка без markdown-разметки — для превью в списке */
function snippetOf(content: string) {
  const line = content.split("\n").find((l) => l.trim() && !/^\s*(\$\$|```)/.test(l)) ?? "";
  return line
    .replace(/^[\s#>*\-[\]x]+/i, "")
    .replace(/[*_`$]/g, "")
    .trim()
    .slice(0, 120);
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ open?: string; new?: string; taskId?: string; questionId?: string }> }) {
  const user = await requireUser();
  const { open, taskId, questionId, new: isNew } = await searchParams;
  const [notes, subjects] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      include: { tags: { include: { tag: true } }, subject: { select: { id: true, name: true } } },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const selected = open ? notes.find((note) => note.id === open) : undefined;

  const rows: NoteRow[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    snippet: snippetOf(n.content),
    haystack: `${n.title}\n${n.content.slice(0, 4000)}\n${n.subject?.name ?? ""}\n${n.tags.map((t) => t.tag.name).join(" ")}`.toLowerCase(),
    color: n.color,
    pinned: n.pinned,
    updatedAt: n.updatedAt.toISOString(),
    subject: n.subject,
  }));

  return (
    <NotesShell notes={rows} selectedId={selected?.id} creating={!selected && Boolean(isNew || taskId || questionId)}>
      <NoteEditor
        key={selected?.id ?? "new"}
        page
        subjects={subjects}
        initialTaskId={taskId}
        initialQuestionId={questionId}
        note={selected ? { ...selected, tags: selected.tags } : undefined}
      />
    </NotesShell>
  );
}
