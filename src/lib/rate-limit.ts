import { prisma } from "./prisma";

const windowMs = 60_000;
const maxAttempts = 8;
// Запасной вариант, если база недоступна: счётчик в памяти инстанса
const memory = new Map<string, { n: number; reset: number }>();

function consumeInMemory(key: string, max: number, window: number) {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.reset < now) {
    memory.set(key, { n: 1, reset: now + window });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

/**
 * Ограничение попыток входа. Хранится в базе, поэтому работает одинаково
 * на всех серверных инстансах Vercel (раньше счётчик жил в памяти и сбрасывался).
 */
export async function consumeLoginAttempt(key: string, max = maxAttempts, window = windowMs) {
  return consumeLimit(`login:${key}`, max, window);
}

/** Общий счётчик «не больше max раз за window мс» по ключу */
export async function consumeLimit(key: string, max: number, window: number) {
  const id = key.slice(0, 200);
  const now = new Date();
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key: id } });
    if (!row || row.resetAt < now) {
      await prisma.rateLimit.upsert({
        where: { key: id },
        create: { key: id, count: 1, resetAt: new Date(now.getTime() + window) },
        update: { count: 1, resetAt: new Date(now.getTime() + window) },
      });
      // изредка чистим старые записи
      if (Math.random() < 0.02) await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86_400_000) } } });
      return true;
    }
    if (row.count >= max) return false;
    await prisma.rateLimit.update({ where: { key: id }, data: { count: { increment: 1 } } });
    return true;
  } catch {
    return consumeInMemory(id, max, window);
  }
}
