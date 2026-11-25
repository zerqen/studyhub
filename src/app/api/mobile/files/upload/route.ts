import { saveAttachment } from "@/lib/attachments";
import { DIRECT_UPLOAD_THRESHOLD } from "@/lib/constants";
import { assertParentOwned, parentFrom, UploadParentNotFound } from "@/lib/upload-parent";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return mobileError("Файл не передан", 400);
    }
    const parent = parentFrom((k) => form.get(k));
    await assertParentOwned(user.id, parent);

    if ((process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) && file.size > DIRECT_UPLOAD_THRESHOLD) {
      return mobileError("Файл больше 4 МБ — используйте прямую загрузку через Blob", 413);
    }

    const row = await saveAttachment(user.id, parent, file);
    return mobileJson(
      {
        attachment: {
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
        },
      },
      201,
    );
  } catch (e) {
    if (e instanceof UploadParentNotFound) {
      return mobileError("Родительский объект не найден", 404);
    }
    return mobileError(e instanceof Error ? e.message : "Ошибка загрузки файла", 400);
  }
}
