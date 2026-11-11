import { describe, expect, it } from "vitest";
import { buildWeekGroups, inDays, limitGroups, studyWeek, subjectShort, todayLine, type HomeTask } from "../home";

// Вторник, 10 ноября 2026, вечер по Москве
const now = new Date("2026-11-10T18:00:00+03:00");
const t = (id: string, due: string | null, over: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title: id,
  kind: "HOMEWORK",
  status: "PLANNED",
  dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
  dueTime: null,
  subject: null,
  subtasks: [],
  ...over,
});

describe("buildWeekGroups", () => {
  it("раскладывает по дням и сливает выходные", () => {
    const groups = buildWeekGroups([t("ср", "2026-11-11"), t("чт", "2026-11-12"), t("сб", "2026-11-14"), t("вс", "2026-11-15"), t("пн", "2026-11-16")], now);
    expect(groups.map((g) => g.label)).toEqual(["Завтра", "Четверг", "Выходные", "Понедельник"]);
    expect(groups[2].items.map((x) => x.id)).toEqual(["сб", "вс"]);
    expect(groups[0].urgent).toBe(true);
    expect(groups[1].urgent).toBe(false);
  });

  it("просроченное — первой группой, закрытое и дальнее не попадает", () => {
    const groups = buildWeekGroups([t("старое", "2026-11-01"), t("сегодня", "2026-11-10"), t("сделано", "2026-11-10", { status: "DONE" }), t("потом", "2026-11-30"), t("без срока", null)], now);
    expect(groups.map((g) => g.label)).toEqual(["Просрочено", "Сегодня"]);
    expect(groups.flatMap((g) => g.items.map((x) => x.id))).toEqual(["старое", "сегодня"]);
  });

  it("сортирует внутри дня по времени", () => {
    const groups = buildWeekGroups([t("поздно", "2026-11-12", { dueTime: "18:00" }), t("без времени", "2026-11-12"), t("рано", "2026-11-12", { dueTime: "09:00" })], now);
    expect(groups[0].items.map((x) => x.id)).toEqual(["рано", "поздно", "без времени"]);
  });

  it("в субботу сегодня и завтра не сливаются в выходные", () => {
    const sat = new Date("2026-11-14T10:00:00+03:00");
    const groups = buildWeekGroups([t("сб", "2026-11-14"), t("вс", "2026-11-15")], sat);
    expect(groups.map((g) => g.label)).toEqual(["Сегодня", "Завтра"]);
  });
});

describe("limitGroups", () => {
  it("режет список, не теряя заголовки групп", () => {
    const groups = buildWeekGroups([t("a", "2026-11-11"), t("b", "2026-11-11"), t("c", "2026-11-12")], now);
    const cut = limitGroups(groups, 2);
    expect(cut.length).toBe(1);
    expect(cut[0].items.length).toBe(2);
  });
});

describe("subjectShort", () => {
  it("берёт первые буквы главных слов", () => {
    expect(subjectShort("Линейная алгебра")).toBe("ЛА");
    expect(subjectShort("Введение в радиоэлектронику")).toBe("РА");
    expect(subjectShort("Физика")).toBe("ФИ");
    expect(subjectShort("История России 📜")).toBe("ИР");
    expect(subjectShort("")).toBe("?");
  });
});

describe("подписи", () => {
  it("склоняет дни", () => {
    expect([0, 1, 2, 5, 11, 21, 63, 112].map(inDays)).toEqual(["сегодня", "завтра", "через 2 дня", "через 5 дней", "через 11 дней", "через 21 день", "через 63 дня", "через 112 дней"]);
  });

  it("считает учебную неделю от 1 сентября", () => {
    expect(studyWeek(now)).toBe(11);
    expect(studyWeek(new Date("2026-09-01T10:00:00+03:00"))).toBe(1);
    expect(studyWeek(new Date("2027-02-10T10:00:00+03:00"))).toBe(24);
  });

  it("пишет дату и неделю", () => {
    expect(todayLine(now)).toBe("вторник, 10 ноября · 11-я неделя");
    expect(todayLine(new Date("2026-07-20T10:00:00+03:00"))).toBe("понедельник, 20 июля");
  });
});
