/** Лист формул: всё, что записано LaTeX в ответах и конспектах предмета. Отдельно вносить ничего не нужно. */

const TOKENS = /\\\$|```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
// Формула в строке попадает в лист, только если это соотношение, а не обозначение вроде $x$
const RELATION = /=|<|>|\\(?:frac|int|sum|prod|lim|le|ge|leq|geq|ne|neq|to|Rightarrow|iff|approx|sim|sqrt|partial|nabla)\b/;

const normalize = (latex: string) => latex.replace(/\s+/g, "");

/** Формулы из Markdown в виде исходного LaTeX без долларов, без повторов */
export function extractFormulas(markdown: string | null | undefined): string[] {
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

export type FormulaEntry = { title: string; href: string; formulas: string[] };
export type FormulaGroup = { title: string; entries: FormulaEntry[] };

type LectureRef = { id: string; number: number | null; title: string; summary: string };
type QuestionRef = { id: string; text: string; answer: string | null; kind: string; lectureId: string | null };

/** Группы по лекциям. Формула из конспекта, которая уже есть в вопросе, второй раз не показывается. */
export function buildFormulaSheet(lectures: LectureRef[], questions: QuestionRef[]): FormulaGroup[] {
  const seen = new Set<string>();
  const fresh = (formulas: string[]) =>
    formulas.filter((f) => {
      const key = normalize(f);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const fromQuestions = (lectureId: string | null): FormulaEntry[] =>
    questions
      .filter((q) => q.kind !== "PROBLEM" && q.lectureId === lectureId)
      .map((q) => ({ title: q.text, href: `/questions/${q.id}`, formulas: fresh(extractFormulas(q.answer)) }))
      .filter((e) => e.formulas.length > 0);

  const groups: FormulaGroup[] = lectures.map((l) => {
    const entries = fromQuestions(l.id);
    const notes = fresh(extractFormulas(l.summary));
    if (notes.length) entries.push({ title: "Из конспекта", href: `/lectures/${l.id}`, formulas: notes });
    return { title: `${l.number ? `Лекция ${l.number}. ` : ""}${l.title}`, entries };
  });
  groups.push({ title: "Без лекции", entries: fromQuestions(null) });
  return groups.filter((g) => g.entries.length > 0);
}
