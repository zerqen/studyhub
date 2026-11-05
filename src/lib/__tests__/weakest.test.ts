import { describe, expect, it } from "vitest";
import { pickWeakest, weakness, type WeakCandidate } from "../weakest";

const now = new Date("2026-11-05T12:00:00Z");
const q = (over: Partial<WeakCandidate & { id: string }>): WeakCandidate & { id: string } => ({
  id: "x",
  answer: "ответ",
  kind: "THEORY",
  status: "IN_PROGRESS",
  difficulty: "MEDIUM",
  srsDue: "2026-12-01T00:00:00Z",
  srsInterval: 7,
  srsEase: 2.5,
  srsReps: 3,
  srsLapses: 0,
  ...over,
});

describe("weakness", () => {
  it("забытый вопрос слабее выученного", () => {
    const forgotten = q({ status: "REVIEW", srsLapses: 2, srsInterval: 0, srsReps: 0, srsDue: "2026-11-05T11:00:00Z", srsEase: 2.1 });
    const learned = q({ status: "LEARNED", srsInterval: 30, srsEase: 2.8 });
    expect(weakness(forgotten, now)).toBeGreaterThan(weakness(learned, now));
  });

  it("новый вопрос слабее уверенно выученного, но сильнее многократно забытого", () => {
    const fresh = q({ status: "UNLEARNED", srsReps: 0, srsInterval: 0, srsDue: null });
    const learned = q({ status: "LEARNED", srsInterval: 30 });
    const forgotten = q({ status: "REVIEW", srsLapses: 3, srsReps: 0, srsInterval: 0, srsDue: "2026-11-05T11:00:00Z" });
    expect(weakness(fresh, now)).toBeGreaterThan(weakness(learned, now));
    expect(weakness(forgotten, now)).toBeGreaterThan(weakness(fresh, now));
  });
});

describe("pickWeakest", () => {
  it("берёт только теорию с ответом", () => {
    const picked = pickWeakest([q({ id: "problem", kind: "PROBLEM" }), q({ id: "empty", answer: "  " }), q({ id: "none", answer: null }), q({ id: "ok" })], 20, now);
    expect(picked.map((x) => x.id)).toEqual(["ok"]);
  });

  it("сортирует от слабого и соблюдает лимит", () => {
    const picked = pickWeakest([q({ id: "strong", srsInterval: 40 }), q({ id: "weak", srsLapses: 4 }), q({ id: "mid" })], 2, now);
    expect(picked.map((x) => x.id)).toEqual(["weak", "mid"]);
  });

  it("при равенстве сохраняет исходный порядок", () => {
    expect(pickWeakest([q({ id: "a" }), q({ id: "b" })], 2, now).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
