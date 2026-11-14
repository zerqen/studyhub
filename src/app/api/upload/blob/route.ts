import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { activeUserId } from "@/lib/session";
import { ALLOWED_MIME, MAX_DIRECT_FILE_SIZE } from "@/lib/constants";
import { assertParentOwned, parentFrom, UploadParentNotFound } from "@/lib/upload-parent";
import { blobAccess } from "@/lib/files";
import { mcpUnauthorized, mcpUserId } from "@/lib/mcp-auth";
import { blobUploadInput, McpBlobUploadError, prepareBlobAttachment } from "@/lib/mcp-blob";

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
  if (request.headers.has("authorization")) return prepareFromMcp(request);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "NO_BLOB" }, { status: 501 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const userId = await activeUserId();
        if (!userId) throw new Error("Нужно войти");
        const payload = clientPayload ? (JSON.parse(clientPayload) as Record<string, unknown>) : {};
        await assertParentOwned(userId, parentFrom((k) => payload[k]));
        return {
          allowedContentTypes: [...ALLOWED_MIME],
          maximumSizeInBytes: MAX_DIRECT_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: userId }),
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

async function prepareFromMcp(request: Request) {
  const userId = await mcpUserId(request);
  if (!userId) return mcpUnauthorized();
  const key = process.env.BLOB_READ_WRITE_TOKEN;
  if (!key) return Response.json({ error: "Direct Blob upload is unavailable" }, { status: 501 });

  try {
    const input = blobUploadInput.safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid file or attachment target" }, { status: 400 });
    const grant = await prepareBlobAttachment(userId, input.data, key);
    return Response.json(grant, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadParentNotFound) {
      return Response.json({ error: "Attachment target not found" }, { status: 404 });
    }
    if (error instanceof McpBlobUploadError || error instanceof SyntaxError) {
      return Response.json({ error: "Invalid upload request or unsupported file type" }, { status: 400 });
    }
    return Response.json({ error: "Direct Blob upload is unavailable" }, { status: 502 });
  }
}
