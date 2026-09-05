/** Postgres SQLSTATE helpers. Keep this file import-safe for tests. */

export function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code?: unknown }).code ?? "");
  }
  return "";
}

export function pgErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 25P02 — a prior statement failed and nobody ROLLBACKed. */
export function isAbortedTransactionError(err: unknown): boolean {
  if (pgErrorCode(err) === "25P02") return true;
  return /transaction is aborted|commands ignored until end of transaction/i.test(
    pgErrorMessage(err),
  );
}

/** Missing table (42P01) or column (42703). */
export function isMissingRelationError(err: unknown): boolean {
  const code = pgErrorCode(err);
  if (code === "42P01" || code === "42703") return true;
  return /does not exist|undefined table|column .* does not exist/i.test(pgErrorMessage(err));
}

/** Prefer the first real SQL error over a follow-on 25P02. */
export function preferFirstSqlError(first: unknown, next: unknown): unknown {
  if (!first) return next;
  if (isAbortedTransactionError(next) && !isAbortedTransactionError(first)) return first;
  return next;
}
