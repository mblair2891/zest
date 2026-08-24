import type { MenuItem } from "@/lib/pos/types";

export function scoreItemName(query: string, name: string): number {
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  if (!q || !n) return 0;
  if (n === q) return 1;
  if (n.includes(q) || q.includes(n)) return 0.85;
  const qw = q.split(/\s+/);
  const nw = n.split(/\s+/);
  const hit = qw.filter((w) => nw.some((x) => x.startsWith(w) || w.startsWith(x))).length;
  if (hit === 0) return 0;
  return hit / Math.max(qw.length, nw.length);
}

export function matchMenuItems(
  query: string | undefined,
  items: MenuItem[],
  limit = 3,
): { item: MenuItem; score: number }[] {
  if (!query) return [];
  return items
    .map((item) => ({ item, score: scoreItemName(query, item.name) }))
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
