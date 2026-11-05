import { describe, expect, it } from "vitest";
import { gapIndex, gradeFromRecall, hasMarkedParts, hiddenParts, levelFor, maskAnswer, onlyBoldAdded, parseKeyParts, partLabel } from "../definitions";

const limit = "Число $A$ — **предел**, если **для любого $\\varepsilon>0$** существует $\\delta$:\n$$|f(x)-A|<\\varepsilon$$";

describe("parseKeyParts", () => {
  it("находит жирное и формулы отдельной строкой", () => {
    const parts = parseKeyParts(limit);
    expect(parts.map((p) => p.kind)).toEqual(["bold", "bold", "formula"]);
    expect(parts[1].source).toBe("**для любого $\\varepsilon>0$**");
  });

  it("не считает выделением звёздочки в формулах и коде", () => {
    expect(parseKeyParts("$a**b**c$ и `x**y**z`")).toEqual([]);
    expect(parseKeyParts("```\n**код**\n```")).toEqual([]);
  });

  it("не падает на пустом ответе и незакрытом выделении", () => {
    expect(parseKeyParts(null)).toEqual([]);
    expect(parseKeyParts("**незакрытое")).toEqual([]);
  });

  it("отличает разметку от одних формул", () => {
    expect(hasMarkedParts("$$x$$")).toBe(false);
    expect(hasMarkedParts("**x** и $$y$$")).toBe(true);
  });
});

describe("maskAnswer", () => {
  it("прячет только выбранные части, остальное не трогает", () => {
    const masked = maskAnswer(limit, new Set([0, 2]));
    expect(masked).toContain("[…](#gap-0)");
    expect(masked).toContain("[…](#gap-2)");
    expect(masked).toContain("**для любого");
    expect(masked).not.toContain("**предел**");
    expect(masked).not.toContain("$$");
  });

  it("без скрытых частей возвращает ответ как есть", () => {
    expect(maskAnswer(limit, new Set())).toBe(limit);
  });

  it("gapIndex читает только заглушки", () => {
    expect(gapIndex("#gap-12")).toBe(12);
    expect(gapIndex("https://example.com/#gap-1")).toBeNull();
    expect(gapIndex(undefined)).toBeNull();
  });
});

describe("partLabel", () => {
  it("снимает звёздочки и сворачивает формулу в строку", () => {
    expect(partLabel({ kind: "bold", source: "**предел**" })).toBe("предел");
    expect(partLabel({ kind: "formula", source: "$$\na\n+b\n$$" })).toBe("$a +b$");
  });
});

describe("уровни", () => {
  it("первый уровень прячет через одну, offset меняет какие", () => {
    expect(hiddenParts(4, 1, 0)).toEqual([0, 2]);
    expect(hiddenParts(4, 1, 1)).toEqual([1, 3]);
    expect(hiddenParts(1, 1, 1)).toEqual([0]);
  });

  it("второй и третий прячут всё", () => {
    expect(hiddenParts(3, 2)).toEqual([0, 1, 2]);
    expect(hiddenParts(3, 3)).toEqual([0, 1, 2]);
  });

  it("уровень растёт с повторами", () => {
    expect([0, 1, 2, 9].map(levelFor)).toEqual([1, 2, 3, 3]);
  });
});

describe("gradeFromRecall", () => {
  it("«Легко» только за полный ответ по памяти", () => {
    expect(gradeFromRecall(4, 4, 3)).toBe(3);
    expect(gradeFromRecall(4, 4, 2)).toBe(2);
    expect(gradeFromRecall(4, 4, 1)).toBe(2);
  });

  it("чем меньше вспомнил, тем ниже оценка", () => {
    expect(gradeFromRecall(3, 4, 3)).toBe(2);
    expect(gradeFromRecall(2, 4, 3)).toBe(1);
    expect(gradeFromRecall(1, 4, 3)).toBe(0);
    expect(gradeFromRecall(1, 2, 1)).toBe(1);
    expect(gradeFromRecall(0, 2, 1)).toBe(0);
  });

  it("без частей — ноль, а не деление на ноль", () => {
    expect(gradeFromRecall(0, 0, 3)).toBe(0);
  });
});

describe("onlyBoldAdded", () => {
  it("пропускает ответ, где только расставлены звёздочки", () => {
    expect(onlyBoldAdded("Предел функции $f$", "**Предел** функции $f$")).toBe(true);
    expect(onlyBoldAdded("Предел $f$", "**Предел $f$**")).toBe(true);
  });

  it("ловит правку текста", () => {
    expect(onlyBoldAdded("Предел функции", "**Предел** последовательности")).toBe(false);
  });

  it("ловит звёздочки внутри формулы", () => {
    expect(onlyBoldAdded("$x y$", "$**x** y$")).toBe(false);
  });
});
