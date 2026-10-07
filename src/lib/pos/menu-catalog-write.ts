/**
 * Merge one selling entity’s menu rows into locations.setup.menuCatalog.
 * Other entities’ items and every non-menu setup key stay untouched.
 */

export type MenuCatalogItem = Record<string, unknown> & { id: string; vendorId?: string };

export type MenuCatalogWrite = {
  categories: unknown[];
  items: MenuCatalogItem[];
  modifiers: unknown[];
  wellBooks?: unknown;
};

export type MenuWriteAction = "create" | "update" | "delete" | "toggle";

function asCatalog(raw: unknown): MenuCatalogWrite {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    categories: Array.isArray(o.categories) ? o.categories : [],
    items: Array.isArray(o.items)
      ? o.items.filter((row): row is MenuCatalogItem => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return false;
          const id = (row as { id?: unknown }).id;
          return typeof id === "string" && id.length > 0;
        })
      : [],
    modifiers: Array.isArray(o.modifiers) ? o.modifiers : [],
    ...(o.wellBooks != null ? { wellBooks: o.wellBooks } : {}),
  };
}

function clipId(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 160);
}

function ownedBy(item: MenuCatalogItem, operatorId: string): boolean {
  const vendor = String(item.vendorId ?? "").trim();
  return vendor === operatorId;
}

/**
 * Writes only this operator’s item. A row that already belongs to someone else is refused.
 * Delete removes that id. Toggle sets `available`. Create and update upsert the row.
 */
export function applyEntityMenuWrite(
  catalogRaw: unknown,
  action: MenuWriteAction,
  operatorId: string,
  itemRaw: Record<string, unknown> | null | undefined,
): { ok: true; catalog: MenuCatalogWrite } | { ok: false; error: string } {
  const operator = operatorId.trim().slice(0, 80);
  if (!operator) return { ok: false, error: "Selling entity is required" };
  const catalog = asCatalog(catalogRaw);
  const id = clipId(itemRaw?.id);
  if (!id) return { ok: false, error: "Item is required" };
  const claimed = String(itemRaw?.vendorId ?? "").trim().slice(0, 80);
  if (claimed && claimed !== operator) {
    return { ok: false, error: "Not permitted for this operator" };
  }
  const index = catalog.items.findIndex((row) => row.id === id);
  const existing = index >= 0 ? catalog.items[index] : undefined;
  if (existing && !ownedBy(existing, operator)) {
    return { ok: false, error: "Not permitted for this operator" };
  }
  if (action === "delete") {
    if (index >= 0) catalog.items.splice(index, 1);
    return { ok: true, catalog };
  }
  if (action === "toggle") {
    if (!existing) return { ok: false, error: "Item is required" };
    const available = typeof itemRaw?.available === "boolean" ? itemRaw.available : existing.available === false;
    catalog.items[index] = { ...existing, available, vendorId: operator };
    return { ok: true, catalog };
  }
  const next: MenuCatalogItem = {
    ...(existing ?? {}),
    ...(itemRaw ?? {}),
    id,
    vendorId: operator,
  };
  if (index >= 0) catalog.items[index] = next;
  else catalog.items.push(next);
  return { ok: true, catalog };
}

/** Replace menuCatalog and leave payouts and every other setup key as they were. */
export function withMenuCatalog(
  setup: Record<string, unknown>,
  catalog: MenuCatalogWrite,
): Record<string, unknown> {
  return { ...setup, menuCatalog: catalog };
}
