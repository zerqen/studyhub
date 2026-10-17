import { describe, expect, it } from "vitest";
import { dueText, isDate, isTime, matchByName, msk, shortDay, timeContext } from "../assistant-utils";

const subjects = [
  { name: "Математический анализ" },
  { name: "Линейная алгебра и аналитическая геометрия" },
  { name: "Физика" },
  { name: "Физическая культура и спорт" },
  { name: "История России" },
  { name: "Иностранный язык" },
];

describe("сопоставление предметов", () => {
  it("находит по точному названию, сокращению и части", () => {
    expect(matchByName(subjects, "физика")).toEqual({ name: "Физика" });
    expect(matchByName(subjects, "матан")).toEqual({ name: "Математический анализ" });
    expect(matchByName(subjects, "линал")).toEqual({ name: "Линейная алгебра и аналитическая геометрия" });
    expect(matchByName(subjects, "мат анализ")).toEqual({ name: "Математический анализ" });
    expect(matchByName(subjects, "историю")).toEqual({ name: "История России" });
    expect(matchByName(subjects, "английский")).toEqual({ name: "Иностранный язык" });
    expect(matchByName(subjects, "физра")).toEqual({ name: "Физическая культура и спорт" });
  });

  it("неоднозначное и несуществующее", () => {
    expect(Array.isArray(matchByName(subjects, "физ"))).toBe(true);
    expect(matchByName(subjects, "химия")).toBeNull();
  });
});

describe("даты", () => {
  it("время по Москве", () => {
    expect(msk("2026-10-21", "10:45").toISOString()).toBe("2026-10-21T07:45:00.000Z");
    expect(msk("2026-10-21", "9:00").toISOString()).toBe("2026-10-21T06:00:00.000Z");
    expect(shortDay(msk("2026-10-21", "23:30"))).toBe("ср 21.10");
  });

  it("срок задачи не съезжает по часовому поясу", () => {
    expect(dueText("2026-10-22T00:00:00.000Z", "10:45")).toBe("чт 22.10 10:45");
    expect(dueText(null)).toBe("без срока");
  });

  it("проверки формата", () => {
    expect(isDate("2026-10-21")).toBe(true);
    expect(isDate("21.10.2026")).toBe(false);
    expect(isTime("9:05")).toBe(true);
    expect(isTime("25:00")).toBe(false);
  });

  it("контекст времени для модели", () => {
    const t = timeContext(new Date("2026-10-17T18:40:00Z"));
    expect(t.now).toContain("суббота, 2026-10-17, 21:40");
    expect(t.days).toContain("сб 2026-10-17 (сегодня)");
    expect(t.days).toContain("вс 2026-10-18 (завтра)");
    expect(t.days).toContain("ср 2026-10-21");
    // поздний вечер по UTC уже следующий день по Москве
    expect(timeContext(new Date("2026-10-17T22:30:00Z")).days).toContain("вс 2026-10-18 (сегодня)");
  });
});
