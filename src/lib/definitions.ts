import type { Grade } from "./srs";

/**
 * Режим «Определения»: тренировка точных формулировок.
 * Ключевые части — то, что выделено в ответе **жирным**, и формулы отдельной строкой $$…$$.
 */
export type KeyPart = {
  index: number;
  /** Исходный Markdown части, как он записан в ответе */
  source: string;
  kind: "bold" | "formula";
  start: number;
  end: number;
};

/** 1 — скрыта часть ключевых мест, 2 — скрыты все, 3 — ответ целиком по памяти */
export type DrillLevel = 1 | 2 | 3;

// Порядок важен: код и формулы проглатываются целиком, чтобы ** внутри них не считалось выделением
// Без lookbehind: на старых iOS такой регэксп ломает загрузку всего модуля
const TOKENS = /\\\$|```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]+?\$\$|\*\*(?=\S)[^\n]*?\S\*\*|\$[^$\n]+?\$/g;

export function parseKeyParts(answer: string | null | undefined): KeyPart[] {
  const parts: KeyPart[] = [];
  for (const m of (answer ?? "").matchAll(TOKENS)) {
    const source = m[0];
    const kind = source.startsWith("**") ? "bold" : source.startsWith("$$") ? "formula" : null;
    if (!kind) continue;
    parts.push({ index: parts.length, source, kind, start: m.index, end: m.index + source.length });
  }
  return parts;
}

/** Есть ли в ответе разметка жирным (формул для тренировки обычно мало, их может дополнить ИИ) */
export function hasMarkedParts(answer: string | null | undefined) {
  return parseKeyParts(answer).some((p) => p.kind === "bold");
}

/** Текст части для списка самопроверки: без звёздочек, формула — в одну строку */
export function partLabel(part: Pick<KeyPart, "source" | "kind">) {
  if (part.kind === "bold") return part.source.slice(2, -2);
  return `$${part.source.slice(2, -2).trim().replace(/\s*\n\s*/g, " ")}$`;
}

/** Ответ со скрытыми частями: вместо них ссылка-заглушка #gap-N, которую Markdown рисует пропуском */
export function maskAnswer(answer: string, hidden: ReadonlySet<number>) {
  let out = "";
  let pos = 0;
  for (const part of parseKeyParts(answer)) {
    if (!hidden.has(part.index)) continue;
    out += answer.slice(pos, part.start) + `[…](#gap-${part.index})`;
    pos = part.end;
  }
  return out + answer.slice(pos);
}

/** Номер скрытой части из адреса заглушки */
export function gapIndex(href: string | undefined) {
  const m = /^#gap-(\d+)$/.exec(href ?? "");
  return m ? Number(m[1]) : null;
}

/** Какие части скрыть. На первом уровне — через одну, offset меняет, какие именно. */
export function hiddenParts(count: number, level: DrillLevel, offset = 0): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (level !== 1 || count < 2) return all;
  return all.filter((i) => i % 2 === offset % 2);
}

/** Уровень растёт вместе с успешными повторами; после «Забыл» повторы обнуляются — и уровень тоже */
export function levelFor(reps: number): DrillLevel {
  return reps <= 0 ? 1 : reps === 1 ? 2 : 3;
}

/** Оценка по отмеченным частям. «Легко» — только за полный ответ по памяти: с подсказками это не «легко». */
export function gradeFromRecall(recalled: number, total: number, level: DrillLevel): Grade {
  if (total <= 0) return 0;
  const share = recalled / total;
  if (level === 3) {
    if (share >= 1) return 3;
    if (share >= 0.75) return 2;
    return share >= 0.4 ? 1 : 0;
  }
  if (share >= 1) return 2;
  return share >= 0.5 ? 1 : 0;
}

const MATH = /\\\$|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** ИИ имел право только расставить ** — текст и формулы должны остаться теми же */
export function onlyBoldAdded(original: string, marked: string) {
  if (squash(original.replaceAll("**", "")) !== squash(marked.replaceAll("**", ""))) return false;
  return JSON.stringify(original.match(MATH) ?? []) === JSON.stringify(marked.match(MATH) ?? []);
}
