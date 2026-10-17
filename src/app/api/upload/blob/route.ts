import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authOptions } from "@/lib/auth";
import { ALLOWED_MIME, MAX_DIRECT_FILE_SIZE } from "@/lib/constants";
import { assertParentOwned, parentFrom } from "@/lib/upload-parent";
import { blobAccess } from "@/lib/files";

/** Включена ли прямая загрузка (есть ли токен Vercel Blob) */
export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ enabled: false });
  try {
    return NextResponse.json({ enabled: true, access: await blobAccess() });
  } catch (e) {
    return NextResponse.json({ enabled: false, error: e instanceof Error ? e.message : "Хранилище недоступно" });
  }
}

/**
 * Выдаёт браузеру одноразовый токен, чтобы он загрузил большой файл прямо в Vercel Blob.
 * Сам файл через сервер не проходит — поэтому нет лимита в 4,5 МБ.
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "NO_BLOB" }, { status: 501 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) throw new Error("Нужно войти");
        const payload = clientPayload ? (JSON.parse(clientPayload) as Record<string, unknown>) : {};
        await assertParentOwned(session.user.id, parentFrom((k) => payload[k]));
        return {
          allowedContentTypes: [...ALLOWED_MIME],
          maximumSizeInBytes: MAX_DIRECT_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      // Запись в базу делает /api/upload/register — так работает и без вебхуков
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки" }, { status: 400 });
  }
}
