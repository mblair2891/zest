/**
 * Live floor source: published tables win. An empty publish falls back to the
 * last saved draft so the map is never a blank pane when a layout exists.
 */
import type { FloorSection, Table } from "@/lib/pos/types";

export const FLOOR_DRAFT_KEY = "summex-floor-draft-v1";
export const FLOOR_DRAFT_BANNER = "Publish floor to lock layout.";

export type FloorDraft = {
  locationId: string;
  tables: Table[];
  sections: FloorSection[];
  at: number;
};

export function resolveLiveFloor<T extends { id: string }>(opts: {
  /** null = this publish did not include a floor. [] = published an empty floor. */
  publishedTables: T[] | null;
  draftTables: T[];
  currentTables: T[];
}): { tables: T[]; fromDraft: boolean } {
  if (opts.publishedTables && opts.publishedTables.length > 0) {
    return { tables: opts.publishedTables, fromDraft: false };
  }
  if (opts.publishedTables && opts.publishedTables.length === 0 && opts.draftTables.length > 0) {
    return { tables: opts.draftTables, fromDraft: true };
  }
  if (opts.currentTables.length > 0) {
    return { tables: opts.currentTables, fromDraft: false };
  }
  if (opts.draftTables.length > 0) {
    return { tables: opts.draftTables, fromDraft: true };
  }
  return { tables: [], fromDraft: false };
}

export function readFloorDraft(locationId: string): FloorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FLOOR_DRAFT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as FloorDraft;
    if (!o || !Array.isArray(o.tables) || o.tables.length === 0) return null;
    if (locationId && o.locationId && o.locationId !== locationId) return null;
    return {
      locationId: String(o.locationId || locationId),
      tables: o.tables,
      sections: Array.isArray(o.sections) ? o.sections : [],
      at: Number(o.at) || 0,
    };
  } catch {
    return null;
  }
}

const BANNER_KEY = "summex-floor-draft-banner";

export function setFloorDraftBanner(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BANNER_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function floorDraftBannerOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFloorDraft(
  locationId: string,
  tables: Table[],
  sections: FloorSection[],
): void {
  if (typeof window === "undefined" || !tables.length) return;
  try {
    const row: FloorDraft = {
      locationId,
      tables,
      sections,
      at: Date.now(),
    };
    localStorage.setItem(FLOOR_DRAFT_KEY, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}
