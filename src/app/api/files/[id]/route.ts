import { NextResponse } from "next/server";
import { activeUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPrivateBlob, isRemoteStoragePath, openStored } from "@/lib/files";

/** Типы, которые браузер исполняет как документ со скриптами */
const ACTIVE_TYPES = /svg|html|xml|javascript/i;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await activeUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const file = await prisma.attachment.findFirst({ where: { id, userId } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;

  // Публичный Blob: просмотр — прямо с CDN (быстрее, и аудио/видео перематывается через Range-запросы)
  if (isRemoteStoragePath(file.storagePath) && !isPrivateBlob(file.storagePath) && !download) {
    return NextResponse.redirect(new URL(file.storagePath), { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
  }

  const stored = await openStored(file.storagePath);
  if (!stored) {
    const local = !isRemoteStoragePath(file.storagePath);
    // Файл загружали при запуске на компьютере — он лежит в папке uploads там, а не в облаке
    return new NextResponse(local ? "Файл был загружен на локальном сервере и в облачном хранилище его нет" : "Missing file", { status: 404 });
  }
  return new NextResponse(stored.body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      // SVG/HTML/XML могут содержать скрипты: открываем их в «песочнице» без доступа к сайту и входу
      ...(ACTIVE_TYPES.test(file.mimeType) ? { "Content-Security-Policy": "sandbox; default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'" } : {}),
      "Cache-Control": "private, max-age=3600",
      ...(stored.size ? { "Content-Length": String(stored.size) } : {}),
    },
  });
}
