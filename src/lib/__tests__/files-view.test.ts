import { describe, expect, it } from "vitest";
import { buildFiles, fileSize, kindOf, matchFile, placeFile, type FileRow } from "../files-view";

const fiz = { id: "fiz", name: "Общая физика", color: "#B91C1C", selfStudy: false };
const cpp = { id: "cpp", name: "C++", color: "#0369A1", selfStudy: true };
const base = (id: string, name: string, o: Partial<FileRow> = {}): FileRow => ({ id, originalName: name, mimeType: "application/pdf", size: 1000, createdAt: "2026-11-10T10:00:00Z", ...o });

describe("файлы", () => {
  it("находит предмет через задачу, лекцию, комментарий; без привязки — «Не прикреплено»", () => {
    expect(placeFile(base("a", "x", { subject: fiz })).where).toBe("Материалы предмета");
    const t = placeFile(base("b", "x", { task: { id: "t1", title: "Реферат", subject: fiz } }));
    expect([t.subject?.id, t.where, t.whereHref]).toEqual(["fiz", "Задача «Реферат»", "/tasks/t1"]);
    const l = placeFile(base("c", "x", { lecture: { id: "l3", number: 3, title: "Структуры и классы", subject: cpp } }));
    expect([l.subject?.id, l.where]).toEqual(["cpp", "Лекция 3 · Структуры и классы"]);
    const c = placeFile(base("d", "x", { comment: { task: { id: "t1", title: "Реферат", subject: fiz }, question: null } }));
    expect(c.whereHref).toBe("/tasks/t1");
    expect(placeFile(base("e", "x")).where).toBe("Не прикреплено");
  });

  it("папки: предметы и «Изучаю» отдельно, с числами", () => {
    const r = buildFiles([base("a", "1", { subject: fiz }), base("b", "2", { task: { id: "t", title: "т", subject: fiz } }), base("c", "3", { subject: cpp }), base("d", "4")]);
    expect(r.subjects.map((f) => [f.id, f.count])).toEqual([["fiz", 2]]);
    expect(r.learn.map((f) => [f.id, f.count])).toEqual([["cpp", 1]]);
    expect(r.loose).toBe(1);
    expect(r.items.map((i) => i.folder)).toEqual(["fiz", "fiz", "cpp", "loose"]);
  });

  it("тип, поиск, размер", () => {
    expect([kindOf("a.pdf", "application/pdf"), kindOf("b.docx", "application/vnd"), kindOf("c.zip", "application/zip"), kindOf("d.jpg", "image/jpeg"), kindOf("e.bin", "application/octet-stream")]).toEqual(["pdf", "docs", "zip", "images", "other"]);
    const f = { id: "1", name: "ЛР60_расчёт.xlsx", mimeType: "", size: 1, createdAt: "", folder: "fiz", where: "Материалы предмета", whereHref: null };
    expect(matchFile("расчет лр60", f, "Общая физика")).toBe(true);
    expect(matchFile("физика", f, "Общая физика")).toBe(true);
    expect(matchFile("реферат", f, "Общая физика")).toBe(false);
    expect([fileSize(0), fileSize(13000), fileSize(683000), fileSize(5_400_000)]).toEqual(["—", "13 КБ", "667 КБ", "5.1 МБ"]);
  });
});
