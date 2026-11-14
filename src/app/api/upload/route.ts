import { NextResponse } from "next/server";
import { activeUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/files";
import { assertParentOwned, parentFrom, UploadParentNotFound } from "@/lib/upload-parent";
import { saveAttachment } from "@/lib/attachments";
import { mcpUnauthorized, mcpUserId } from "@/lib/mcp-auth";
import { attachmentLink, targetParent, targetSchema } from "@/lib/mcp-target";
import { DIRECT_UPLOAD_THRESHOLD } from "@/lib/constants";

export async function POST(req: Request) {
  if (req.headers.has("authorization")) return uploadFromMcp(req);

  const userId = await activeUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Нужно войти" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Файл не передан" }, { status: 400 });
  }
  try {
    if (form.get("avatar") === "1") {
      const saved = await saveUpload(file);
      const row = await prisma.attachment.create({ data: { ...saved, userId: userId } });
      await prisma.user.update({ where: { id: userId }, data: { avatarPath: row.id } });
      return NextResponse.json({ ok: true, id: row.id, avatar: true });
    }
    const parent = parentFrom((key) => form.get(key));
    await assertParentOwned(userId, parent);
    const row = await saveAttachment(userId, parent, file);
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

async function uploadFromMcp(req: Request) {
  const userId = await mcpUserId(req);
  if (!userId) return mcpUnauthorized();

  try {
    const form = await req.formData();
    const file = form.get("file");
    const target = targetSchema.safeParse({ parentType: form.get("parentType"), parentId: form.get("parentId") });
    if (!target.success || !(file instanceof File) || file.size === 0 || form.has("avatar")) {
      return Response.json({ error: "An attachment target and a non-empty file are required" }, { status: 400 });
    }
    const parent = targetParent(target.data);
    await assertParentOwned(userId, parent);
    if ((process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) && file.size > DIRECT_UPLOAD_THRESHOLD) {
      return Response.json({ error: "Use direct Blob upload for this file" }, { status: 413 });
    }
    const { id, originalName, mimeType, size, createdAt } = await saveAttachment(userId, parent, file);
    return Response.json({ id, originalName, mimeType, size, createdAt, url: attachmentLink(req.url, id) }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof UploadParentNotFound ? "Attachment target not found" : "Upload failed" }, {
      status: error instanceof UploadParentNotFound ? 404 : 400,
    });
  }
}
