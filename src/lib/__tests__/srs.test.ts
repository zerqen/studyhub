import { describe, expect, it } from "vitest";
import { dueDate, isDue, LEARNED_INTERVAL, previewLabel, schedule, statusFor, type SrsState } from "../srs";

const fresh: SrsState = { interval: 0, ease: 2.5, reps: 0, lapses: 0 };

describe("schedule (SM-2)", () => {
  it("первый «хорошо» — через день, второй — через 3 дня", () => {
    const a = schedule(fresh, 2);
    expect(a.interval).toBe(1);
    const b = schedule(a, 2);
    expect(b.interval).toBe(3);
  });

  it("интервалы растут при стабильных «хорошо»", () => {
    let s = fresh;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = schedule(s, 2);
      intervals.push(s.interval);
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
  });

  it("«забыл» сбрасывает прогресс и снижает лёгкость", () => {
    const learned = schedule(schedule(schedule(fresh, 2), 2), 2);
    const lapsed = schedule(learned, 0);
    expect(lapsed.interval).toBe(0);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeLessThan(learned.ease);
  });

  it("лёгкость не падает ниже 1.3 и не растёт выше 3", () => {
    let s = fresh;
    for (let i = 0; i < 30; i++) s = schedule(s, 0);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    let t = fresh;
    for (let i = 0; i < 30; i++) t = schedule(t, 3);
    expect(t.ease).toBeLessThanOrEqual(3);
    expect(t.interval).toBeLessThanOrEqual(365);
  });

  it("«легко» даёт интервал больше, чем «трудно»", () => {
    const base = schedule(schedule(fresh, 2), 2);
    expect(schedule(base, 3).interval).toBeGreaterThan(schedule(base, 1).interval);
  });
});

describe("статус и даты", () => {
  it("выучен — когда интервал дорос до недели", () => {
    expect(statusFor({ ...fresh, interval: LEARNED_INTERVAL }, 2)).toBe("LEARNED");
    expect(statusFor({ ...fresh, interval: 3 }, 2)).toBe("IN_PROGRESS");
    expect(statusFor({ ...fresh, interval: 0 }, 0)).toBe("REVIEW");
  });

  it("«забыл» — вернётся через 10 минут", () => {
    const now = new Date("2026-10-17T10:00:00Z");
    expect(dueDate({ ...fresh, interval: 0 }, now).getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("isDue: без даты — пора, будущая дата — нет", () => {
    const now = new Date("2026-10-17T10:00:00Z");
    expect(isDue(null, now)).toBe(true);
    expect(isDue("2026-10-17T09:00:00Z", now)).toBe(true);
    expect(isDue("2026-10-18T00:00:00Z", now)).toBe(false);
  });

  it("подпись на кнопке", () => {
    expect(previewLabel(fresh, 0)).toBe("10 мин");
    expect(previewLabel(fresh, 2)).toBe("1 дн.");
  });
});
