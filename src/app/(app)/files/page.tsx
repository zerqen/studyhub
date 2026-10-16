import { FolderOpen } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FileGrid } from "@/components/files/file-grid";
import { PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty";

export const metadata = { title: "Файлы" };

export default async function FilesPage() {
  const user = await requireUser();
  const files = await prisma.attachment.findMany({
    where: { userId: user.id, ...(user.avatarPath ? { NOT: { id: user.avatarPath } } : {}) },
    select: { id: true, originalName: true, mimeType: true, size: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Файлы" description="Всё, что прикреплено к предметам, вопросам, задачам и заметкам" />
      {files.length ? (
        <FileGrid files={files} />
      ) : (
        <EmptyState icon={FolderOpen} title="Файлов пока нет" hint="Прикрепляй материалы на страницах предметов, вопросов и задач." />
      )}
    </div>
  );
}
