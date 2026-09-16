/** Production-line labels on an order printer. Not extra printer types. */

export const ORDER_DESTINATION_PRESETS = [
  "Kitchen",
  "Bar",
  "Expo",
  "Window",
  "Prep",
  "Other",
] as const;

export const DEFAULT_ORDER_DESTINATION = "Kitchen";

export type OrderDestinationPreset = (typeof ORDER_DESTINATION_PRESETS)[number];

export function normalizeDestinationName(raw: string | null | undefined): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function isPresetDestination(name: string): boolean {
  const key = normalizeDestinationName(name).toLowerCase();
  return ORDER_DESTINATION_PRESETS.some((p) => p.toLowerCase() === key);
}

/** Presets first, then venue custom names and names already on printers. Never drop Kitchen. */
export function mergeOrderDestinations(...lists: Array<readonly string[] | string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    const n = normalizeDestinationName(name);
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };
  for (const p of ORDER_DESTINATION_PRESETS) add(p);
  for (const list of lists) {
    for (const n of list ?? []) add(n);
  }
  return out;
}

export function parseOrderDestinations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return mergeOrderDestinations();
  return mergeOrderDestinations(raw.map((x) => String(x)));
}
