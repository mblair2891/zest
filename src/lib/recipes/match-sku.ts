import type { CostSku } from "@/lib/costs/types";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function suggestSku(name: string, skus: CostSku[]): CostSku | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = skus.find((s) => norm(s.name) === n);
  if (exact) return exact;
  const contains = skus.find(
    (s) => n.includes(norm(s.name)) || norm(s.name).includes(n),
  );
  if (contains) return contains;
  const token = n.split(" ").find((t) => t.length >= 4);
  if (!token) return undefined;
  return skus.find((s) => norm(s.name).includes(token));
}
