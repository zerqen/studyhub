import { describe, expect, it } from "vitest";
import { ratio, subjectProgress, subtaskProgress } from "../progress";

describe("progress", () => {
  it("ratio без деления на ноль", () => {
    expect(ratio(0, 0)).toBe(0);
    expect(ratio(1, 3)).toBe(33);
  });

  it("subjectProgress — только выученные вопросы, задачи не влияют", () => {
    expect(subjectProgress({ questions: [{ status: "LEARNED" }, { status: "REVIEW" }], tasks: [{ status: "DONE" }] })).toBe(50);
    expect(subjectProgress({ questions: [], tasks: [{ status: "DONE" }] })).toBe(0);
  });

  it("subtaskProgress учитывает вложенность", () => {
    const nodes = [
      { id: "a", parentId: null, status: "DONE" },
      { id: "b", parentId: null, status: "PLANNED" },
      { id: "b1", parentId: "b", status: "DONE" },
      { id: "b2", parentId: "b", status: "PLANNED" },
    ];
    expect(subtaskProgress(nodes)).toBe(75);
  });
});
