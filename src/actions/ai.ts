"use server";

import { prisma } from "@/lib/prisma";
import { withUser, type ActionResult } from "@/lib/action";
import { aiEnabled, groqChat, groqVision, GroqLimitError } from "@/lib/groq";
import { checkPrompt, OCR_PROMPT, questionsPrompt } from "@/lib/ai-prompts";
import { normalizeFeedback, normalizeQuestions, parseModelJson, type AnswerFeedback, type GeneratedQuestion } from "@/lib/ai-parse";
import { toParagraphs, upsertBlock, type Segment } from "@/lib/transcript";
import { aiQuota } from "@/lib/ai-quota";
import { isPrivateBlob, isRemoteStoragePath, readStored } from "@/lib/files";

/** wait — лимит бесплатного тарифа, повторить через столько секунд */
export type AiResult<T> = ActionResult<{ wait?: number; value?: T }>;

async function ai<T>(fn: (userId: string) => Promise<T>): Promise<AiResult<T>> {
  return withUser(async (userId) => {
    if (!aiEnabled()) throw new Error("ИИ не настроен: добавь GROQ_API_KEY в переменные окружения Vercel");
    await aiQuota(userId);
    try {
      return { value: await fn(userId) };
    } catch (e) {
      if (e instanceof GroqLimitError) return { wait: e.retryAfter };
      throw e;
    }
  });
}

export async function getAiStatus(): Promise<{ enabled: boolean }> {
  return { enabled: aiEnabled() };
}

/** Вопросы по куску текста (конспект, расшифровка, заметка). Длинный текст клиент режет на части сам. */
export async function generateQuestions(input: { subjectId: string; lectureId?: string | null; text: string; count?: number }): Promise<AiResult<GeneratedQuestion[]>> {
  return ai(async (userId) => {
    const text = String(input.text ?? "").trim();
    if (text.length < 80) throw new Error("Слишком мало текста — нужен хотя бы абзац");
    if (text.length > 14_000) throw new Error("Слишком длинный кусок текста");
    const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, userId }, select: { name: true } });
    if (!subject) throw new Error("Предмет не найден");
    const lecture = input.lectureId
      ? await prisma.lecture.findFirst({ where: { id: input.lectureId, userId }, select: { title: true } })
      : null;
    const existing = await prisma.question.findMany({
      where: { subjectId: input.subjectId, userId, ...(input.lectureId ? { lectureId: input.lectureId } : {}) },
      select: { text: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const count = Math.max(2, Math.min(15, input.count ?? 8));
    const { text: raw } = await groqChat(
      [
        { role: "system", content: questionsPrompt({ subject: subject.name, lecture: lecture?.title, count, existing: existing.map((q) => q.text) }) },
        { role: "user", content: text },
      ],
      { json: true, maxTokens: 4096, temperature: 0.3 },
    );
    return normalizeQuestions(parseModelJson(raw), existing.map((q) => q.text));
  });
}

/** Проверка ответа своими словами по эталону вопроса */
export async function checkAnswer(questionId: string, answer: string): Promise<AiResult<AnswerFeedback>> {
  return ai(async (userId) => {
    const value = String(answer ?? "").trim();
    if (value.length < 3) throw new Error("Напиши ответ хотя бы парой слов");
    const q = await prisma.question.findFirst({
      where: { id: questionId, userId },
      select: { text: true, answer: true, explanation: true, subject: { select: { name: true } } },
    });
    if (!q) throw new Error("Вопрос не найден");
    const reference = [q.answer, q.explanation].filter(Boolean).join("\n\n") || null;
    const { text: raw } = await groqChat(
      [{ role: "user", content: checkPrompt({ subject: q.subject.name, question: q.text, reference, answer: value.slice(0, 6000) }) }],
      { json: true, maxTokens: 1200, temperature: 0.1 },
    );
    return normalizeFeedback(parseModelJson(raw));
  });
}

/** Распознаёт фото страницы тетради в Markdown с формулами */
export async function recognizePhoto(attachmentId: string): Promise<AiResult<string>> {
  return ai(async (userId) => {
    const file = await prisma.attachment.findFirst({ where: { id: attachmentId, userId }, select: { storagePath: true, mimeType: true, size: true } });
    if (!file) throw new Error("Фото не найдено");
    if (!file.mimeType.startsWith("image/")) throw new Error("Это не фото");
    let url = file.storagePath;
    // Публичный Blob Groq скачает сам; локальный файл или приватное хранилище — передаём картинку внутри запроса (лимит ~4 МБ)
    if (!isRemoteStoragePath(url) || isPrivateBlob(url)) {
      if (file.size > 3.5 * 1024 * 1024) throw new Error("Фото больше 3,5 МБ — его не получится передать модели. Сожми фото или сфотографируй с меньшим разрешением");
      const bytes = await readStored(file.storagePath);
      url = `data:${file.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
    }
    const { text } = await groqVision(OCR_PROMPT, url);
    return text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  });
}

/** Сохраняет расшифровку одного файла записи (заменяет прежнюю расшифровку этого файла) */
export async function saveTranscript(lectureId: string, fileId: string, name: string, segments: Segment[]): Promise<ActionResult<{ transcript: string }>> {
  return withUser(async (userId) => {
    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId }, select: { transcript: true } });
    if (!lecture) throw new Error("Лекция не найдена");
    const owns = await prisma.attachment.findFirst({ where: { id: fileId, userId, lectureId }, select: { id: true } });
    if (!owns) throw new Error("Запись не найдена");
    const lines = toParagraphs(Array.isArray(segments) ? segments.slice(0, 20_000) : []);
    if (!lines.length) throw new Error("В записи не нашлось речи");
    const transcript = upsertBlock(lecture.transcript, { fileId, name: String(name).slice(0, 120), lines }).slice(0, 400_000);
    await prisma.lecture.update({ where: { id: lectureId }, data: { transcript } });
    return { transcript };
  });
}

/** Ручная правка расшифровки */
export async function updateTranscript(lectureId: string, transcript: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const res = await prisma.lecture.updateMany({ where: { id: lectureId, userId }, data: { transcript: String(transcript).slice(0, 400_000) } });
    if (!res.count) throw new Error("Лекция не найдена");
  });
}
