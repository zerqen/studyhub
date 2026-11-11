import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildFiles } from "@/lib/files-view";
import { FilesBrowser } from "@/components/files/files-browser";

export const metadata = { title: "Файлы" };

const subj = { select: { id: true, name: true, color: true, selfStudy: true } } as const;

export default async function FilesPage() {
  const user = await requireUser();
  const rows = await prisma.attachment.findMany({
    where: { userId: user.id, ...(user.avatarPath ? { NOT: { id: user.avatarPath } } : {}) },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      examItemId: true,
      subject: subj,
      task: { select: { id: true, title: true, subject: subj } },
      subtask: { select: { title: true, task: { select: { id: true, title: true, subject: subj } } } },
      question: { select: { id: true, text: true, subject: subj } },
      note: { select: { id: true, title: true, subject: subj } },
      lecture: { select: { id: true, number: true, title: true, subject: subj } },
      comment: { select: { task: { select: { id: true, title: true, subject: subj } }, question: { select: { id: true, text: true, subject: subj } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const { items, subjects, learn, loose } = buildFiles(rows);
  return <FilesBrowser items={items} subjects={subjects} learn={learn} loose={loose} />;
}
