import type { Prisma } from "@prisma/client";
import { removeUpload, saveUpload } from "./files";
import { prisma } from "./prisma";
import type { UploadParent } from "./upload-parent";

export const attachmentMetadata = {
  id: true, originalName: true, mimeType: true, size: true, createdAt: true,
} satisfies Prisma.AttachmentSelect;

export function createAttachment(userId: string, parent: UploadParent, file: Awaited<ReturnType<typeof saveUpload>>, id?: string) {
  return prisma.attachment.create({ data: { ...file, id, userId, ...parent } });
}

export async function saveAttachment(userId: string, parent: UploadParent, file: File) {
  const saved = await saveUpload(file);
  try {
    return await createAttachment(userId, parent, saved);
  } catch (error) {
    await removeUpload(saved.storagePath).catch(() => {});
    throw error;
  }
}
