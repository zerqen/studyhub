import { placeFile, type FileRow } from "./files-view";
import { prisma } from "./prisma";

const subj = { select: { id: true, name: true, color: true, selfStudy: true } } as const;

export const MOBILE_ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  subjectId: true,
  taskId: true,
  noteId: true,
  lectureId: true,
  questionId: true,
  examItemId: true,
  createdAt: true,
  subject: subj,
  task: { select: { id: true, title: true, subject: subj } },
  subtask: { select: { title: true, task: { select: { id: true, title: true, subject: subj } } } },
  question: { select: { id: true, text: true, subject: subj } },
  note: { select: { id: true, title: true, subject: subj } },
  lecture: { select: { id: true, number: true, title: true, subject: subj } },
  comment: {
    select: {
      task: { select: { id: true, title: true, subject: subj } },
      question: { select: { id: true, text: true, subject: subj } },
    },
  },
} as const;

export type MobileAttachmentRow = FileRow & {
  subjectId: string | null;
  taskId: string | null;
  noteId: string | null;
  lectureId: string | null;
  questionId: string | null;
};

export function serializeMobileAttachment(row: MobileAttachmentRow) {
  const placed = placeFile(row);
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    subjectId: row.subjectId,
    taskId: row.taskId,
    noteId: row.noteId,
    lectureId: row.lectureId,
    questionId: row.questionId,
    createdAt: new Date(row.createdAt).toISOString(),
    folder: placed.subject?.id ?? "loose",
    folderName: placed.subject?.name ?? "Не прикреплено",
    folderColor: placed.subject?.color ?? null,
    folderSelfStudy: placed.subject?.selfStudy ?? false,
    whereLabel: placed.where,
  };
}

export async function loadSerializedMobileAttachment(id: string) {
  const row = await prisma.attachment.findUnique({
    where: { id },
    select: MOBILE_ATTACHMENT_SELECT,
  });
  return row ? serializeMobileAttachment(row) : null;
}
