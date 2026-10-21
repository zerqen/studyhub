import { NextResponse } from "next/server";
import { activeUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/files";
import { assertParentOwned, parentFrom } from "@/lib/upload-parent";

export async function POST(req: Request) {
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
    const saved = await saveUpload(file);
    const row = await prisma.attachment.create({ data: { ...saved, userId: userId, ...parent } });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
