import { describe, expect, it } from "vitest";
import type { AttachmentDto, LectureDto, QuestionDto, SubjectDto } from "../../../electron/types";
import { buildFileFolders, extBadge, filterAndSortFiles, kindOf, matchFile } from "../files-view";
import { buildFormulaSheet, extractFormulas } from "../formulas";
import { parseQuickTask } from "../quick-task";
import { buildExamTicket, buildWeakestDeck } from "../srs";

const subjects: SubjectDto[] = [
  { id: "s_mat", name: "Математический анализ", emoji: "📐", color: "#2d5bd2", type: "EXAM", questionsTotal: 10, questionsLearned: 4, progress: 40 },
  { id: "s_lin", name: "Линейная алгебра", emoji: "🧮", color: "#7c3aed", type: "EXAM", questionsTotal: 8, questionsLearned: 2, progress: 25 },
  { id: "s_phy", name: "Физика", emoji: "⚡", color: "#10b981", type: "CREDIT", questionsTotal: 5, questionsLearned: 5, progress: 100 },
];

describe("desktop offline domain logic", () => {
  it("parses Russian quick-add phrases including aliases and relative dates", () => {
    const wednesday = new Date(2026, 10, 25);
    const hw = parseQuickTask("ДЗ матан завтра 18:00", subjects, wednesday);
    expect(hw.kind).toBe("HOMEWORK");
    expect(hw.subjectId).toBe("s_mat");
    expect(hw.dueDateIso).toBe("2026-11-26T00:00:00.000Z");
    expect(hw.dueTime).toBe("18:00");

    const testTask = parseQuickTask("кр линал в пятницу", subjects, wednesday);
    expect(testTask.kind).toBe("TEST");
    expect(testTask.subjectId).toBe("s_lin");
    expect(testTask.dueDateIso).toBe("2026-11-27T00:00:00.000Z");
  });

  it("filters, sorts, and builds folders for all files including loose items", () => {
    const files: AttachmentDto[] = [
      {
        id: "a1",
        originalName: "Отчёт.pdf",
        mimeType: "application/pdf",
        size: 120000,
        subjectId: "s_phy",
        createdAt: "2026-11-24T10:00:00.000Z",
        folder: "s_phy",
        folderName: "Физика",
        folderColor: "#10b981",
        folderSelfStudy: false,
        whereLabel: "Задача «Лаба»",
      },
      {
        id: "a2",
        originalName: "заметки.docx",
        mimeType: "application/octet-stream",
        size: 5000,
        createdAt: "2026-11-10T10:00:00.000Z",
        folder: "loose",
        folderName: "Не прикреплено",
        folderSelfStudy: false,
        whereLabel: "Не прикреплено",
      },
    ];
    expect(kindOf(files[0].originalName, files[0].mimeType)).toBe("pdf");
    expect(kindOf(files[1].originalName, files[1].mimeType)).toBe("docs");
    expect(extBadge("Отчёт.pdf")).toBe("PDF");
    expect(matchFile("отчет", files[0])).toBe(true);
    expect(buildFileFolders(files, subjects).map((f) => f.id)).toEqual(["s_phy"]);
    expect(filterAndSortFiles(files, "loose", "all", "new", "").map((f) => f.id)).toEqual(["a2"]);
  });

  it("extracts deduplicated formulas and picks weakest/ticket decks", () => {
    const md = "Рассмотрим $x$ и $E = mc^2$ и $$\\int_0^1 x dx = \\frac{1}{2}$$";
    expect(extractFormulas(md)).toEqual(["E = mc^2", "\\int_0^1 x dx = \\frac{1}{2}"]);

    const lectures: LectureDto[] = [
      { id: "l1", subjectId: "s_mat", number: 1, title: "Пределы", summary: "Ещё $a+b=c$", transcript: "", createdAt: "", updatedAt: "" },
    ];
    const questions: QuestionDto[] = [
      { id: "q1", subjectId: "s_mat", text: "Предел", answer: "$$a+b=c$$", status: "NEW", difficulty: "MEDIUM", kind: "THEORY", lectureTitle: "Лекция 1: Пределы", srsInterval: 0, srsEase: 2.5, srsReps: 0, srsLapses: 2, sortOrder: 1 },
      { id: "q2", subjectId: "s_mat", text: "Задача", answer: "$y=x$", status: "LEARNED", difficulty: "EASY", kind: "PROBLEM", srsInterval: 15, srsEase: 2.6, srsReps: 4, srsLapses: 0, sortOrder: 2 },
    ];
    const sheet = buildFormulaSheet(lectures, questions);
    expect(sheet).toHaveLength(1);
    expect(sheet[0].entries).toHaveLength(1);
    expect(buildWeakestDeck(questions, "s_mat", 1).map((q) => q.id)).toEqual(["q1"]);
    expect(buildExamTicket(questions, "s_mat").length).toBe(2);
  });
});
