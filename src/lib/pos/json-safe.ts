/**
 * A JSON value the station can parse. Shared objects are copied.
 * A cycle becomes null so one back-reference cannot drop the rest.
 */

const MAX_JSON_DEPTH = 100;

export function jsonSafe<T>(value: T): T {
  return cloneJson(value, new WeakSet(), 0) as T;
}

function cloneJson(value: unknown, stack: WeakSet<object>, depth: number): unknown {
  if (value === null) return null;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return value;
  if (kind === "number") return Number.isFinite(value as number) ? value : null;
  if (kind === "bigint") return String(value);
  if (kind === "undefined" || kind === "function" || kind === "symbol") return undefined;
  if (depth > MAX_JSON_DEPTH) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value.toISOString() : null;
  }
  if (value instanceof URL) return value.toString();
  if (typeof value !== "object") return null;
  if (stack.has(value)) return null;
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const next = cloneJson(item, stack, depth + 1);
        return next === undefined ? null : next;
      });
    }
    if (ArrayBuffer.isView(value)) {
      return Array.from(value as unknown as ArrayLike<number>);
    }
    if (value instanceof Map) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of value) {
        const next = cloneJson(item, stack, depth + 1);
        if (next !== undefined) out[String(key)] = next;
      }
      return out;
    }
    if (value instanceof Set) {
      return Array.from(value).map((item) => {
        const next = cloneJson(item, stack, depth + 1);
        return next === undefined ? null : next;
      });
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const next = cloneJson((value as Record<string, unknown>)[key], stack, depth + 1);
      if (next !== undefined) out[key] = next;
    }
    return out;
  } finally {
    stack.delete(value);
  }
}
