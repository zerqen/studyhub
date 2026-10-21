/**
 * Groq API (бесплатный тариф): Whisper для расшифровки и текстовые модели.
 * Ключ — GROQ_API_KEY. Модели можно переопределить: GROQ_TEXT_MODELS (через запятую), GROQ_VISION_MODEL, GROQ_WHISPER_MODEL.
 * Лимиты считаются отдельно для каждой модели, поэтому при «лимит исчерпан» пробуем следующую.
 */

const API = "https://api.groq.com/openai/v1";

const TEXT_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"];
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const WHISPER_MODEL = "whisper-large-v3";

/** Бесплатный тариф Whisper принимает файлы до 25 МБ — берём с запасом */
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
/** Форматы, которые Whisper принимает как есть */
export const WHISPER_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/flac", "video/mp4", "video/webm"];

export class GroqLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Лимит бесплатного тарифа Groq — подожди ${retryAfter} с`);
  }
}

export function aiEnabled() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

/** Понятная ошибка для 401/403: неверный ключ и блокировка по региону — разные вещи */
async function authError(res: Response) {
  const detail = await errorText(res);
  if (res.status === 401) {
    return new Error(`Groq не принял ключ (401: ${detail}). Ключ должен начинаться с gsk_ и быть вставлен целиком, без кавычек и пробелов. После изменения переменной в Vercel нужен Redeploy.`);
  }
  return new Error(
    `Groq отказал в доступе (403: ${detail}). Если сайт запущен на твоём компьютере (npm run dev) из России — Groq блокирует такие запросы; на Vercel (сервер в Стокгольме) это работает.`,
  );
}

function key() {
  // Частая ошибка — ключ вставлен с кавычками или пробелом в конце
  const k = process.env.GROQ_API_KEY?.trim().replace(/^["']|["']$/g, "").trim();
  if (!k) throw new Error("ИИ не настроен: добавь GROQ_API_KEY в переменные окружения");
  return k;
}

function retryAfter(res: Response) {
  const h = Number(res.headers.get("retry-after"));
  return Number.isFinite(h) && h > 0 ? Math.ceil(h) : 20;
}

async function errorText(res: Response) {
  try {
    const j = (await res.json()) as { error?: { message?: string; code?: string } };
    return j.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export type ChatMessage = { role: "system" | "user" | "assistant"; content: Content };

/** Чат с перебором моделей. json=true — просим строго JSON-объект. */
export async function groqChat(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number; models?: string[] } = {},
): Promise<{ text: string; model: string }> {
  const models = opts.models ?? (process.env.GROQ_TEXT_MODELS ? process.env.GROQ_TEXT_MODELS.split(",").map((m) => m.trim()).filter(Boolean) : TEXT_MODELS);
  let limited: GroqLimitError | null = null;
  let lastError = "Не удалось получить ответ модели";
  for (const model of models) {
    const res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_completion_tokens: opts.maxTokens ?? 2048,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = j.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return { text, model };
      lastError = "Модель вернула пустой ответ";
      continue;
    }
    if (res.status === 401 || res.status === 403) throw await authError(res);
    if (res.status === 429) {
      const wait = retryAfter(res);
      if (!limited || wait < limited.retryAfter) limited = new GroqLimitError(wait);
      continue;
    }
    // 400 (не прошёл JSON, модель снята), 404, 413 (запрос больше лимита модели), 5xx — пробуем следующую
    lastError = await errorText(res);
  }
  if (limited) throw limited;
  throw new Error(lastError);
}

export async function groqVision(prompt: string, imageUrl: string, maxTokens = 4000) {
  const model = process.env.GROQ_VISION_MODEL || VISION_MODEL;
  return groqChat(
    [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }],
    { models: [model], maxTokens, temperature: 0.1 },
  );
}

export type WhisperSegment = { start: number; end: number; text: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number };

/** Расшифровка аудио. prompt — подсказка: предмет, тема, конец предыдущего куска (улучшает термины и стыки) */
export async function groqTranscribe(audio: Blob, filename: string, prompt?: string): Promise<{ segments: WhisperSegment[]; duration: number }> {
  if (audio.size > WHISPER_MAX_BYTES) throw new Error("Файл больше 24 МБ — его нужно разбить на части");
  const form = new FormData();
  form.set("file", audio, filename);
  form.set("model", process.env.GROQ_WHISPER_MODEL || WHISPER_MODEL);
  form.set("language", "ru");
  form.set("response_format", "verbose_json");
  form.set("temperature", "0");
  // У Whisper подсказка — не больше ~224 токенов
  if (prompt) form.set("prompt", prompt.slice(-300));
  const res = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
    signal: AbortSignal.timeout(280_000),
  });
  if (res.status === 429) throw new GroqLimitError(retryAfter(res));
  if (res.status === 401 || res.status === 403) throw await authError(res);
  if (res.status === 413) throw new Error("Файл слишком большой для бесплатного тарифа — будет разбит на части");
  if (!res.ok) throw new Error(`Расшифровка не удалась: ${await errorText(res)}`);
  const j = (await res.json()) as { segments?: WhisperSegment[]; duration?: number; text?: string };
  const segments = j.segments?.length ? j.segments : j.text ? [{ start: 0, end: j.duration ?? 0, text: j.text }] : [];
  return {
    segments: segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
      no_speech_prob: s.no_speech_prob,
      avg_logprob: s.avg_logprob,
      compression_ratio: s.compression_ratio,
    })),
    duration: j.duration ?? segments[segments.length - 1]?.end ?? 0,
  };
}

// ── Ассистент: вызов инструментов (function calling) ──────────────────────────

const AGENT_MODELS = ["moonshotai/kimi-k2-instruct-0905", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"];

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

/** Один шаг агента: модель либо отвечает текстом, либо просит вызвать инструменты */
export async function groqAgentStep(messages: AgentMessage[], tools: ToolSpec[]): Promise<{ content: string; toolCalls: ToolCall[]; model: string }> {
  const models = process.env.GROQ_AGENT_MODELS ? process.env.GROQ_AGENT_MODELS.split(",").map((m) => m.trim()).filter(Boolean) : AGENT_MODELS;
  let limited: GroqLimitError | null = null;
  let lastError = "Ассистент не ответил";
  for (const model of models) {
    const res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
        max_completion_tokens: 4096,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
      const m = j.choices?.[0]?.message;
      const toolCalls = m?.tool_calls ?? [];
      const content = m?.content ?? "";
      if (toolCalls.length || content.trim()) return { content, toolCalls, model };
      lastError = "Ассистент вернул пустой ответ";
      continue;
    }
    if (res.status === 401 || res.status === 403) throw await authError(res);
    if (res.status === 429) {
      const wait = retryAfter(res);
      if (!limited || wait < limited.retryAfter) limited = new GroqLimitError(wait);
      continue;
    }
    // 400 tool_use_failed (модель сломала вызов), 413, 5xx — пробуем следующую модель
    lastError = await errorText(res);
  }
  if (limited) throw limited;
  throw new Error(lastError);
}
