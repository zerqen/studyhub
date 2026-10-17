import { describe, expect, it } from "vitest";
import { buildExam, examScore, ticketNumbers, weightedSample, type ExamPoolQuestion } from "../exam";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const q = (id: string, patch: Partial<ExamPoolQuestion> = {}): ExamPoolQuestion => ({
  id,
  kind: "THEORY",
  ticketNo: null,
  lectureId: null,
  tags: [],
  status: "UNLEARNED",
  difficulty: "MEDIUM",
  srsLapses: 0,
  ...patch,
});

const pool: ExamPoolQuestion[] = [
  ...Array.from({ length: 12 }, (_, i) => q(`t${i}`, { lectureId: `L${i % 4}`, tags: i % 3 === 0 ? ["пределы"] : [] })),
  ...Array.from({ length: 6 }, (_, i) => q(`p${i}`, { kind: "PROBLEM" })),
];

describe("buildExam", () => {
  it("случайный билет: 2 теории + 3 задачи + 3 вопроса препода без повторов", () => {
    for (let seed = 1; seed < 30; seed++) {
      const { items, ticketNo } = buildExam(pool, { theory: 2, problems: 3, extra: 3, ticketNo: null, weak: false }, seeded(seed));
      expect(ticketNo).toBeNull();
      expect(items.filter((i) => i.role === "THEORY")).toHaveLength(2);
      expect(items.filter((i) => i.role === "PROBLEM")).toHaveLength(3);
      expect(items.filter((i) => i.role === "EXTRA")).toHaveLength(3);
      expect(new Set(items.map((i) => i.questionId)).size).toBe(items.length);
      // задачи — только из задач, теория и вопросы препода — только из теории
      for (const it of items) expect(it.questionId.startsWith(it.role === "PROBLEM" ? "p" : "t")).toBe(true);
    }
  });

  it("вопросы препода частично по теме билета", () => {
    const { items } = buildExam(pool, { theory: 2, problems: 0, extra: 4, ticketNo: null, weak: false }, seeded(7));
    expect(items.filter((i) => i.role === "EXTRA" && i.related).length).toBeGreaterThanOrEqual(2);
  });

  it("если вопросов мало — берёт сколько есть", () => {
    const { items } = buildExam([q("a"), q("b", { kind: "PROBLEM" })], { theory: 3, problems: 3, extra: 3, ticketNo: null, weak: false });
    expect(items.map((i) => i.role)).toEqual(["THEORY", "PROBLEM"]);
  });

  it("реальный билет берёт все его вопросы", () => {
    const withTickets = [...pool, q("x1", { ticketNo: 5 }), q("x2", { ticketNo: 5 }), q("x3", { ticketNo: 5, kind: "PROBLEM" }), q("y1", { ticketNo: 6 })];
    expect(ticketNumbers(withTickets)).toEqual([5, 6]);
    const { items, ticketNo } = buildExam(withTickets, { theory: 2, problems: 3, extra: 2, ticketNo: 5, weak: false });
    expect(ticketNo).toBe(5);
    expect(items.filter((i) => i.role !== "EXTRA").map((i) => i.questionId).sort()).toEqual(["x1", "x2", "x3"]);
  });

  it("реальный билет без задач — задачи добираются случайно", () => {
    const withTickets = [...pool, q("y1", { ticketNo: 6 }), q("y2", { ticketNo: 6 })];
    const { items } = buildExam(withTickets, { theory: 2, problems: 2, extra: 0, ticketNo: 6, weak: false });
    expect(items.filter((i) => i.role === "PROBLEM")).toHaveLength(2);
  });
});

describe("weightedSample", () => {
  it("чаще выбирает тяжёлые элементы", () => {
    const rng = seeded(42);
    let heavy = 0;
    for (let i = 0; i < 2000; i++) {
      const [x] = weightedSample(["a", "b"], 1, (v) => (v === "a" ? 9 : 1), rng);
      if (x === "a") heavy++;
    }
    expect(heavy / 2000).toBeGreaterThan(0.85);
  });
});

describe("examScore", () => {
  it("всё отлично — пятёрка", () => {
    expect(examScore([{ role: "THEORY", grade: 3 }, { role: "PROBLEM", grade: 3 }, { role: "EXTRA", grade: 3 }]).grade).toBe(5);
  });
  it("твёрдое «хорошо» по билету — четвёрка", () => {
    const items = [
      { role: "THEORY", grade: 2 },
      { role: "THEORY", grade: 3 },
      { role: "PROBLEM", grade: 2 },
      { role: "PROBLEM", grade: 2 },
      { role: "PROBLEM", grade: 2 },
      { role: "EXTRA", grade: 2 },
    ];
    expect(examScore(items).grade).toBe(4);
  });
  it("пустой билет не вытянуть вопросами препода", () => {
    const items = [
      { role: "THEORY", grade: 0 },
      { role: "THEORY", grade: 0 },
      { role: "PROBLEM", grade: 3 },
      { role: "EXTRA", grade: 3 },
      { role: "EXTRA", grade: 3 },
    ];
    expect(examScore(items).grade).toBe(2);
  });
  it("середнячок — тройка", () => {
    const items = [
      { role: "THEORY", grade: 2 },
      { role: "THEORY", grade: 1 },
      { role: "PROBLEM", grade: 1 },
      { role: "PROBLEM", grade: 2 },
      { role: "PROBLEM", grade: 1 },
      { role: "EXTRA", grade: 1 },
    ];
    expect(examScore(items).grade).toBe(3);
  });
});
