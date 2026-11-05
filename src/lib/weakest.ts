import { isDue } from "./srs";

export type WeakCandidate = {
  answer: string | null;
  kind?: string | null;
  status: string;
  difficulty: string;
  srsDue: Date | string | null;
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsLapses: number;
};

/** Столько карточек успевается за 10 минут, если на каждую уходит около 30 секунд */
export const TEN_MINUTES_DECK = 20;

/** Чем больше, тем слабее вопрос: забывался, просрочен, ни разу не повторялся или держится на коротком интервале */
export function weakness(q: WeakCandidate, now = new Date()) {
  let score = q.srsLapses * 3 + Math.max(0, 2.5 - q.srsEase) * 2;
  if (q.status === "REVIEW") score += 4;
  if (q.srsReps === 0) score += 3;
  if (isDue(q.srsDue, now)) score += 2;
  if (q.difficulty === "HARD") score += 0.5;
  // Чем длиннее интервал, тем увереннее вопрос выучен
  return score - Math.min(q.srsInterval, 60) / 10;
}

/** Самые слабые вопросы для короткой тренировки. Задачи за 30 секунд не решить, а без ответа нечем себя проверить. */
export function pickWeakest<T extends WeakCandidate>(questions: T[], limit = TEN_MINUTES_DECK, now = new Date()): T[] {
  return questions
    .filter((q) => q.kind !== "PROBLEM" && q.answer?.trim())
    .map((q, order) => ({ q, order, score: weakness(q, now) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.q);
}
