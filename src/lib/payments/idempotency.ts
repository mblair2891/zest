/** UUID v4 stored for one payment attempt and sent again on retry. */
const FINIX_ATTEMPT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A stored attempt id.
 * Empty, the word null, and any non-UUID are ignored so the body never sends those.
 */
export function finixAttemptIdempotencyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.toLowerCase() === "null") return null;
  return FINIX_ATTEMPT_UUID.test(id) ? id : null;
}

export function mintFinixAttemptIdempotencyId(): string {
  return crypto.randomUUID();
}

/**
 * A processor decline can be tried again with a new id.
 * A lost response, a 5xx, or "already been used" keeps the id so the retry
 * returns the original transfer instead of creating another one.
 */
export function finixRetryKeepsIdempotencyId(status: number, detail: string): boolean {
  if (status === 0 || status >= 500) return true;
  return /already been used/i.test(detail);
}
