import { describe, expect, it } from "vitest";
import { GRADES, whenLabel } from "../srs";

const fresh = { interval: 0, ease: 2.5, reps: 0, lapses: 0 };

describe("подписи оценок", () => {
  it("названия как в макете", () => {
    expect(GRADES.map((g) => g.label)).toEqual(["Не вспомнил", "С трудом", "Вспомнил", "Легко"]);
  });
  it("когда вернётся", () => {
    expect([0, 1, 2, 3].map((g) => whenLabel(fresh, g as 0 | 1 | 2 | 3))).toEqual(["снова через 10 мин", "через 1 день", "через 1 день", "через 3 дня"]);
    expect(whenLabel({ interval: 20, ease: 2.5, reps: 4, lapses: 0 }, 2)).toBe("через 2 мес.");
    expect(whenLabel({ interval: 5, ease: 2.5, reps: 2, lapses: 0 }, 1)).toBe("через 6 дней");
  });
});
