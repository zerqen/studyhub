import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/files";
import { aiEnabled, groqTranscribe, GroqLimitError, WHISPER_MAX_BYTES, WHISPER_TYPES } from "@/lib/groq";
import { aiQuota } from "@/lib/ai-quota";

export const dynamic = "force-dynamic";
// Час записи Groq расшифровывает за десятки секунд, но скачивание файла тоже занимает время
export const maxDuration = 300;

/** Кусок, который браузер присылает сам, — WAV 16 кГц моно, меньше лимита Vercel на тело запроса (4,5 МБ) */
const MAX_CHUNK = 4.4 * 1024 * 1024;

/**
 * POST /api/ai/transcribe?attachmentId=… — расшифровать файл целиком (если он до 24 МБ и в понятном Whisper формате).
 * POST /api/ai/transcribe (тело — аудио) — расшифровать кусок, нарезанный в браузере.
 * Ответ: { ok, segments, duration } | { ok: false, wait } | { ok: false, error, split }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Нужно войти в аккаунт" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: "ИИ не настроен: добавь GROQ_API_KEY" }, { status: 400 });

  const url = new URL(req.url);
  const prompt = url.searchParams.get("prompt") ?? undefined;
  const attachmentId = url.searchParams.get("attachmentId");

  try {
    await aiQuota(userId);
    let audio: Blob;
    let name: string;
    if (attachmentId) {
      const file = await prisma.attachment.findFirst({ where: { id: attachmentId, userId }, select: { storagePath: true, mimeType: true, size: true, originalName: true } });
      if (!file) return NextResponse.json({ ok: false, error: "Запись не найдена" }, { status: 404 });
      if (file.size > WHISPER_MAX_BYTES || !WHISPER_TYPES.includes(file.mimeType)) {
        return NextResponse.json({ ok: false, split: true, error: "Файл нужно разбить на части" });
      }
      let bytes: ArrayBuffer;
      try {
        bytes = await readStored(file.storagePath);
      } catch {
        return NextResponse.json({ ok: false, error: "Не удалось скачать запись из хранилища" }, { status: 502 });
      }
      audio = new Blob([bytes], { type: file.mimeType });
      name = file.originalName.replace(/\.(m4a|x-m4a)$/i, ".m4a");
    } else {
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > MAX_CHUNK) return NextResponse.json({ ok: false, error: "Кусок записи слишком большой" }, { status: 413 });
      const bytes = await req.arrayBuffer();
      if (!bytes.byteLength) return NextResponse.json({ ok: false, error: "Пустой кусок записи" }, { status: 400 });
      if (bytes.byteLength > MAX_CHUNK) return NextResponse.json({ ok: false, error: "Кусок записи слишком большой" }, { status: 413 });
      const type = (req.headers.get("content-type") || "audio/wav").split(";")[0].trim();
      audio = new Blob([bytes], { type });
      // Whisper определяет формат по расширению: голосовые из браузера приходят в webm/mp4/ogg
      name = type.includes("webm") ? "voice.webm" : type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "voice.m4a" : type.includes("ogg") ? "voice.ogg" : "chunk.wav";
    }
    const result = await groqTranscribe(audio, name, prompt);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof GroqLimitError) return NextResponse.json({ ok: false, wait: e.retryAfter });
    const message = e instanceof Error ? e.message : "Расшифровка не удалась";
    return NextResponse.json({ ok: false, error: message, split: /разбит/.test(message) });
  }
}
