import { NextResponse } from "next/server";
import { activeUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MIME, MAX_DIRECT_FILE_SIZE, guessMime } from "@/lib/constants";
import { assertParentOwned, parentFrom } from "@/lib/upload-parent";

/** Регистрирует в базе файл, который браузер уже загрузил в Vercel Blob */
export async function POST(req: Request) {
  const userId = await activeUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Нужно войти" }, { status: 401 });
  try {
    const body = (await req.json()) as { url?: string; pathname?: string; name?: string; mimeType?: string; size?: number; parent?: Record<string, unknown> };
    const url = new URL(String(body.url ?? ""));
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) throw new Error("Неверный адрес файла");
    const mimeType = guessMime(String(body.name ?? ""), String(body.mimeType ?? ""));
    if (!ALLOWED_MIME.has(mimeType)) throw new Error("Этот тип файла не поддерживается");
    const size = Number(body.size ?? 0);
    if (!(size > 0 && size <= MAX_DIRECT_FILE_SIZE)) throw new Error("Слишком большой файл");
    const parent = parentFrom((k) => body.parent?.[k]);
    await assertParentOwned(userId, parent);
    const name = String(body.name ?? "file").slice(0, 180);
    const row = await prisma.attachment.create({
      data: {
        userId: userId,
        filename: String(body.pathname ?? name).split("/").pop()!.slice(0, 200),
        originalName: name,
        mimeType,
        size,
        storagePath: url.toString(),
        ...parent,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка" }, { status: 400 });
  }
}
