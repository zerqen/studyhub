const windowMs = 60_000;
const maxAttempts = 8;
const hits = new Map<string, { n: number; reset: number }>();

export function consumeLoginAttempt(key: string) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= maxAttempts) return false;
  cur.n += 1;
  return true;
}
