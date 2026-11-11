import { describe, expect, it } from "vitest";
import { buildDueGroups, dueLabel, isUrgent, rangeLabel } from "../task-groups";
import type { WeekTask } from "../task-week";

// Вторник, 10 ноября 2026
const today = new Date(2026, 10, 10, 18, 0);
const iso = (k: string) => `${k}T00:00:00.000Z`;
const t = (id: string, due: string | null, over: Partial<WeekTask> = {}): WeekTask => ({ id, status: "PLANNED", dueDate: due ? iso(due) : null, dueTime: null, subtasks: [], ...over });

describe("buildDueGroups", () => {
  it("раскладывает по неделям", () => {
    const groups = buildDueGroups([t("old", "2026-11-05"), t("thu", "2026-11-12"), t("sun", "2026-11-15"), t("mon", "2026-11-16"), t("far", "2026-12-07"), t("none", null)], today, false);
    expect(groups.map((g) => [g.id, g.entries.map((e) => e.task.id)])).toEqual([
      ["overdue", ["old"]],
      ["week", ["thu", "sun"]],
      ["next", ["mon"]],
      ["later", ["far"]],
      ["none", ["none"]],
    ]);
    expect(groups[1].range).toBe("10–15 нояб");
    expect(groups[2].range).toBe("16–22 нояб");
    expect(groups[3].range).toBe("с 23 нояб");
  });

  it("сделанные — только по флажку и последними, свежие сверху", () => {
    const tasks = [t("a", "2026-11-01", { status: "DONE" }), t("b", "2026-11-08", { status: "DONE" }), t("c", "2026-11-09", { status: "CANCELLED" })];
    expect(buildDueGroups(tasks, today, false)).toEqual([]);
    const g = buildDueGroups(tasks, today, true);
    expect(g.map((x) => x.id)).toEqual(["done"]);
    expect(g[0].entries.map((e) => e.task.id)).toEqual(["b", "a"]);
  });

  it("этап с ранней датой попадает в свою неделю, поздний — нет", () => {
    const lab = t("lab", "2026-11-23", {
      subtasks: [
        { id: "s1", title: "Теория", status: "PLANNED", dueDate: iso("2026-11-12") },
        { id: "s2", title: "Отчёт", status: "PLANNED", dueDate: iso("2026-11-24") },
        { id: "s3", title: "Готово", status: "DONE", dueDate: iso("2026-11-11") },
      ],
    });
    const groups = buildDueGroups([lab], today, false);
    expect(groups.map((g) => [g.id, g.entries.map((e) => (e.type === "step" ? e.step.id : e.task.id))])).toEqual([
      ["week", ["s1"]],
      ["later", ["lab"]],
    ]);
  });

  it("в воскресенье эта неделя — только сегодня", () => {
    const sun = new Date(2026, 10, 15, 12);
    const g = buildDueGroups([t("a", "2026-11-15"), t("b", "2026-11-16")], sun, false);
    expect(g.map((x) => [x.id, x.range])).toEqual([
      ["week", "15 нояб"],
      ["next", "16–22 нояб"],
    ]);
  });
});

describe("подписи", () => {
  it("срок", () => {
    expect(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16", "2026-11-17", "2026-11-03", null].map((k) => dueLabel(k, "2026-11-10"))).toEqual(["сегодня", "завтра", "чт 12", "пн 16", "17 нояб", "3 нояб", "—"]);
  });

  it("срочность", () => {
    expect(isUrgent("2026-11-11", "2026-11-10")).toBe(true);
    expect(isUrgent("2026-11-01", "2026-11-10")).toBe(true);
    expect(isUrgent("2026-11-12", "2026-11-10")).toBe(false);
    expect(isUrgent(null, "2026-11-10")).toBe(false);
  });

  it("диапазоны через месяц", () => {
    expect(rangeLabel("2026-11-30", "2026-12-06")).toBe("30 нояб – 6 дек");
  });
});
