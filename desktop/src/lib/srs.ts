import type { QuestionDto } from "../../electron/types";

export const SRS_GRADES = [
  { grade: 1, label: "Снова", hint: "Не вспомнил", shortcut: "1", color: "text-urgent border-urgent/40 bg-urgent-soft" },
  { grade: 3, label: "Сложно", hint: "С подсказкой", shortcut: "2", color: "text-warning border-warning/40 bg-warning/10" },
  { grade: 4, label: "Хорошо", hint: "Уверенно", shortcut: "3", color: "text-accent border-accent/40 bg-accent-soft" },
  { grade: 5, label: "Легко", hint: "Мгновенно", shortcut: "4", color: "text-success border-success/40 bg-success/10" },
] as const;

export function isSrsDue(srsDue?: string | null, nowMs = Date.now()): boolean {
  if (!srsDue) return true;
  const ms = Date.parse(srsDue);
  return Number.isNaN(ms) || ms <= nowMs;
}

export function buildWeakestDeck(questions: QuestionDto[], subjectId?: string | null, limit = 15): QuestionDto[] {
  const pool = questions.filter((q) => !subjectId || q.subjectId === subjectId);
  return [...pool]
    .sort((a, b) => {
      const aUnlearned = a.srsReps === 0 || a.status !== "LEARNED" ? 0 : 1;
      const bUnlearned = b.srsReps === 0 || b.status !== "LEARNED" ? 0 : 1;
      if (aUnlearned !== bUnlearned) return aUnlearned - bUnlearned;
      if (b.srsLapses !== a.srsLapses) return b.srsLapses - a.srsLapses;
      if (a.srsEase !== b.srsEase) return a.srsEase - b.srsEase;
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, limit);
}

export function buildExamTicket(questions: QuestionDto[], subjectId?: string | null): QuestionDto[] {
  const pool = questions.filter((q) => !subjectId || q.subjectId === subjectId);
  const theory = pool.filter((q) => q.kind !== "PROBLEM");
  const problems = pool.filter((q) => q.kind === "PROBLEM");
  const pick = <T,>(arr: T[], count: number): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };
  if (theory.length >= 2 && problems.length >= 1) {
    return [...pick(theory, 2), ...pick(problems, 1)];
  }
  return pick(pool, Math.min(3, pool.length));
}
