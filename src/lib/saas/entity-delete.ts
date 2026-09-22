/**
 * Delete one selling entity, or decide archive vs hard delete.
 * A sibling entity is never removed. A venue cannot drop to zero sellers
 * unless the whole venue is archived.
 */

export type EntityLifecycle = "onboarding" | "training" | "never_live" | "live" | "scheduled_live";

export type SellingEntitySnap = {
  id: string;
  name: string;
  lifecycle: EntityLifecycle | string;
  hasCardHistory: boolean;
  archived: boolean;
};

export type VenueEntitySnap = {
  archived: boolean;
  entities: SellingEntitySnap[];
};

export type EntityDeleteMode = "hard" | "archive";

export function entityDeleteMode(entity: {
  lifecycle?: string | null;
  hasCardHistory?: boolean;
}): EntityDeleteMode {
  const life = String(entity.lifecycle ?? "training").toLowerCase();
  if (entity.hasCardHistory) return "archive";
  if (life === "live" || life === "scheduled_live") return "archive";
  return "hard";
}

export function namesMatch(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.trim().toLowerCase() && typed.trim().length > 0;
}

export function activeEntities(venue: VenueEntitySnap): SellingEntitySnap[] {
  return venue.entities.filter((e) => !e.archived);
}

/** Hidden from POS. Ledger rows stay. */
export function visibleToPos(venue: VenueEntitySnap): SellingEntitySnap[] {
  if (venue.archived) return [];
  return activeEntities(venue);
}

export function canEntitySignIn(venue: VenueEntitySnap, entityId: string): boolean {
  if (venue.archived) return false;
  const e = venue.entities.find((x) => x.id === entityId);
  return Boolean(e && !e.archived);
}

/** Drop one seller’s menu lines and recipes. Sibling items stay. */
export function stripEntityCatalog(
  setup: Record<string, unknown>,
  operatorId: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...setup };
  const cat = next.menuCatalog;
  if (cat && typeof cat === "object" && !Array.isArray(cat)) {
    const c = cat as Record<string, unknown>;
    const items = Array.isArray(c.items) ? c.items : [];
    next.menuCatalog = {
      ...c,
      items: items.filter((it) => {
        if (!it || typeof it !== "object") return true;
        const row = it as Record<string, unknown>;
        const owner = String(row.vendorId || row.operatorId || "");
        return owner !== operatorId;
      }),
    };
  }
  if (Array.isArray(next.recipes)) {
    next.recipes = next.recipes.filter((r) => {
      if (!r || typeof r !== "object") return true;
      return String((r as Record<string, unknown>).entityId || "") !== operatorId;
    });
  }
  return next;
}

export function deleteSellingEntity(
  venue: VenueEntitySnap,
  entityId: string,
  typedName: string,
):
  | { ok: true; mode: EntityDeleteMode; venue: VenueEntitySnap }
  | { ok: false; error: string } {
  const entity = venue.entities.find((e) => e.id === entityId);
  if (!entity) return { ok: false, error: "Selling entity not found" };
  if (entity.archived) return { ok: false, error: "Already archived" };
  if (!namesMatch(typedName, entity.name)) {
    return { ok: false, error: "Type the entity name to confirm" };
  }
  const others = activeEntities(venue).filter((e) => e.id !== entityId);
  if (others.length === 0 && !venue.archived) {
    return {
      ok: false,
      error: "Archive the whole venue before removing the last selling entity",
    };
  }
  const mode = entityDeleteMode(entity);
  if (mode === "archive") {
    return {
      ok: true,
      mode,
      venue: {
        ...venue,
        entities: venue.entities.map((e) => (e.id === entityId ? { ...e, archived: true } : e)),
      },
    };
  }
  return {
    ok: true,
    mode,
    venue: {
      ...venue,
      entities: venue.entities.filter((e) => e.id !== entityId),
    },
  };
}
