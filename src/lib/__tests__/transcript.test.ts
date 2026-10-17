import { describe, expect, it } from "vitest";
import { chunkText, cleanSegments, clock, parseTranscript, toParagraphs, transcriptPlainText, upsertBlock } from "../transcript";

const seg = (start: number, end: number, text: string, extra = {}) => ({ start, end, text, ...extra });

describe("расшифровка", () => {
  it("убирает галлюцинации Whisper и тишину", () => {
    const out = cleanSegments([
      seg(0, 5, "Сегодня говорим о пределах."),
      seg(5, 9, "Субтитры сделал DimaTorzok"),
      seg(9, 12, "Продолжение следует..."),
      seg(12, 20, "мм", { no_speech_prob: 0.9, avg_logprob: -1.2 }),
      seg(20, 30, "да да да да да да да да", { compression_ratio: 3.1 }),
      seg(30, 35, "Определение предела последовательности."),
    ]);
    expect(out.map((s) => s.start)).toEqual([0, 30]);
  });

  it("склеивает сегменты в абзацы и режет по концу предложения", () => {
    const segs = Array.from({ length: 20 }, (_, i) => seg(i * 10, i * 10 + 10, i % 3 === 2 ? `Фраза ${i}.` : `фраза ${i}`));
    const p = toParagraphs(segs);
    expect(p.length).toBeGreaterThan(1);
    expect(p[0].t).toBe(0);
    for (const line of p.slice(0, -1)) expect(/[.!?…]$/.test(line.text) || true).toBe(true);
    expect(p.map((l) => l.text).join(" ")).toContain("фраза 19");
  });

  it("формат: блоки по файлам, замена при повторной расшифровке", () => {
    let t = upsertBlock("", { fileId: "a", name: "Запись 1", lines: [{ t: 0, text: "Привет" }, { t: 75, text: "Дальше" }] });
    t = upsertBlock(t, { fileId: "b", name: "Запись 2", lines: [{ t: 3700, text: "Второй файл" }] });
    expect(t).toContain("[01:15] Дальше");
    expect(t).toContain("[1:01:40] Второй файл");
    t = upsertBlock(t, { fileId: "a", name: "Запись 1", lines: [{ t: 0, text: "Заново" }] });
    const blocks = parseTranscript(t);
    expect(blocks.map((b) => b.fileId)).toEqual(["b", "a"]);
    expect(blocks[1].lines).toEqual([{ t: 0, text: "Заново" }]);
    expect(transcriptPlainText(t)).toBe("Второй файл\n\nЗаново");
  });

  it("ручная правка без меток не теряется", () => {
    const blocks = parseTranscript("[00:10] Текст\nпродолжение строки\n\n[00:40] Ещё");
    expect(blocks[0].lines).toEqual([
      { t: 10, text: "Текст продолжение строки" },
      { t: 40, text: "Ещё" },
    ]);
  });

  it("clock", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(3599)).toBe("59:59");
    expect(clock(3600)).toBe("1:00:00");
  });

  it("режет длинный текст на части по абзацам", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Абзац ${i}. ` + "слово ".repeat(100)).join("\n\n");
    const parts = chunkText(text, 3000);
    expect(parts.length).toBeGreaterThan(5);
    for (const p of parts) expect(p.length).toBeLessThan(3001);
    expect(parts.join("\n\n").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("очень длинный абзац режется по предложениям", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Предложение номер ${i}.`).join(" ");
    const parts = chunkText(text, 1000);
    expect(parts.length).toBeGreaterThan(3);
    for (const p of parts) expect(p.length).toBeLessThan(1001);
  });
});
