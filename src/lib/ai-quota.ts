import { consumeLimit } from "./rate-limit";

/** Сколько запросов к ИИ в сутки разрешено одному аккаунту (защита ключа, если зарегистрируется кто-то ещё) */
const DAILY = Number(process.env.AI_DAILY_LIMIT) || 600;

export async function aiQuota(userId: string) {
  const ok = await consumeLimit(`ai:${userId}`, DAILY, 24 * 60 * 60 * 1000);
  if (!ok) throw new Error(`Дневной лимит ИИ исчерпан (${DAILY} запросов в сутки) — завтра снова будет доступно`);
}
