import { describe, expect, it } from "vitest";
import { buildFormulaSheet, extractFormulas } from "../formulas";

describe("extractFormulas", () => {
  it("берёт блоки и соотношения в строке, но не обозначения", () => {
    expect(extractFormulas("Пусть $x$ и $f(x)=x^2$:\n$$\\int_0^1 f\\,dx$$")).toEqual(["f(x)=x^2", "\\int_0^1 f\\,dx"]);
  });

  it("убирает повторы с разными пробелами", () => {
    expect(extractFormulas("$a = b$ и $a=b$")).toEqual(["a = b"]);
  });

  it("не считает формулой код и экранированный доллар", () => {
    expect(extractFormulas("`$a=b$` стоит \\$5 и \\$6")).toEqual([]);
    expect(extractFormulas(null)).toEqual([]);
  });
});

describe("buildFormulaSheet", () => {
  const lectures = [{ id: "l1", number: 2, title: "Пределы", summary: "$$a=b$$\n$$c=d$$" }];
  const q = (id: string, answer: string, lectureId: string | null, kind = "THEORY") => ({ id, text: `Вопрос ${id}`, answer, kind, lectureId });

  it("группирует по лекциям и не дублирует конспект", () => {
    const groups = buildFormulaSheet(lectures, [q("1", "$$a = b$$", "l1"), q("2", "$$e=f$$", null)]);
    expect(groups.map((g) => g.title)).toEqual(["Лекция 2. Пределы", "Без лекции"]);
    expect(groups[0].entries).toEqual([
      { title: "Вопрос 1", href: "/questions/1", formulas: ["a = b"] },
      { title: "Из конспекта", href: "/lectures/l1", formulas: ["c=d"] },
    ]);
  });

  it("пропускает задачи и пустые лекции", () => {
    expect(buildFormulaSheet([{ ...lectures[0], summary: "" }], [q("1", "$$a=b$$", "l1", "PROBLEM")])).toEqual([]);
  });
});
