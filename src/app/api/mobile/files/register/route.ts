import { z } from "zod";
import { loadSerializedMobileAttachment } from "@/lib/mobile-attachment";
import { MobileBlobUploadError, registerMobileBlobAttachment } from "@/lib/mobile-blob";
import { UploadParentNotFound } from "@/lib/upload-parent";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

const registerSchema = z.object({
  uploadReceipt: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError("Отсутствует uploadReceipt", 400);
  }

  try {
    const row = await registerMobileBlobAttachment(user.id, parsed.data.uploadReceipt);
    const attachment = (await loadSerializedMobileAttachment(row.id)) ?? {
      id: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      subjectId: row.subjectId,
      taskId: row.taskId,
      noteId: row.noteId,
      lectureId: row.lectureId,
      questionId: row.questionId,
      createdAt: row.createdAt.toISOString(),
      folder: "loose",
      folderName: "Не прикреплено",
      folderColor: null,
      folderSelfStudy: false,
      whereLabel: "Не прикреплено",
    };
    return mobileJson({ attachment }, 201);
  } catch (error) {
    if (error instanceof UploadParentNotFound) {
      return mobileError("Родительский объект не найден", 404);
    }
    if (error instanceof MobileBlobUploadError) {
      return mobileError(error.message, 400);
    }
    return mobileError("Не удалось зарегистрировать файл", 500);
  }
}
