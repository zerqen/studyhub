import { z } from "zod";
import { attachmentMetadata, saveAttachment } from "./attachments";
import { downloadChatFile, type ChatFile } from "./chatgpt-file";
import { removeUpload, saveUpload } from "./files";
import { attachmentLink, identifier, targetInput, targetParent, type AttachmentTarget } from "./mcp-target";
import { prisma } from "./prisma";
import { searchLabs, searchMaterials } from "./search-materials";
import { assertParentOwned, UploadParentNotFound } from "./upload-parent";
import { commentSchema } from "./validations";

export const searchInput = {
  query: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  labNumber: z.number().int().positive().max(9999).optional(),
};
export const searchSchema = z.object(searchInput);
export const listFilesInput = { ...targetInput, offset: z.number().int().min(0).max(100_000).default(0) };
export const commentTargetInput = {
  parentType: z.enum(["task", "question"]),
  parentId: identifier,
};
export const commentTargetSchema = z.object(commentTargetInput);
export const commentInput = {
  ...commentTargetInput,
  content: z.string().trim().min(1).max(2000),
};
type CommentTarget = z.infer<typeof commentTargetSchema>;

export function studyHubAgent(userId: string, origin: string) {
  const describeAttachment = ({ id, originalName, mimeType, size, createdAt }: {
    id: string; originalName: string; mimeType: string; size: number; createdAt: Date;
  }) => ({ id, originalName, mimeType, size, createdAt: createdAt.toISOString(), url: attachmentLink(origin, id) });

  return {
    describeAttachment,
    async search({ query, subject, labNumber }: z.infer<typeof searchSchema>) {
      if (labNumber === undefined && !query) return { hits: [] };
      const hits = labNumber === undefined
        ? await searchMaterials(userId, query!)
        : await searchLabs(userId, labNumber, subject);
      return { hits: hits.map(({ href, ...hit }) => ({
        ...hit, url: hit.type === "file" ? attachmentLink(origin, hit.id) : new URL(href, origin).href,
      })) };
    },
    async listAttachments(target: AttachmentTarget, offset: number) {
      const parent = targetParent(target);
      await assertParentOwned(userId, parent);
      const files = await prisma.attachment.findMany({
        where: { userId, ...parent },
        select: attachmentMetadata,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: offset,
        take: 101,
      });
      return { files: files.slice(0, 100).map(describeAttachment), nextOffset: files.length > 100 ? offset + 100 : null };
    },
    async openFile(id: string) {
      const file = await prisma.attachment.findFirst({ where: { id, userId } });
      if (!file) throw new UploadParentNotFound();
      await assertParentOwned(userId, file);
      return describeAttachment(file);
    },
    async attachFile(target: AttachmentTarget, file: ChatFile) {
      const parent = targetParent(target);
      await assertParentOwned(userId, parent);
      return describeAttachment(await saveAttachment(userId, parent, await downloadChatFile(file)));
    },
    async listComments(target: CommentTarget) {
      const parent = targetParent(target);
      await assertParentOwned(userId, parent);
      const comments = await prisma.comment.findMany({
        where: { userId, ...parent },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 30,
        select: { id: true, content: true, createdAt: true, attachments: { where: { userId }, select: attachmentMetadata } },
      });
      return { comments: comments.map(({ attachments, ...comment }) => ({
        ...comment, createdAt: comment.createdAt.toISOString(), attachments: attachments.map(describeAttachment),
      })) };
    },
    async addComment(target: CommentTarget, content: string, file?: ChatFile) {
      const parent = targetParent(target);
      await assertParentOwned(userId, parent);
      const comment = commentSchema.parse({ taskId: parent.taskId, questionId: parent.questionId, content });
      const saved = file ? await saveUpload(await downloadChatFile(file)) : undefined;
      try {
        const row = await prisma.comment.create({
          data: { ...comment, userId, attachments: saved ? { create: { ...saved, userId } } : undefined },
          select: { id: true, content: true, attachments: { select: attachmentMetadata } },
        });
        return {
          id: row.id, content: row.content,
          url: new URL(`/${target.parentType === "task" ? "tasks" : "questions"}/${target.parentId}`, origin).href,
          attachments: row.attachments.map(describeAttachment),
        };
      } catch (error) {
        if (saved) await removeUpload(saved.storagePath).catch(() => {});
        throw error;
      }
    },
  };
}
