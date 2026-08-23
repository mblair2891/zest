/**
 * Server env accessors that Vite cannot statically replace.
 *
 * `process.env.DATABASE_URL` (dot access) is inlined to `undefined` at build
 * when the var is missing from the Vite/Nitro compile env — production then
 * silently used PGLite and failed on Vercel. Always read via `process.env[key]`.
 */
export function readServerEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
] as const;

/** Neon / Postgres URL, or undefined when the preview PGLite fallback should run. */
export function getDatabaseUrl(): string | undefined {
  for (const key of DATABASE_URL_KEYS) {
    const value = readServerEnv(key);
    if (value) return value;
  }
  return undefined;
}

/** True on Vercel / Lambda — never open PGLite there. */
export function isServerlessRuntime(): boolean {
  return Boolean(
    readServerEnv("VERCEL") ||
      readServerEnv("AWS_LAMBDA_FUNCTION_NAME") ||
      readServerEnv("NETLIFY"),
  );
}
