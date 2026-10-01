import { create } from "zustand";
import { emptyBook } from "./engine";
import { writeEntity } from "./engine";
import type { EntityBook } from "./types";

type FinanceState = {
  byEntity: Record<string, EntityBook>;
  live: boolean;
  hydrate: (books: Record<string, EntityBook> | undefined, live: boolean) => void;
  setLive: (live: boolean) => void;
  ensure: (entityId: string, locationId?: string) => EntityBook;
  commit: (
    entityId: string,
    actorEntityId: string | null,
    next: EntityBook,
  ) => { ok: boolean; error?: string };
  resetEntity: (entityId: string) => void;
};

function persistFinance(): void {
  void import("@/lib/pos/persist-location-setup").then((mod) => mod.persistLocationCatalog("finance"));
}

export const useFinanceStore = create<FinanceState>()((set, get) => ({
  byEntity: {},
  live: false,
  hydrate: (books, live) => {
    if (!books || typeof books !== "object") {
      set({ live });
      return;
    }
    set({ byEntity: books, live });
  },
  setLive: (live) => set({ live }),
  ensure: (entityId, locationId) => {
    const found = get().byEntity[entityId];
    if (found) return found;
    const book = emptyBook(entityId, locationId || "");
    set({ byEntity: { ...get().byEntity, [entityId]: book } });
    return book;
  },
  commit: (entityId, actorEntityId, next) => {
    const result = writeEntity(get().byEntity, entityId, actorEntityId, next);
    if (!result.ok) return { ok: false, error: result.error };
    set({ byEntity: result.map });
    persistFinance();
    return { ok: true };
  },
  resetEntity: (entityId) => {
    const current = get().byEntity[entityId];
    if (!current) return;
    set({
      byEntity: {
        ...get().byEntity,
        [entityId]: emptyBook(entityId, current.locationId),
      },
    });
    persistFinance();
  },
}));
