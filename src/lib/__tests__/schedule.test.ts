import { describe, expect, it } from "vitest";
import { expandEvents, weekParity } from "../schedule";

const base = {
  id: "e1",
  startAt: "2026-09-01T06:45:00Z",
  endAt: "2026-09-01T08:15:00Z",
  recurrence: null as string | null,
  repeatUntil: null as string | null,
};

describe("expandEvents", () => {
  it("разовое событие попадает только в свой интервал", () => {
    expect(expandEvents([base], new Date("2026-09-01T00:00:00Z"), new Date("2026-09-02T00:00:00Z"))).toHaveLength(1);
    expect(expandEvents([base], new Date("2026-09-02T00:00:00Z"), new Date("2026-09-09T00:00:00Z"))).toHaveLength(0);
  });

  it("еженедельная пара повторяется каждую неделю и сохраняет длительность", () => {
    const out = expandEvents([{ ...base, recurrence: "WEEKLY" }], new Date("2026-10-01T00:00:00Z"), new Date("2026-11-01T00:00:00Z"));
    expect(out.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]);
    expect(out[0].end!.getTime() - out[0].start.getTime()).toBe(90 * 60 * 1000);
  });

  it("через неделю — шаг 14 дней, и «до даты» соблюдается", () => {
    const out = expandEvents(
      [{ ...base, recurrence: "BIWEEKLY", repeatUntil: "2026-09-30T00:00:00Z" }],
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-12-01T00:00:00Z"),
    );
    expect(out.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]);
  });
});

describe("weekParity", () => {
  it("неделя с 1 сентября — первая и нечётная", () => {
    expect(weekParity(new Date(2026, 8, 1))).toEqual({ week: 1, odd: true });
    expect(weekParity(new Date(2026, 8, 8)).odd).toBe(false);
  });
});
