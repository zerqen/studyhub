import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/files";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Нужно войти" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Файл не передан" }, { status: 400 });
  }
  try {
    const parent = {
      subjectId: (form.get("subjectId") as string) || null,
      taskId: (form.get("taskId") as string) || null,
      subtaskId: (form.get("subtaskId") as string) || null,
      ticketId: (form.get("ticketId") as string) || null,
      questionId: (form.get("questionId") as string) || null,
      noteId: (form.get("noteId") as string) || null,
      commentId: (form.get("commentId") as string) || null,
    };
    const isAvatar = form.get("avatar") === "1";
    if (isAvatar) {
      const saved = await saveUpload(file);
      const row = await prisma.attachment.create({
        data: { ...saved, userId: session.user.id },
      });
      await prisma.user.update({
        where: { id: session.user.id },
        data: { avatarPath: row.id },
      });
      return NextResponse.json({ ok: true, id: row.id, avatar: true });
    }
    const owned = await Promise.all([
      parent.subjectId ? prisma.subject.findFirst({ where: { id: parent.subjectId, userId: session.user.id }, select: { id: true } }) : null,
      parent.taskId ? prisma.task.findFirst({ where: { id: parent.taskId, userId: session.user.id }, select: { id: true } }) : null,
      parent.subtaskId ? prisma.subtask.findFirst({ where: { id: parent.subtaskId, userId: session.user.id }, select: { id: true } }) : null,
      parent.ticketId ? prisma.ticket.findFirst({ where: { id: parent.ticketId, userId: session.user.id }, select: { id: true } }) : null,
      parent.questionId ? prisma.question.findFirst({ where: { id: parent.questionId, userId: session.user.id }, select: { id: true } }) : null,
      parent.noteId ? prisma.note.findFirst({ where: { id: parent.noteId, userId: session.user.id }, select: { id: true } }) : null,
      parent.commentId ? prisma.comment.findFirst({ where: { id: parent.commentId, userId: session.user.id }, select: { id: true } }) : null,
    ]);
    if (
      (parent.subjectId && !owned[0]) ||
      (parent.taskId && !owned[1]) ||
      (parent.subtaskId && !owned[2]) ||
      (parent.ticketId && !owned[3]) ||
      (parent.questionId && !owned[4]) ||
      (parent.noteId && !owned[5])
      || (parent.commentId && !owned[6])
    ) {
      return NextResponse.json({ ok: false, error: "Объект для файла не найден" }, { status: 404 });
    }
    const saved = await saveUpload(file);
    const row = await prisma.attachment.create({
      data: { ...saved, userId: session.user.id, ...parent },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
