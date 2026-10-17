/**
 * Интервальное повторение по мотивам SM-2 (как в Anki).
 * Оценка: 0 — забыл, 1 — трудно, 2 — хорошо, 3 — легко.
 */
export type Grade = 0 | 1 | 2 | 3;

export type SrsState = {
  interval: number; // дней до следующего повтора
  ease: number; // множитель интервала, 1.3…3.0
  reps: number; // успешных повторов подряд
  lapses: number; // сколько раз забывал
};

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 0, label: "Забыл", key: "1" },
  { grade: 1, label: "Трудно", key: "2" },
  { grade: 2, label: "Хорошо", key: "3" },
  { grade: 3, label: "Легко", key: "4" },
];

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const DAY = 86_400_000;

/** Сколько дней должен быть интервал, чтобы вопрос считался выученным */
export const LEARNED_INTERVAL = 7;

export function schedule(prev: SrsState, grade: Grade): SrsState {
  let { interval, ease } = prev;
  const { reps, lapses } = prev;

  if (grade === 0) {
    return { interval: 0, ease: Math.max(MIN_EASE, ease - 0.2), reps: 0, lapses: lapses + 1 };
  }

  if (grade === 1) ease = Math.max(MIN_EASE, ease - 0.15);
  if (grade === 3) ease = Math.min(MAX_EASE, ease + 0.15);

  if (reps === 0) interval = grade === 3 ? 3 : 1;
  else if (reps === 1) interval = grade === 1 ? 2 : grade === 2 ? 3 : 5;
  else {
    const mult = grade === 1 ? 1.2 : grade === 2 ? ease : ease * 1.3;
    interval = Math.max(interval + 1, Math.round(interval * mult));
  }

  return { interval: Math.min(interval, 365), ease: Math.round(ease * 100) / 100, reps: reps + 1, lapses };
}
/** Когда показать снова. «Забыл» — через 10 минут, остальное — в начале дня через N дней */
export function dueDate(state: SrsState, now = new Date()): Date {
  if (state.interval === 0) return new Date(now.getTime() + 10 * 60 * 1000);
  const d = new Date(now.getTime() + state.interval * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Статус вопроса, который видит пользователь */
export function statusFor(state: SrsState, grade: Grade) {
  if (grade === 0) return "REVIEW";
  return state.interval >= LEARNED_INTERVAL ? "LEARNED" : "IN_PROGRESS";
}

/** Подсказка на кнопке: через сколько вопрос вернётся */
export function previewLabel(prev: SrsState, grade: Grade) {
  const next = schedule(prev, grade);
  if (next.interval === 0) return "10 мин";
  if (next.interval < 30) return `${next.interval} дн.`;
  if (next.interval < 365) return `${Math.round(next.interval / 30)} мес.`;
  return "год";
}

export function isDue(srsDue: Date | string | null | undefined, now = new Date()) {
  return !srsDue || new Date(srsDue).getTime() <= now.getTime();
}
