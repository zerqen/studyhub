import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blocks, tasks, tasksOfBlock } from "@/content/embedded";
import { buildDriver, buildReviewText, buildRunRequest, buildTestRequest, COMPILER_VERSION, countAsmOps, outcomeFromRun, runtimeTests, testCases } from "@/lib/embedded/driver";

const run = (over = {}) => ({ exit: 0, trap: null, stdout: "", stderr: "", truncated: false, reports: [{ ok: true, expr: "x", got: "1", expected: "1" }], ...over });

describe("контент Embedded", () => {
  it("блок A: не меньше 8 заданий, в каждом от 5 тестов", () => {
    const a = tasksOfBlock("A");
    expect(a.length).toBeGreaterThanOrEqual(8);
    for (const t of a) expect(t.tests.length, t.slug).toBeGreaterThanOrEqual(5);
  });

  it("у заданий есть всё нужное", () => {
    const slugs = new Set(tasks.map((t) => t.slug));
    expect(slugs.size).toBe(tasks.length);
    for (const t of tasks) {
      expect(t.wrongSolutions.length, t.slug).toBeGreaterThanOrEqual(1);
      expect(t.hints.length, t.slug).toBeGreaterThanOrEqual(1);
      expect(t.theory.some((b) => b.kind === "diagram"), t.slug).toBe(true);
      expect(blocks.some((b) => b.id === t.block), t.slug).toBe(true);
    }
  });

  it("блоки B и C пока только список тем", () => {
    expect(tasksOfBlock("B")).toEqual([]);
    expect(tasksOfBlock("C")).toEqual([]);
    expect(blocks.find((b) => b.id === "B")?.plannedTopics.length).toBeGreaterThan(0);
  });

  it("версия компилятора совпадает с package.json", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8"));
    expect(pkg.devDependencies["@yowasp/clang"]).toBe(COMPILER_VERSION);
  });
});

describe("сборка заданий", () => {
  const task = tasks[0];

  it("драйвер подключает решение и подменяет main", () => {
    const d = buildDriver(task);
    expect(d).toContain('#define main sh_user_main\n#include "solution.c"');
    expect(testCases(task)).toHaveLength(runtimeTests(task).length);
  });

  it("имитирует беззнаковый char и не включает предупреждения в тестах", () => {
    expect(buildRunRequest(task, "x").args).toContain("-funsigned-char");
    expect(buildRunRequest(task, "x").args).toContain("-Wall");
    expect(buildTestRequest(task, "x").args).toContain("-w");
  });
});

describe("результат теста", () => {
  it("успех", () => expect(outcomeFromRun("t", run(), false).status).toBe("passed"));

  it("показывает ожидаемое и полученное", () => {
    const o = outcomeFromRun("t", run({ reports: [{ ok: false, expr: "f(1)", got: "2", expected: "3" }] }), false);
    expect(o).toMatchObject({ status: "failed", expr: "f(1)", got: "2", expected: "3" });
  });

  it("падение и код завершения", () => {
    expect(outcomeFromRun("t", run({ reports: [], trap: "unreachable" }), true).status).toBe("crashed");
    expect(outcomeFromRun("t", run({ exit: 3 }), false).status).toBe("crashed");
  });

  it("тест без проверок не считается пройденным", () => {
    expect(outcomeFromRun("t", run({ reports: [] }), false).status).toBe("failed");
  });
});

describe("разбор ассемблера и текст для разбора", () => {
  const asm = "f:                  # @f\n\t.functype f (i32) -> (i32)\n\ti32.load\t0\n\ti32.load\t0\n\ti32.add\n\tend_function\ng:\n\ti32.load\t0\n\tend_function\n";

  it("считает инструкции только внутри функции", () => {
    expect(countAsmOps(asm, "f", "i32.load")).toBe(2);
    expect(countAsmOps(asm, "g", "i32.load")).toBe(1);
    expect(countAsmOps(asm, "h", "i32.load")).toBeNull();
  });

  it("текст для разбора содержит условие, код и упавший тест", () => {
    const text = buildReviewText(tasks[0], "int x;", [{ name: "A", status: "failed", expr: "f()", got: "1", expected: "2" }], "");
    expect(text).toContain(tasks[0].statement);
    expect(text).toContain("int x;");
    expect(text).toContain("получено 1, ожидалось 2");
  });
});
