/** Интерактивные HTML-схемы: подготовка страницы. Чистые функции — проверяются тестами. */

/** Предел размера одной схемы (HTML хранится в базе) */
export const MAX_INTERACTIVE_BYTES = 5 * 1024 * 1024;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Название из <title> или первого <h1> */
export function htmlTitle(html: string) {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!t) return "";
  return decode(t.replace(/<[^>]+>/g, "")).slice(0, 160);
}

/** Размер строки в байтах UTF-8 */
export function byteSize(s: string) {
  return new TextEncoder().encode(s).length;
}

/**
 * Готовит страницу к запуску: кусок разметки оборачивается в документ,
 * добавляются кодировка и viewport, если их нет.
 */
export function normalizeHtml(raw: string) {
  let html = raw.replace(/^﻿/, "").trim();
  // Код из чата иногда приходит в ```html … ```
  const fence = html.match(/^```(?:html)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) html = fence[1].trim();
  if (!/<html[\s>]/i.test(html)) {
    const head = /<head[\s>]/i.test(html);
    html = head ? `<!doctype html>\n<html>${html}</html>` : `<!doctype html>\n<html>\n<head></head>\n<body>\n${html}\n</body>\n</html>`;
  }
  if (!/^<!doctype/i.test(html)) html = `<!doctype html>\n${html}`;
  if (!/<head[\s>]/i.test(html)) html = html.replace(/<html([^>]*)>/i, "<html$1>\n<head></head>");
  const inject: string[] = [];
  if (!/<meta[^>]+charset/i.test(html)) inject.push('<meta charset="utf-8">');
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) inject.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if (inject.length) html = html.replace(/<head([^>]*)>/i, `<head$1>\n${inject.join("\n")}`);
  return html;
}

/** Есть ли в тексте хоть какая-то разметка */
export function looksLikeHtml(s: string) {
  return /<([a-z][a-z0-9-]*)[\s>/]/i.test(s);
}
