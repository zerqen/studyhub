import { describe, expect, it } from "vitest";
import { parseQuickTask } from "../quick-task";

const subjects = [
  { id: "f", name: "Физика" },
  { id: "la", name: "Линейная алгебра и аналитическая геометрия" },
  { id: "ma", name: "Математический анализ" },
  { id: "ig", name: "Инженерная графика" },
  { id: "pc", name: "Физическая культура и спорт" },
];
// среда, 21 октября 2026
const now = new Date(2026, 9, 21, 14, 0);

describe("быстрое добавление задачи", () => {
  it("лаба с предметом и датой", () => {
    expect(parseQuickTask("лаба 3 физика до 5.11", subjects, now)).toEqual({
      title: "Лаба 3",
      kind: "LAB",
      subjectId: "f",
      subjectName: "Физика",
      dueDate: "2026-11-05",
      dueTime: null,
    });
  });

  it("кр по сокращению предмета и дню недели", () => {
    const r = parseQuickTask("кр линал в среду", subjects, now);
    expect(r.kind).toBe("TEST");
    expect(r.subjectId).toBe("la");
    expect(r.dueDate).toBe("2026-10-28"); // сегодня среда → следующая
    expect(r.title).toBe("Контрольная");
  });

  it("чертёж через неделю, время", () => {
    const r = parseQuickTask("чертёж лист 2 инженерная графика через неделю в 10:45", subjects, now);
    expect(r).toMatchObject({ kind: "DRAWING", subjectId: "ig", dueDate: "2026-10-28", dueTime: "10:45", title: "Чертёж лист 2" });
  });

  it("дз на завтра, месяц словом", () => {
    expect(parseQuickTask("дз матан завтра", subjects, now)).toMatchObject({ kind: "HOMEWORK", subjectId: "ma", dueDate: "2026-10-22", title: "Домашка" });
    expect(parseQuickTask("сдать реферат 3 декабря", subjects, now)).toMatchObject({ kind: "TASK", subjectId: null, dueDate: "2026-12-03", title: "Сдать реферат" });
  });

  it("дата в начале следующего года", () => {
    expect(parseQuickTask("экзамен 15.01", subjects, now).dueDate).toBe("2027-01-15");
    expect(parseQuickTask("что-то 25.12.2026", subjects, now).dueDate).toBe("2026-12-25");
  });

  it("без даты и предмета — просто название", () => {
    expect(parseQuickTask("купить тетради", subjects, now)).toMatchObject({ title: "Купить тетради", kind: "TASK", subjectId: null, dueDate: null });
  });

  it("неоднозначный «физ» не выбирает предмет", () => {
    expect(parseQuickTask("дз физ к пятнице", subjects, now)).toMatchObject({ subjectId: null, dueDate: "2026-10-23" });
  });
});
