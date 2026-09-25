/**
 * Best-effort, per-instance limiters for public endpoints.
 * Serverless instances do not share memory, so these only blunt bursts from one client.
 */
interface LimiterOptions {
  limit: number;
  windowMs: number;
}

export type Limiter = (key: string, now?: number) => boolean;

export function createLimiter({ limit, windowMs }: LimiterOptions): Limiter {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
    return true;
  };
}

const TEN_MINUTES = 10 * 60 * 1000;

/** Lead and enquiry forms. */
export const allowRequest = createLimiter({ limit: 6, windowMs: TEN_MINUTES });

/** Log in, sign up, verification and password reset attempts. */
export const allowAuthAttempt = createLimiter({ limit: 10, windowMs: TEN_MINUTES });

/** Free tools that call other servers (website check, domain check). */
export const allowToolRun = createLimiter({ limit: 20, windowMs: TEN_MINUTES });
