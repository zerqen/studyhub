/** Разбор ответов модели. Чистые функции — проверяются тестами. */

/**
 * Модели часто пишут LaTeX в JSON без экранирования: "\frac" вместо "\\frac".
 * \f, \b, \n, \r, \t — валидные escape-последовательности JSON, и формула молча портится
 * (\frac превращается в «перевод страницы» + rac). Экранируем обратный слэш перед двумя и более
 * латинскими буквами — это команда LaTeX, а не перевод строки.
 */
export function repairJson(raw: string) {
  return raw.replace(/(?<!\\)((?:\\\\)*)\\(?=[a-zA-Z]{2,})/g, "$1\\\\");
}

/** Достаёт первый JSON-объект из ответа (модель могла обернуть его в ```json … ```) */
export function parseModelJson<T = unknown>(raw: string): T {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Модель ответила не в формате JSON");
  const body = text.slice(start, end + 1);
  try {
    return JSON.parse(repairJson(body)) as T;
  } catch {
    return JSON.parse(body) as T;
  }
}

export type GeneratedQuestion = { text: string; answer: string; kind: "THEORY" | "PROBLEM"; difficulty: "EASY" | "MEDIUM" | "HARD" };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Приводит вопросы модели к нашему формату и выкидывает повторы (в том числе уже существующих вопросов) */
export function normalizeQuestions(data: unknown, existing: string[] = []): GeneratedQuestion[] {
  const list = Array.isArray(data) ? data : Array.isArray((data as { questions?: unknown })?.questions) ? (data as { questions: unknown[] }).questions : [];
  const seen = new Set(existing.map(norm));
  const out: GeneratedQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const text = String(q.text ?? q.question ?? "").trim().slice(0, 4000);
    const answer = String(q.answer ?? "").trim().slice(0, 8000);
    if (text.length < 5) continue;
    const key = norm(text);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = String(q.kind ?? "").toUpperCase() === "PROBLEM" ? "PROBLEM" : "THEORY";
    const d = String(q.difficulty ?? "").toUpperCase();
    const difficulty = d === "EASY" || d === "HARD" ? d : "MEDIUM";
    out.push({ text, answer, kind, difficulty });
  }
  return out;
}

export type AnswerFeedback = { grade: 0 | 1 | 2 | 3; verdict: string; good: string[]; missing: string[]; mistakes: string[]; tip: string };

const strings = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : []);

export function normalizeFeedback(data: unknown): AnswerFeedback {
  const d = (data ?? {}) as Record<string, unknown>;
  const g = Math.round(Number(d.grade));
  return {
    grade: (Number.isFinite(g) ? Math.max(0, Math.min(3, g)) : 1) as AnswerFeedback["grade"],
    verdict: String(d.verdict ?? "").trim().slice(0, 400),
    good: strings(d.good),
    missing: strings(d.missing),
    mistakes: strings(d.mistakes),
    tip: String(d.tip ?? "").trim().slice(0, 600),
  };
}
