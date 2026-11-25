import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/files";
import { aiEnabled, groqTranscribe, GroqLimitError, WHISPER_MAX_BYTES, WHISPER_TYPES } from "@/lib/groq";
import { aiQuota } from "@/lib/ai-quota";
import { toParagraphs, upsertBlock } from "@/lib/transcript";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  attachmentId: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireMobileUser(req);
  if (!user) return mobileError("Требуется авторизация", 401);
  if (!aiEnabled()) return mobileError("ИИ-расшифровка не настроена на сервере (GROQ_API_KEY)", 400);

  const { id: lectureId } = await ctx.params;
  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    select: { id: true, title: true, transcript: true },
  });
  if (!lecture) return mobileError("Лекция не найдена", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileError("Некорректный JSON", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return mobileError("Укажите attachmentId", 400);

  const file = await prisma.attachment.findFirst({
    where: { id: parsed.data.attachmentId, userId: user.id, lectureId },
    select: { id: true, storagePath: true, mimeType: true, size: true, originalName: true },
  });
  if (!file) return mobileError("Аудиозапись не найдена", 404);

  if (file.size > WHISPER_MAX_BYTES) {
    return mobileError("Файл больше 24 МБ — для серверной расшифровки сожми или обрежь аудио до 24 МБ", 400);
  }
  if (!WHISPER_TYPES.includes(file.mimeType)) {
    return mobileError(`Формат ${file.mimeType} не поддерживается Whisper (нужен mp3, m4a, wav, ogg, webm)`, 400);
  }

  try {
    await aiQuota(user.id);
    const bytes = await readStored(file.storagePath);
    const audio = new Blob([bytes], { type: file.mimeType });
    const name = file.originalName.replace(/\.(m4a|x-m4a)$/i, ".m4a");
    const result = await groqTranscribe(audio, name, lecture.title);
    const lines = toParagraphs(result.segments);
    const nextTranscript = upsertBlock(lecture.transcript, {
      fileId: file.id,
      name: file.originalName,
      lines,
    });
    await prisma.lecture.update({
      where: { id: lectureId },
      data: { transcript: nextTranscript },
    });
    return mobileJson({ transcript: nextTranscript });
  } catch (e) {
    if (e instanceof GroqLimitError) {
      return mobileError(`Лимит Groq — попробуйте через ${e.retryAfter} сек.`, 429);
    }
    return mobileError(e instanceof Error ? e.message : "Расшифровка не удалась", 500);
  }
}
