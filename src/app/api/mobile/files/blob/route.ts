import { blobUploadInput, McpBlobUploadError, prepareBlobAttachment } from "@/lib/mcp-blob";
import { UploadParentNotFound } from "@/lib/upload-parent";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const key = process.env.BLOB_READ_WRITE_TOKEN;
  if (!key) return mobileError("Прямая загрузка в Blob недоступна на сервере", 501);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = blobUploadInput.safeParse(body);
  if (!parsed.success) {
    return mobileError("Некорректные параметры файла", 400);
  }

  try {
    const grant = await prepareBlobAttachment(user.id, parsed.data, key);
    return mobileJson(grant);
  } catch (error) {
    if (error instanceof UploadParentNotFound) {
      return mobileError("Родительский объект не найден", 404);
    }
    if (error instanceof McpBlobUploadError) {
      return mobileError(error.message, 400);
    }
    return mobileError("Ошибка подготовки загрузки в Blob", 502);
  }
}
