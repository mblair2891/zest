type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory limiter. Returns true when the caller is over the cap. */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  cur.count += 1;
  return cur.count > max;
}

export function clientKey(request: Request, suffix: string): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${fwd || "local"}:${suffix}`;
}
