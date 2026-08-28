import type { Table } from "./types";

/** Numeric part of a table label ("12", "T-5", "B3"). */
export function tableNumber(label: string): number {
  const m = String(label).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function displayLabel(t: Table): string {
  return t.originalLabel ?? t.label;
}

export function nativeSeats(t: Table): number {
  return t.originalSeats ?? t.seats;
}

export function groupRootId(tables: Table[], id: string): string {
  const t = tables.find((x) => x.id === id);
  if (!t) return id;
  return t.mergedIntoId ?? id;
}

export function groupMembers(tables: Table[], rootId: string): Table[] {
  const root = tables.find((t) => t.id === rootId);
  if (!root) return [];
  return tables.filter((t) => t.id === rootId || t.mergedIntoId === rootId);
}

export function pickLowestPrimary(members: Table[]): Table {
  return [...members].sort((a, b) => {
    const na = tableNumber(displayLabel(a));
    const nb = tableNumber(displayLabel(b));
    if (na !== nb) return na - nb;
    return displayLabel(a).localeCompare(displayLabel(b));
  })[0]!;
}

export function lowestGroupLabel(members: Table[]): string {
  const winner = pickLowestPrimary(members);
  const n = tableNumber(displayLabel(winner));
  if (!Number.isFinite(n) || n === Number.MAX_SAFE_INTEGER) return displayLabel(winner);
  return String(n);
}
