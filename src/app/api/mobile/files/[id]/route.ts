import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openStored, removeUpload } from "@/lib/files";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const file = await prisma.attachment.findFirst({ where: { id, userId: user.id } });
  if (!file) return mobileError("Файл не найден", 404);

  const stored = await openStored(file.storagePath);
  if (!stored) return mobileError("Файл не найден в хранилище", 404);

  return new NextResponse(stored.body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      ...(stored.size ? { "Content-Length": String(stored.size) } : {}),
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);

  const { id } = await ctx.params;
  const file = await prisma.attachment.findFirst({
    where: { id, userId: user.id },
    select: { id: true, storagePath: true },
  });
  if (!file) return mobileError("Файл не найден", 404);

  await prisma.attachment.delete({ where: { id: file.id } });
  await removeUpload(file.storagePath);
  return mobileJson({ ok: true });
}
