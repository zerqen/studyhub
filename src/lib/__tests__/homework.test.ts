import { describe, expect, it } from "vitest";
import { dueFields, isAssignedAt, isDueAt, nextLesson } from "../homework";
import { expandEvents } from "../schedule";

// Матан: лекция пн 09:00 МСК, практика ср 10:45 и сдвоенная практика ср 12:20; экзамен в январе
const events = [
  { id: "lec", subjectId: "m", kind: "LECTURE", startAt: "2026-09-07T06:00:00Z", endAt: "2026-09-07T07:30:00Z", recurrence: "WEEKLY", repeatUntil: null },
  { id: "sem1", subjectId: "m", kind: "SEMINAR", startAt: "2026-09-09T07:45:00Z", endAt: "2026-09-09T09:15:00Z", recurrence: "WEEKLY", repeatUntil: null },
  { id: "sem2", subjectId: "m", kind: "SEMINAR", startAt: "2026-09-09T09:20:00Z", endAt: "2026-09-09T10:50:00Z", recurrence: "WEEKLY", repeatUntil: null },
  { id: "phys", subjectId: "f", kind: "LAB", startAt: "2026-09-08T06:00:00Z", endAt: null, recurrence: "WEEKLY", repeatUntil: null },
  { id: "consult", subjectId: "m", kind: "CONSULT", startAt: "2026-10-20T12:00:00Z", endAt: null, recurrence: null, repeatUntil: null },
];
const occ = expandEvents(events, new Date("2026-10-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));

describe("nextLesson", () => {
  it("после практики в среду — лекция в понедельник (следующая пара предмета)", () => {
    const n = nextLesson(occ, "m", new Date("2026-10-14T07:45:00Z"));
    expect(n?.id).toBe("lec");
    expect(n?.start.toISOString()).toBe("2026-10-19T06:00:00.000Z");
  });

  it("того же типа — практика через неделю, а не вторая пара того же дня", () => {
    const n = nextLesson(occ, "m", new Date("2026-10-14T07:45:00Z"), "SEMINAR");
    expect(n?.start.toISOString()).toBe("2026-10-21T07:45:00.000Z");
  });

  it("консультации и экзамены пропускаются, чужие предметы — тоже", () => {
    const n = nextLesson(occ, "f", new Date("2026-10-13T06:00:00Z"));
    expect(n?.id).toBe("phys");
    expect(n?.start.toISOString()).toBe("2026-10-20T06:00:00.000Z");
    const m = nextLesson(occ, "m", new Date("2026-10-19T06:00:00Z"));
    expect(m?.kind).toBe("SEMINAR");
  });

  it("если пар больше нет — null", () => {
    expect(nextLesson(occ, "m", new Date("2026-12-31T00:00:00Z"))).toBeNull();
  });
});

describe("сроки домашки", () => {
  it("срок хранится как день по Москве + время пары", () => {
    const f = dueFields(new Date("2026-10-21T07:45:00Z"));
    expect(f.dueDate.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(f.dueTime).toBe("10:45");
  });

  it("поздняя пара не съезжает на другой день", () => {
    const f = dueFields(new Date("2026-10-21T20:30:00Z"));
    expect(f.dueDate.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(f.dueTime).toBe("23:30");
  });

  it("находит домашку к паре и пару, на которой задали", () => {
    const lesson = { subjectId: "m", start: new Date("2026-10-21T07:45:00Z") };
    expect(isDueAt({ subjectId: "m", dueDate: "2026-10-21T00:00:00.000Z" }, lesson)).toBe(true);
    expect(isDueAt({ subjectId: "f", dueDate: "2026-10-21T00:00:00.000Z" }, lesson)).toBe(false);
    expect(isAssignedAt({ subjectId: "m", lessonAt: "2026-10-21T07:45:00.000Z" }, lesson)).toBe(true);
    expect(isAssignedAt({ subjectId: "m", lessonAt: "2026-10-14T07:45:00.000Z" }, lesson)).toBe(false);
  });
});
