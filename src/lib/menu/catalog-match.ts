/** Match a new menu draft to this entity’s live items, and decide delete vs archive. */

const SIZE_WORDS =
  /\b(?:\d+(?:\.\d+)?\s*(?:oz|ounce|ounces|ml|cl|l)|small|medium|large|pint|shot|tall|rocks|double|single|glass|bottle|can|oz|ounce|ounces|ml)\b/gi;

export type MenuMatchChoice = "replace" | "amend" | "keep";

export type MenuMatchRow = { name: string; group: string };

export type MenuMatchLive = {
  id: string;
  name: string;
  group: string;
  vendorId?: string;
};

export function normalizeMenuText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(SIZE_WORDS, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same entity, same group, same name after case, punctuation, and size words are ignored. */
export function findMenuMatch(
  row: MenuMatchRow,
  live: readonly MenuMatchLive[],
  entityId: string,
): MenuMatchLive | null {
  const name = normalizeMenuText(row.name);
  const group = normalizeMenuText(row.group);
  if (!name) return null;
  for (const item of live) {
    if (item.vendorId && item.vendorId !== entityId) continue;
    if (normalizeMenuText(item.name) !== name) continue;
    if (normalizeMenuText(item.group) !== group) continue;
    return item;
  }
  return null;
}

export function clearUnmatchedDrafts<T extends MenuMatchRow>(
  rows: readonly T[],
  live: readonly MenuMatchLive[],
  entityId: string,
): T[] {
  return rows.filter((row) => findMenuMatch(row, live, entityId));
}

export type MenuMatchFields = {
  name: string;
  description: string;
  priceCents: number;
  modifiers: string[];
};

/** Replace overwrites. Amend folds the new description, modifiers, and price into the existing item. */
export function mergeMenuMatch(
  choice: "replace" | "amend",
  existing: MenuMatchFields,
  draft: { name: string; description?: string; priceCents: number | null; modifiers: string[] },
): MenuMatchFields {
  const draftName = draft.name.trim() || existing.name;
  const draftDesc = (draft.description ?? "").trim();
  const existingDesc = existing.description.trim();
  const price = draft.priceCents != null && draft.priceCents > 0 ? draft.priceCents : existing.priceCents;
  if (choice === "replace") {
    return {
      name: draftName,
      description: draftDesc,
      priceCents: price,
      modifiers: draft.modifiers.map((name) => name.trim()).filter(Boolean),
    };
  }
  let description = existingDesc;
  if (draftDesc && !existingDesc) description = draftDesc;
  else if (draftDesc && existingDesc && !existingDesc.toLowerCase().includes(draftDesc.toLowerCase())) {
    description = `${existingDesc} ${draftDesc}`.trim();
  }
  const seen = new Set(existing.modifiers.map((name) => name.toLowerCase()));
  const modifiers = [...existing.modifiers];
  for (const name of draft.modifiers) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    modifiers.push(trimmed);
  }
  return { name: existing.name || draftName, description, priceCents: price, modifiers };
}

type HistoryOrder = { lines?: readonly { menuItemId?: string }[] };
type HistoryTicket = { items?: readonly { menuItemId?: string; lineId?: string }[] };

/** Any sale, comp, or void recorded against this item id. */
export function itemHasHistory(
  itemId: string,
  orders: readonly HistoryOrder[],
  tickets: readonly HistoryTicket[] = [],
): boolean {
  for (const order of orders) {
    for (const line of order.lines ?? []) {
      if (line.menuItemId === itemId) return true;
    }
  }
  for (const ticket of tickets) {
    for (const item of ticket.items ?? []) {
      if (item.menuItemId === itemId) return true;
    }
  }
  return false;
}

export function canHardDelete(
  itemId: string,
  orders: readonly HistoryOrder[],
  tickets: readonly HistoryTicket[] = [],
): boolean {
  return !itemHasHistory(itemId, orders, tickets);
}

export const DELETE_ITEM_CONFIRM = "Delete this item? It has no sales, so it will leave the catalog.";
