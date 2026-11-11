/** Стартовый экран «Повторения»: колоды по предметам и сводка «На сегодня». Чистые функции — проверяются тестами. */

type Q = { subjectId: string; status: string; srsReps: number; srsDue: string | Date | null };
type S = { id: string; name: string; color: string; type: string; examDate: string | Date | null; selfStudy?: boolean };

export type Deck = {
  id: string;
  name: string;
  color: string;
  examDate: string | null;
  /** Пора повторить */
  due: number;
  /** Ни разу не открывались */
  fresh: number;
  learned: number;
  total: number;
};

const isDue = (d: string | Date | null, now: Date) => !d || new Date(d).getTime() <= now.getTime();

/**
 * Колоды: сначала те, где есть что повторить, потом с ближайшим экзаменом.
 * Предметы без вопросов возвращаются отдельно (только экзамены — им пора добавить билеты).
 */
export function buildDecks(subjects: S[], questions: Q[], now: Date) {
  const by = new Map<string, Deck>();
  for (const s of subjects) {
    by.set(s.id, {
      id: s.id,
      name: s.name,
      color: s.color,
      examDate: s.examDate ? new Date(s.examDate).toISOString() : null,
      due: 0,
      fresh: 0,
      learned: 0,
      total: 0,
    });
  }
  for (const q of questions) {
    const d = by.get(q.subjectId);
    if (!d) continue;
    d.total++;
    if (q.status === "LEARNED") d.learned++;
    if (q.srsReps === 0) d.fresh++;
    else if (isDue(q.srsDue, now)) d.due++;
  }
  const all = [...by.values()];
  const exam = (d: Deck) => (d.examDate ? new Date(d.examDate).getTime() : Infinity);
  const decks = all.filter((d) => d.total > 0).sort((a, b) => Number(b.due > 0) - Number(a.due > 0) || exam(a) - exam(b) || a.name.localeCompare(b.name, "ru"));
  const empty = all.filter((d) => {
    const s = subjects.find((x) => x.id === d.id);
    return d.total === 0 && s?.type === "EXAM" && !s.selfStudy;
  });
  return { decks, empty };
}

/** Сколько карточек в колоде «К повторению»: все, что пора повторить, + не больше `newLimit` новых */
export function todayCount(decks: Deck[], newLimit: number) {
  const due = decks.reduce((n, d) => n + d.due, 0);
  const fresh = Math.min(newLimit, decks.reduce((n, d) => n + d.fresh, 0));
  return { due, fresh, total: due + fresh, minutes: Math.max(1, Math.round((due + fresh) * 0.75)) };
}
