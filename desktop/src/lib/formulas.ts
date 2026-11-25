import type { LectureDto, QuestionDto } from "../../electron/types";

const TOKENS = /\\\$|```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
const RELATION = /=|<|>|\\(?:frac|int|sum|prod|lim|le|ge|leq|geq|ne|neq|to|Rightarrow|iff|approx|sim|sqrt|partial|nabla)\b/;
const normalize = (latex: string) => latex.replace(/\s+/g, "");

export interface FormulaEntry {
  title: string;
  formulas: string[];
}

export interface FormulaGroup {
  title: string;
  entries: FormulaEntry[];
}

export function extractFormulas(markdown?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of (markdown ?? "").matchAll(TOKENS)) {
    const token = m[0];
    if (!token.startsWith("$")) continue;
    const block = token.startsWith("$$");
    const latex = (block ? token.slice(2, -2) : token.slice(1, -1)).trim();
    if (!latex || (!block && !RELATION.test(latex))) continue;
    const key = normalize(latex);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(latex);
  }
  return out;
}

export function buildFormulaSheet(lectures: LectureDto[], questions: QuestionDto[]): FormulaGroup[] {
  const seen = new Set<string>();
  const fresh = (formulas: string[]) =>
    formulas.filter((f) => {
      const key = normalize(f);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const fromQuestions = (lectureMatchTitle: string | null): FormulaEntry[] =>
    questions
      .filter((q) => q.kind !== "PROBLEM" && (lectureMatchTitle == null ? !q.lectureTitle : q.lectureTitle === lectureMatchTitle))
      .map((q) => ({ title: q.text, formulas: fresh(extractFormulas(q.answer)) }))
      .filter((e) => e.formulas.length > 0);

  const ordered = [...lectures].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
  const groups: FormulaGroup[] = ordered.map((l) => {
    const lecKey = l.number != null ? `Лекция ${l.number}: ${l.title}` : l.title;
    const entries = fromQuestions(lecKey);
    const notes = fresh(extractFormulas(l.summary));
    if (notes.length) entries.push({ title: "Из конспекта", formulas: notes });
    return { title: `${l.number != null ? `Лекция ${l.number}. ` : ""}${l.title}`, entries };
  });

  groups.push({ title: "Без лекции", entries: fromQuestions(null) });
  return groups.filter((g) => g.entries.length > 0);
}
