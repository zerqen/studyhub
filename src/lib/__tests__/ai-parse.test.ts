import { describe, expect, it } from "vitest";
import { normalizeFeedback, normalizeQuestions, parseModelJson, repairJson } from "../ai-parse";

describe("разбор JSON модели", () => {
  it("чинит неэкранированный LaTeX, не трогая правильный", () => {
    const bad = String.raw`{"a":"$\frac{1}{2}$ и $\nabla f$, $\theta$, $\beta$"}`;
    expect(parseModelJson<{ a: string }>(bad).a).toBe(String.raw`$\frac{1}{2}$ и $\nabla f$, $\theta$, $\beta$`);
    const good = String.raw`{"a":"$\\frac{1}{2}$\nПеренос"}`;
    expect(parseModelJson<{ a: string }>(good).a).toBe("$\\frac{1}{2}$\nПеренос");
    expect(repairJson(String.raw`"\\\frac"`)).toBe(String.raw`"\\\\frac"`);
  });

  it("достаёт JSON из ```json блока и мусора вокруг", () => {
    expect(parseModelJson<{ x: number }>("Вот ответ:\n```json\n{\"x\": 1}\n```")).toEqual({ x: 1 });
    expect(() => parseModelJson("нет json")).toThrow();
  });

  it("нормализует вопросы и убирает дубли", () => {
    const qs = normalizeQuestions(
      {
        questions: [
          { text: "Что такое предел?", answer: "…", kind: "theory", difficulty: "easy" },
          { text: "что такое ПРЕДЕЛ", answer: "дубль" },
          { question: "Найдите производную $x^2$", answer: "$2x$", kind: "PROBLEM", difficulty: "weird" },
          { text: "ок" },
          { text: "Сформулируйте теорему Ролля", answer: "" },
        ],
      },
      ["Сформулируйте теорему Ролля."],
    );
    expect(qs).toEqual([
      { text: "Что такое предел?", answer: "…", kind: "THEORY", difficulty: "EASY" },
      { text: "Найдите производную $x^2$", answer: "$2x$", kind: "PROBLEM", difficulty: "MEDIUM" },
    ]);
  });

  it("нормализует оценку ответа", () => {
    expect(normalizeFeedback({ grade: 7, verdict: "ok", good: ["a", ""], missing: "x" }).grade).toBe(3);
    const fb = normalizeFeedback({ grade: "1", good: ["a", ""], missing: "x" });
    expect(fb.grade).toBe(1);
    expect(fb.good).toEqual(["a"]);
    expect(fb.missing).toEqual([]);
  });
});
