/**
 * Entity inventory check. Pure helpers so a node test can import this file
 * without the POS store or path aliases.
 */

export const MENU_LOW_AT = 2;

/** Roles that do not already open Inventory. The location grants these. */
export const INVENTORY_GRANT_ROLES = [
  "supervisor",
  "server",
  "bartender",
  "kitchen",
  "host",
  "cashier",
  "busser",
  "accountant",
] as const;

const ALWAYS_OPEN = new Set(["owner", "manager", "vendor_operator"]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type InventoryKind = "menu" | "ingredient";
export type InventoryMark = "zero" | "low" | "";
export type InventoryFilter = "all" | "menu" | "ingredient" | "low";
export type InventoryWhen = "counted" | "received" | "";

export interface InventoryMenuSource {
  id: string;
  name: string;
  vendorId?: string;
  archived?: boolean;
  stock?: number;
  lastCountedAt?: number;
}

export interface InventorySkuSource {
  id: string;
  name: string;
  entityId: string;
  unit: string;
  onHand: number;
  parMin: number;
  lastCountedAt?: number;
  lastReceivedAt?: number;
}

export interface InventoryRow {
  id: string;
  kind: InventoryKind;
  name: string;
  onHand: number;
  unit: string;
  lastAt: number | null;
  lastKind: InventoryWhen;
  mark: InventoryMark;
}

export function inventoryMark(
  kind: InventoryKind,
  onHand: number,
  parMin = 0,
): InventoryMark {
  if (onHand <= 0) return "zero";
  if (kind === "ingredient") {
    if (parMin > 0 && onHand <= parMin) return "low";
    return "";
  }
  if (onHand <= MENU_LOW_AT) return "low";
  return "";
}

export function formatInventoryDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function inventoryActivity(
  lastCountedAt?: number,
  lastReceivedAt?: number,
): { at: number | null; kind: InventoryWhen } {
  const counted = lastCountedAt && lastCountedAt > 0 ? lastCountedAt : 0;
  const received = lastReceivedAt && lastReceivedAt > 0 ? lastReceivedAt : 0;
  if (!counted && !received) return { at: null, kind: "" };
  if (counted >= received) return { at: counted, kind: "counted" };
  return { at: received, kind: "received" };
}

export function inventoryWhenLabel(
  lastCountedAt?: number,
  lastReceivedAt?: number,
): string {
  const act = inventoryActivity(lastCountedAt, lastReceivedAt);
  if (!act.at || !act.kind) return "—";
  const word = act.kind === "counted" ? "Counted" : "Received";
  return `${word} ${formatInventoryDate(act.at)}`;
}

export function formatOnHand(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function entityInventoryRows(
  entityId: string,
  items: readonly InventoryMenuSource[],
  skus: readonly InventorySkuSource[],
): InventoryRow[] {
  if (!entityId) return [];
  const menu: InventoryRow[] = items
    .filter((item) => item.vendorId === entityId && !item.archived)
    .map((item) => {
      const onHand = item.stock ?? 0;
      const act = inventoryActivity(item.lastCountedAt);
      return {
        id: item.id,
        kind: "menu" as const,
        name: item.name,
        onHand,
        unit: "each",
        lastAt: act.at,
        lastKind: act.kind,
        mark: inventoryMark("menu", onHand),
      };
    })
    .sort(byName);
  const ingredients: InventoryRow[] = skus
    .filter((sku) => sku.entityId === entityId)
    .map((sku) => {
      const act = inventoryActivity(sku.lastCountedAt, sku.lastReceivedAt);
      return {
        id: sku.id,
        kind: "ingredient" as const,
        name: sku.name,
        onHand: sku.onHand,
        unit: sku.unit || "each",
        lastAt: act.at,
        lastKind: act.kind,
        mark: inventoryMark("ingredient", sku.onHand, sku.parMin),
      };
    })
    .sort(byName);
  return [...menu, ...ingredients];
}

export function filterInventoryRows(
  rows: readonly InventoryRow[],
  query: string,
  filter: InventoryFilter,
): InventoryRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (filter === "menu") return row.kind === "menu";
    if (filter === "ingredient") return row.kind === "ingredient";
    if (filter === "low") return row.mark === "zero" || row.mark === "low";
    return true;
  });
}

export function canOpenEntityInventory(
  emp: { role?: string; extraViews?: readonly string[] } | null | undefined,
  grantedRoles: readonly string[] | undefined,
): boolean {
  if (!emp?.role) return false;
  if (ALWAYS_OPEN.has(emp.role)) return true;
  if (emp.extraViews?.includes("inventory")) return true;
  return (grantedRoles ?? []).includes(emp.role);
}
