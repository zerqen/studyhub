import { describe, expect, it } from "vitest";
import { buildFeed, type Note } from "../notify-view";

const now = new Date("2026-11-11T15:00:00+03:00");
const n = (id: string, title: string, href: string, at: string, over: Partial<Note> = {}): Note => ({ id, title, body: `тело ${id}`, href, read: false, kind: "info", createdAt: new Date(at), ...over });

describe("buildFeed", () => {
  const notes = [
    n("a", "Задача на сегодня", "/tasks/1", "2026-11-11T08:00:00+03:00", { kind: "today" }),
    n("b", "Просроченная задача", "/tasks/2", "2026-11-11T08:00:00+03:00", { kind: "danger" }),
    n("c", "Просроченная задача", "/tasks/2", "2026-11-10T08:00:00+03:00", { kind: "danger", read: true }),
    n("d", "Задача на сегодня", "/tasks/3", "2026-11-03T08:00:00+03:00", { kind: "today", read: true }),
  ];

  it("группирует и сливает повторы просрочки", () => {
    const g = buildFeed(notes, now);
    expect(g.map((x) => [x.id, x.items.map((i) => i.ids)])).toEqual([
      ["today", [["a"]]],
      ["late", [["b", "c"]]],
      ["earlier", [["d"]]],
    ]);
    expect(g[1].items[0].label).toBe("Просрочено · 2 напоминания");
    expect(g[1].items[0].read).toBe(false);
  });

  it("вкладка «Непрочитанные»", () => {
    const g = buildFeed(notes, now, true);
    expect(g.flatMap((x) => x.items.flatMap((i) => i.ids))).toEqual(["a", "b", "c"]);
  });

  it("пустая лента", () => {
    expect(buildFeed([], now)).toEqual([]);
  });
});
