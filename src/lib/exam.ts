/**
 * Пробный экзамен: сборка билета, «вопросы препода» и оценка.
 * Чистые функции — без базы, чтобы их можно было проверить тестами.
 */

export type ExamPoolQuestion = {
  id: string;
  kind: string; // THEORY | PROBLEM
  ticketNo: number | null;
  lectureId: string | null;
  tags: string[];
  status: string;
  difficulty: string;
  srsLapses: number;
};

export type ExamConfig = {
  theory: number;
  problems: number;
  extra: number;
  /** null — собрать случайный билет; 0 — случайный из реальных; N — билет №N */
  ticketNo: number | null;
  /** Чаще брать слабые вопросы */
  weak: boolean;
};

export type PickedItem = { questionId: string; role: "THEORY" | "PROBLEM" | "EXTRA"; related: boolean };

export const EXAM_GRADES = [
  { grade: 0, label: "Не смог", short: "0" },
  { grade: 1, label: "С трудом", short: "1" },
  { grade: 2, label: "Хорошо", short: "2" },
  { grade: 3, label: "Отлично", short: "3" },
] as const;

type Rng = () => number;

/** Вес вопроса: при «упоре на слабые» забытые и сложные выпадают чаще */
function weight(q: ExamPoolQuestion, weak: boolean) {
  if (!weak) return 1;
  let w = 1;
  if (q.status === "REVIEW") w += 2;
  if (q.status === "UNLEARNED" || q.status === "IN_PROGRESS") w += 1;
  if (q.difficulty === "HARD") w += 1;
  w += Math.min(q.srsLapses, 4) * 0.75;
  if (q.status === "LEARNED") w *= 0.5;
  return w;
}

/** Случайная выборка без повторов с весами */
export function weightedSample<T>(items: T[], n: number, w: (item: T) => number, rng: Rng = Math.random): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0.0001, w(item)) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool[i].item);
    pool.splice(i, 1);
  }
  return out;
}

export function ticketNumbers(pool: { ticketNo: number | null }[]) {
  return [...new Set(pool.map((q) => q.ticketNo).filter((n): n is number => n !== null))].sort((a, b) => a - b);
}

/** Собирает билет и дополнительные вопросы */
export function buildExam(pool: ExamPoolQuestion[], config: ExamConfig, rng: Rng = Math.random): { ticketNo: number | null; items: PickedItem[] } {
  const w = (q: ExamPoolQuestion) => weight(q, config.weak);
  let ticketNo: number | null = null;
  let theory: ExamPoolQuestion[];
  let problems: ExamPoolQuestion[];

  const numbers = ticketNumbers(pool);
  if (config.ticketNo !== null && numbers.length) {
    ticketNo = config.ticketNo && numbers.includes(config.ticketNo) ? config.ticketNo : numbers[Math.floor(rng() * numbers.length)];
    const inTicket = pool.filter((q) => q.ticketNo === ticketNo);
    theory = inTicket.filter((q) => q.kind !== "PROBLEM");
    problems = inTicket.filter((q) => q.kind === "PROBLEM");
    // В реальном билете нет задач — добираем случайные, как на экзамене
    if (!problems.length && config.problems) {
      problems = weightedSample(pool.filter((q) => q.kind === "PROBLEM"), config.problems, w, rng);
    }
  } else {
    theory = weightedSample(pool.filter((q) => q.kind !== "PROBLEM"), config.theory, w, rng);
    problems = weightedSample(pool.filter((q) => q.kind === "PROBLEM"), config.problems, w, rng);
  }

  const used = new Set([...theory, ...problems].map((q) => q.id));
  const lectures = new Set([...theory, ...problems].map((q) => q.lectureId).filter(Boolean));
  const tags = new Set([...theory, ...problems].flatMap((q) => q.tags));
  const rest = pool.filter((q) => !used.has(q.id) && q.kind !== "PROBLEM");
  const isRelated = (q: ExamPoolQuestion) => (q.lectureId !== null && lectures.has(q.lectureId)) || q.tags.some((t) => tags.has(t));

  // Препод спрашивает примерно наполовину по билету, наполовину по всему курсу
  const relatedPool = rest.filter(isRelated);
  const wantRelated = Math.min(relatedPool.length, Math.ceil(config.extra / 2));
  const related = weightedSample(relatedPool, wantRelated, w, rng);
  const relatedIds = new Set(related.map((q) => q.id));
  const other = weightedSample(
    rest.filter((q) => !relatedIds.has(q.id)),
    config.extra - related.length,
    w,
    rng,
  );
  const extras = shuffle([...related, ...other], rng);

  return {
    ticketNo,
    items: [
      ...theory.map((q) => ({ questionId: q.id, role: "THEORY" as const, related: false })),
      ...problems.map((q) => ({ questionId: q.id, role: "PROBLEM" as const, related: false })),
      ...extras.map((q) => ({ questionId: q.id, role: "EXTRA" as const, related: relatedIds.has(q.id) || isRelated(q) })),
    ],
  };
}

function shuffle<T>(items: T[], rng: Rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type ScoredItem = { role: string; grade: number | null };

/**
 * Оценка 2–5. Билет весит 70%, вопросы препода — 30%.
 * Если по билету почти ничего не ответил (больше половины пунктов — «не смог»), выше двойки не будет:
 * дополнительными вопросами пустой билет не вытянуть.
 */
export function examScore(items: ScoredItem[]) {
  const ticket = items.filter((i) => i.role !== "EXTRA");
  const extra = items.filter((i) => i.role === "EXTRA");
  const avg = (list: ScoredItem[]) => (list.length ? list.reduce((a, i) => a + (i.grade ?? 0), 0) / (list.length * 3) : null);
  const t = avg(ticket);
  const e = avg(extra);
  const theory = avg(ticket.filter((i) => i.role === "THEORY"));
  const problems = avg(ticket.filter((i) => i.role === "PROBLEM"));
  const score = t === null ? (e ?? 0) : e === null ? t : 0.7 * t + 0.3 * e;
  const failedTicket = ticket.length > 0 && ticket.filter((i) => (i.grade ?? 0) === 0).length > ticket.length / 2;
  let grade = score >= 0.85 ? 5 : score >= 0.62 ? 4 : score >= 0.33 ? 3 : 2;
  if (failedTicket) grade = 2;
  return { score: Math.round(score * 1000) / 1000, grade, ticket: t, extra: e, theory, problems };
}

export function gradeLabel(grade: number | null | undefined) {
  if (grade === 5) return "отлично";
  if (grade === 4) return "хорошо";
  if (grade === 3) return "удовлетворительно";
  if (grade === 2) return "неудовлетворительно";
  return "—";
}
