/** Production-line labels on an order printer. Not extra printer types. */

export const ORDER_DESTINATION_PRESETS = [
  "Kitchen",
  "Bar",
  "Expo",
  "Window",
  "Prep",
  "Salad",
  "Pizza",
  "Dessert",
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

/** ODS rail for a production line. Dessert/Salad/Pizza/Window/Prep stay on kitchen ODS. */
export function ticketStationForDestination(
  dest: string | null | undefined,
): "kitchen" | "bar" | "expo" {
  const key = normalizeDestinationName(dest).toLowerCase();
  if (key === "bar") return "bar";
  if (key === "expo") return "expo";
  return "kitchen";
}

const DRINK_GROUP = /\b(cocktail|cocktails|beer|wine|drink|drinks|beverage|beverages|spirit|spirits|liquor|bar|na|n\/a|non-?alc)\b/i;

/** Food groups → Kitchen. Drink-named or bar-station groups → Bar. */
export function defaultDestinationForGroup(group: {
  name?: string | null;
  station?: string | null;
}): string {
  const st = String(group.station ?? "").toLowerCase();
  if (st === "bar") return "Bar";
  if (st === "expo") return "Expo";
  if (DRINK_GROUP.test(String(group.name ?? ""))) return "Bar";
  return DEFAULT_ORDER_DESTINATION;
}

export function destinationForGroup(
  group:
    | {
        name?: string | null;
        station?: string | null;
        destinationName?: string | null;
      }
    | null
    | undefined,
  fallbackStation?: string | null,
): string {
  const named = normalizeDestinationName(group?.destinationName);
  if (named) return named;
  if (group) return defaultDestinationForGroup(group);
  if (fallbackStation === "bar") return "Bar";
  if (fallbackStation === "expo") return "Expo";
  return DEFAULT_ORDER_DESTINATION;
}
