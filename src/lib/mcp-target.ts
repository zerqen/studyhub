import { z } from "zod";
import type { UploadParent } from "./upload-parent";

const parentTypes = {
  subject: "subjectId",
  task: "taskId",
  subtask: "subtaskId",
  ticket: "ticketId",
  question: "questionId",
  note: "noteId",
  lecture: "lectureId",
} as const;

export const identifier = z.string().min(1).max(128).regex(/^[a-z0-9_-]+$/i);
export const targetInput = {
  parentType: z.enum(["subject", "task", "subtask", "ticket", "question", "note", "lecture"]),
  parentId: identifier,
};
export const targetSchema = z.object(targetInput);
export type AttachmentTarget = z.infer<typeof targetSchema>;

export function targetParent({ parentType, parentId }: AttachmentTarget): UploadParent {
  return { [parentTypes[parentType]]: parentId };
}

export function attachmentLink(origin: string, id: string) {
  return new URL(`/api/files/${encodeURIComponent(id)}`, origin).href;
}
