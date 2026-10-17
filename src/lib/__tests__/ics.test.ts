import { describe, expect, it } from "vitest";
import { normalizeName, parseIcs, summarizeIcs } from "../ics";

const sample = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "X-WR-CALNAME:М4О-102БВ-26",
  "BEGIN:VEVENT",
  "UID:a1@schedule.example",
  "DTSTART:20260902T060000Z",
  "DTEND:20260902T073000Z",
  "SUMMARY:Линейная алгебра и аналитическая ге",
  " ометрия",
  "LOCATION:Орш. В-223\\, Орш. В-505",
  "DESCRIPTION:ЛК\\nКузнецова Екатерина Львовна",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a2@schedule.example",
  "DTSTART;TZID=Europe/Moscow:20270112T130000",
  "DTEND;TZID=Europe/Moscow:20270112T143000",
  "SUMMARY:Линейная алгебра и аналитическая геометрия",
  "DESCRIPTION:Экзамен",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a3@schedule.example",
  "DTSTART;VALUE=DATE:20261104",
  "SUMMARY:День народного единства",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  const { name, events } = parseIcs(sample);
  const byUid = (uid: string) => events.find((e) => e.uid === uid)!;

  it("читает название календаря и все события", () => {
    expect(name).toBe("М4О-102БВ-26");
    expect(events).toHaveLength(3);
  });

  it("склеивает перенесённые строки и раскрывает экранирование", () => {
    expect(byUid("a1@schedule.example").title).toBe("Линейная алгебра и аналитическая геометрия");
    expect(byUid("a1@schedule.example").location).toBe("Орш. В-223, Орш. В-505");
  });

  it("распознаёт тип пары и преподавателя", () => {
    expect(byUid("a1@schedule.example").kind).toBe("LECTURE");
    expect(byUid("a1@schedule.example").teacher).toBe("Кузнецова Екатерина Львовна");
    expect(byUid("a2@schedule.example").kind).toBe("EXAM");
  });

  it("учитывает часовой пояс и события на весь день", () => {
    expect(byUid("a1@schedule.example").start.toISOString()).toBe("2026-09-02T06:00:00.000Z");
    expect(byUid("a2@schedule.example").start.toISOString()).toBe("2027-01-12T10:00:00.000Z");
    expect(byUid("a3@schedule.example").allDay).toBe(true);
  });

  it("сводка по предметам с датой экзамена", () => {
    const s = summarizeIcs(events);
    const la = s.subjects.find((x) => x.name.startsWith("Линейная"))!;
    expect(la.count).toBe(2);
    expect(la.exam?.toISOString()).toBe("2027-01-12T10:00:00.000Z");
  });

  it("не принимает не-календарь", () => {
    expect(() => parseIcs("hello")).toThrow();
  });
});

describe("normalizeName", () => {
  it("сопоставляет названия без учёта регистра, ё и знаков", () => {
    expect(normalizeName("Общая  Физика!")).toBe(normalizeName("общая физика"));
    expect(normalizeName("Ёмкость")).toBe("емкость");
  });
});
