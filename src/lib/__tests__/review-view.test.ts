import { describe, expect, it } from "vitest";
import { buildDecks, todayCount } from "../review-view";

const now = new Date("2026-11-11T12:00:00Z");
const S = (id: string, exam: string | null, type = "EXAM") => ({ id, name: id, color: "#000", type, examDate: exam });
const Q = (subjectId: string, status: string, srsReps: number, srsDue: string | null) => ({ subjectId, status, srsReps, srsDue });

describe("колоды повторения", () => {
  it("считает и сортирует: сначала где есть что повторить, потом по экзамену", () => {
    const { decks, empty } = buildDecks(
      [S("ма", "2027-01-25"), S("ла", "2027-01-12"), S("ит", "2027-01-21"), S("физ", "2027-01-16"), S("физра", null, "CREDIT")],
      [
        Q("ма", "IN_PROGRESS", 2, "2026-11-10T00:00:00Z"),
        Q("ма", "LEARNED", 5, "2026-12-01T00:00:00Z"),
        Q("ма", "UNLEARNED", 0, null),
        Q("ла", "UNLEARNED", 0, null),
        Q("ит", "UNLEARNED", 0, null),
      ],
      now,
    );
    expect(decks.map((d) => [d.id, d.due, d.fresh, d.learned, d.total])).toEqual([
      ["ма", 1, 1, 1, 3],
      ["ла", 0, 1, 0, 1],
      ["ит", 0, 1, 0, 1],
    ]);
    expect(empty.map((d) => d.id)).toEqual(["физ"]);
  });

  it("на сегодня: повторы + новые не больше лимита", () => {
    const decks = [
      { id: "a", name: "a", color: "", examDate: null, due: 5, fresh: 30, learned: 0, total: 35 },
      { id: "b", name: "b", color: "", examDate: null, due: 3, fresh: 10, learned: 0, total: 13 },
    ];
    expect(todayCount(decks, 20)).toEqual({ due: 8, fresh: 20, total: 28, minutes: 21 });
  });
});
