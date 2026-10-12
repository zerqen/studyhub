"use server";

import { prisma } from "@/lib/prisma";
import { removeUpload } from "@/lib/files";
import { refreshAll, withUser, type ActionResult } from "@/lib/action";

export async function deleteAttachment(id: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const file = await prisma.attachment.findFirst({ where: { id, userId } });
    if (!file) throw new Error("Файл не найден");
    await prisma.attachment.delete({ where: { id } });
    await removeUpload(file.storagePath);
    refreshAll();
  });
}
