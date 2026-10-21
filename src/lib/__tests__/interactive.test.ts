import { describe, expect, it } from "vitest";
import { byteSize, htmlTitle, looksLikeHtml, normalizeHtml } from "../interactive";

describe("htmlTitle", () => {
  it("берёт <title> и раскодирует сущности", () => {
    expect(htmlTitle("<html><head><title> DC-DC &amp; ШИМ </title></head></html>")).toBe("DC-DC & ШИМ");
  });
  it("без <title> — первый <h1> без тегов", () => {
    expect(htmlTitle("<body><h1>Понижающий <b>преобразователь</b></h1></body>")).toBe("Понижающий преобразователь");
  });
  it("нет ни того, ни другого — пусто", () => {
    expect(htmlTitle("<div>x</div>")).toBe("");
  });
});

describe("normalizeHtml", () => {
  it("полный документ не ломает, добавляет кодировку и viewport", () => {
    const out = normalizeHtml("<!DOCTYPE html><html lang=\"ru\"><head><title>A</title></head><body>x</body></html>");
    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).toContain('<meta charset="utf-8">');
    expect(out).toContain('name="viewport"');
    expect(out).toContain("<title>A</title>");
  });
  it("кусок разметки оборачивает в документ", () => {
    const out = normalizeHtml("<canvas id=c></canvas><script>1</script>");
    expect(/^<!doctype html>/i.test(out)).toBe(true);
    expect(out).toContain("<body>\n<canvas id=c></canvas><script>1</script>\n</body>");
    expect(out).toContain('<meta charset="utf-8">');
  });
  it("снимает ```html из чата", () => {
    const out = normalizeHtml("```html\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"x\"></head><body>y</body></html>\n```");
    expect(out).toBe('<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="x"></head><body>y</body></html>');
  });
  it("html без head — head добавляется", () => {
    const out = normalizeHtml("<html><body>z</body></html>");
    expect(/<html>\n<head>\n<meta charset="utf-8">/.test(out)).toBe(true);
  });
  it("существующую кодировку не дублирует", () => {
    const out = normalizeHtml('<html><head><meta charset="UTF-8"></head></html>');
    expect(out.match(/charset/gi)?.length).toBe(1);
  });
});

describe("прочее", () => {
  it("looksLikeHtml", () => {
    expect(looksLikeHtml("<div>")).toBe(true);
    expect(looksLikeHtml("просто текст 2 < 3")).toBe(false);
  });
  it("byteSize считает UTF-8", () => {
    expect(byteSize("ab")).toBe(2);
    expect(byteSize("я")).toBe(2);
  });
});
