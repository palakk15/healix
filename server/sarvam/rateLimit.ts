export interface RateLimiter {
  check: (key: string) => { allowed: boolean; retryAfterSeconds: number };
}

export function createRateLimiter(maxPerWindow: number, windowMs = 60_000, now: () => number = () => Date.now()): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key) {
      const current = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= current) {
        hits.set(key, { count: 1, resetAt: current + windowMs });
        if (hits.size > 5000) for (const [stored, value] of hits) if (value.resetAt <= current) hits.delete(stored);
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (entry.count >= maxPerWindow) {
        return { allowed: false, retryAfterSeconds: Math.max(Math.ceil((entry.resetAt - current) / 1000), 1) };
      }
      entry.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
