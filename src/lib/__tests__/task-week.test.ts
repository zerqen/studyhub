import { describe, expect, it } from "vitest";
import { buildWeek, openCount, weekKeys, weekStart } from "../task-week";

const t = (id: string, dueDate: string | null, status = "PLANNED", subtasks: { id: string; title: string; status: string; dueDate: string | null }[] = [], dueTime: string | null = null) => ({
  id,
  status,
  dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null,
  dueTime,
  subtasks: subtasks.map((s) => ({ ...s, dueDate: s.dueDate ? `${s.dueDate}T00:00:00.000Z` : null })),
});

const today = new Date(2026, 9, 21, 15, 0); // ср 21.10

describe("неделя задач", () => {
  it("понедельник недели и ключи дней", () => {
    expect(weekKeys(weekStart(today))).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(weekStart(new Date(2026, 9, 25)).getDate()).toBe(19); // воскресенье → тот же понедельник
  });

  it("задачи и этапы по дням, просроченное, без срока", () => {
    const lab = t("lab", "2026-11-05", "PLANNED", [
      { id: "s1", title: "Методичка", status: "DONE", dueDate: "2026-10-20" },
      { id: "s2", title: "Теория", status: "PLANNED", dueDate: "2026-10-22" },
      { id: "s3", title: "Таблицы", status: "PLANNED", dueDate: "2026-10-19" },
      { id: "s4", title: "Отчёт", status: "PLANNED", dueDate: null },
    ]);
    const tasks = [t("a", "2026-10-23", "PLANNED", [], "10:45"), t("b", "2026-10-23"), t("old", "2026-10-10"), t("none", null), t("done", "2026-10-22", "DONE"), lab];
    const w = buildWeek(tasks, weekStart(today), today, false);
    expect(w.days.get("2026-10-23")!.map((e) => e.task.id)).toEqual(["a", "b"]);
    expect(w.days.get("2026-10-22")!.map((e) => (e.type === "step" ? e.step.id : e.task.id))).toEqual(["s2"]);
    expect(w.days.get("2026-10-20")).toEqual([]); // сделанный этап скрыт
    // прошедшие дни этой недели остаются на своих местах (подсвечиваются), в «Просрочено» — только раньше недели
    expect(w.overdue.map((e) => (e.type === "step" ? e.step.id : e.task.id))).toEqual(["old"]);
    expect(w.days.get("2026-10-19")!.map((e) => (e.type === "step" ? e.step.id : e.task.id))).toEqual(["s3"]);
    expect(w.noDate.map((x) => x.id)).toEqual(["none"]);

    const withDone = buildWeek(tasks, weekStart(today), today, true);
    expect(withDone.days.get("2026-10-22")!.map((e) => (e.type === "step" ? e.step.id : e.task.id))).toEqual(["done", "s2"]);
    expect(openCount(withDone.days.get("2026-10-22")!)).toBe(1);
  });

  it("на другой неделе просроченное не показывается", () => {
    const next = new Date(2026, 9, 28);
    const w = buildWeek([t("old", "2026-10-10")], weekStart(next), today, false);
    expect(w.overdue).toEqual([]);
  });
});
