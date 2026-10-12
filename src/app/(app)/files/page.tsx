import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FileGrid } from "@/components/files/file-grid";

export default async function FilesPage() {
  const user = await requireUser();
  const files = await prisma.attachment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold">Файлы</h1><p className="text-sm text-[var(--muted)]">Материалы, прикреплённые к предметам и задачам.</p></div>
      <FileGrid files={files} />
    </div>
  );
}
