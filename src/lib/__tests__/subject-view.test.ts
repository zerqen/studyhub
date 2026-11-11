import { describe, expect, it } from "vitest";
import { extTone, matchQuestion, newPerDay, nextReviewLabel, paceText, plural, questionCat, questionSplit, semesterText, untilText } from "../subject-view";

describe("plural", () => {
  it("склоняет", () => {
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => plural(n, "задача", "задачи", "задач"))).toEqual(["задача", "задачи", "задач", "задач", "задача", "задачи", "задач", "задач"]);
  });
});

describe("questionSplit", () => {
  it("делит на выучено, в процессе и не начато", () => {
    const s = questionSplit([
      { status: "LEARNED", srsReps: 4 },
      { status: "IN_PROGRESS", srsReps: 1 },
      { status: "REVIEW", srsReps: 0 },
      { status: "UNLEARNED", srsReps: 0 },
      { status: "UNLEARNED", srsReps: 0 },
    ]);
    expect(s).toEqual({ learned: 1, started: 2, fresh: 2, total: 5 });
  });
});

describe("темп", () => {
  it("оставляет неделю на повторение", () => {
    expect(newPerDay(121, 76)).toBe(2);
    expect(newPerDay(70, 10)).toBe(24);
    expect(newPerDay(10, 3)).toBe(10);
  });

  it("не считает без экзамена или без новых", () => {
    expect(newPerDay(10, null)).toBeNull();
    expect(newPerDay(0, 30)).toBeNull();
    expect(newPerDay(10, -1)).toBeNull();
  });

  it("пишет подсказку", () => {
    expect(paceText({ fresh: 121, total: 121 }, 76)).toBe("≈ 2 новых в день — и успеваешь к экзамену");
    expect(paceText({ fresh: 7, total: 10 }, 40)).toBe("≈ 1 новый в день — и успеваешь к экзамену");
    expect(paceText({ fresh: 0, total: 10 }, 40)).toBe("все вопросы уже начаты — теперь повторение");
    expect(paceText({ fresh: 0, total: 0 }, 40)).toBeNull();
    expect(paceText({ fresh: 5, total: 5 }, null)).toBeNull();
  });
});

describe("подписи", () => {
  it("сроки", () => {
    expect([null, -2, 0, 1, 2, 76].map(untilText)).toEqual(["", "прошёл", "сегодня", "завтра", "через 2 дня", "через 76 дней"]);
  });

  it("семестр", () => {
    expect(semesterText(new Date("2026-11-10T12:00:00Z"))).toBe("осенний семестр");
    expect(semesterText(new Date("2027-01-20T12:00:00Z"))).toBe("осенний семестр");
    expect(semesterText(new Date("2027-03-01T12:00:00Z"))).toBe("весенний семестр");
  });

  it("цвет расширения", () => {
    expect(extTone("ЛР60.PDF")[0]).toBe("#B91C1C");
    expect(extTone("расчёт.xlsx")[0]).toBe("#15803D");
    expect(extTone("60.zip")[0]).toBe("#424655");
  });
});

describe("вкладка «Вопросы»", () => {
  it("категория совпадает с полосой в шапке", () => {
    const qs = [
      { status: "UNLEARNED", srsReps: 0 },
      { status: "UNLEARNED", srsReps: 2 },
      { status: "IN_PROGRESS", srsReps: 1 },
      { status: "REVIEW", srsReps: 0 },
      { status: "LEARNED", srsReps: 5 },
    ];
    expect(qs.map(questionCat)).toEqual(["new", "learn", "learn", "hard", "done"]);
    const s = questionSplit(qs);
    const cats = qs.map(questionCat);
    expect(s.started).toBe(cats.filter((c) => c === "learn" || c === "hard").length);
    expect(s.fresh).toBe(cats.filter((c) => c === "new").length);
  });

  it("когда повторить", () => {
    const now = new Date(2026, 10, 11, 15);
    expect([
      nextReviewLabel(null, 0, now),
      nextReviewLabel(new Date(2026, 10, 9), 0, now),
      nextReviewLabel(new Date(2026, 10, 10, 9), 3, now),
      nextReviewLabel(new Date(2026, 10, 11, 23), 3, now),
      nextReviewLabel(new Date(2026, 10, 12, 1), 3, now),
      nextReviewLabel(new Date(2026, 10, 18), 3, now),
      nextReviewLabel(new Date(2026, 11, 20), 3, now),
    ]).toEqual(["—", "—", "сегодня", "сегодня", "завтра", "через 7 дн.", "20 дек"]);
  });

  it("поиск по номеру и словам", () => {
    expect(matchQuestion("12", 121, "x")).toBe(true);
    expect(matchQuestion("12", 31, "x")).toBe(false);
    expect(matchQuestion("7", 31, "x", 7)).toBe(true);
    expect(matchQuestion("предел Коши", 1, "Определение предела функции по Коши")).toBe(true);
    expect(matchQuestion("ёмкость", 1, "Емкость конденсатора")).toBe(true);
    expect(matchQuestion("гейне", 1, "Определение по Коши")).toBe(false);
  });
});
