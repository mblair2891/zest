/**
 * Supplier records. Deactivate keeps the row. Invoices are a separate list and stay.
 * An OLCC house store is the spirits supplier. No order is sent to it.
 */

import type { OlccStore } from "./olcc-stores.ts";
import type {
  BeverageLine,
  CostSupplier,
  OrderMethod,
  SupplierKind,
} from "./types.ts";

export const HOUSE_STORE_NOTE =
  "House OLCC liquor store. Print the pick list. No order is sent. Upload the store receipt and confirm the lines that arrived.";

const BEVERAGE_LINES: BeverageLine[] = ["beer", "wine", "spirits"];

export type SupplierDraft = {
  name: string;
  kind: SupplierKind;
  beverage?: BeverageLine | "" | null;
  contactName?: string;
  phone?: string;
  email?: string;
  accountNumber?: string;
  orderMethod?: OrderMethod;
  notes?: string;
  entityIds?: string[];
};

export function supplierIsActive(supplier: Pick<CostSupplier, "active">): boolean {
  return supplier.active !== false;
}

/** House liquor stores are bought in person. Inactive suppliers are not ordered. */
export function supplierSendsOrder(supplier: CostSupplier): boolean {
  if (!supplierIsActive(supplier)) return false;
  if (supplier.houseStore || supplier.olccStoreNumber) return false;
  return true;
}

export function supplierTypeLabel(
  supplier: Pick<CostSupplier, "kind" | "beverage" | "category">,
): string {
  const category = supplier.category ?? "";
  const kind = supplier.kind ?? (/food/i.test(category) ? "food" : /beer|wine|spirit|liquor/i.test(category) ? "beverage" : undefined);
  if (kind === "food") return "Food";
  const line =
    supplier.beverage ??
    (/\bbeer\b/i.test(category) ? "beer" : /\bwine\b/i.test(category) ? "wine" : /\bspirit|liquor/i.test(category) ? "spirits" : undefined);
  if (line === "beer") return "Beverage · Beer";
  if (line === "wine") return "Beverage · Wine";
  if (line === "spirits") return "Beverage · Spirits";
  if (kind === "beverage") return "Beverage";
  return category || "Supplier";
}

export function buildSupplier(
  draft: SupplierDraft,
  id: string,
): { ok: true; supplier: CostSupplier } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (draft.kind !== "food" && draft.kind !== "beverage") {
    return { ok: false, error: "Choose food or beverage." };
  }
  let beverage: BeverageLine | undefined;
  if (draft.kind === "beverage") {
    const line = draft.beverage ?? "";
    if (!BEVERAGE_LINES.includes(line as BeverageLine)) {
      return { ok: false, error: "Choose beer, wine, or spirits." };
    }
    beverage = line as BeverageLine;
  }
  const contactName = draft.contactName?.trim() || "Orders";
  const email = draft.email?.trim() || "";
  const phone = draft.phone?.trim() || "";
  const orderMethod = draft.orderMethod ?? "email";
  const category =
    draft.kind === "food"
      ? "Food"
      : beverage === "beer"
        ? "Beer"
        : beverage === "wine"
          ? "Wine"
          : "Spirits";
  return {
    ok: true,
    supplier: {
      id,
      name,
      kind: draft.kind,
      beverage,
      contactName,
      phone,
      email,
      accountNumber: draft.accountNumber?.trim() ?? "",
      notes: draft.notes?.trim() ?? "",
      terms: "Net 14",
      entityIds: draft.entityIds ?? [],
      orderMethod,
      connectorId: orderMethod === "api" ? "api_stub" : "email_csv",
      category,
      minOrderCents: 0,
      leadDays: 2,
      active: true,
      contacts: [{ name: contactName, email, phone: phone || undefined }],
    },
  };
}

/** Sets active false. Does not take or change invoices. */
export function deactivateSupplier(suppliers: CostSupplier[], id: string): CostSupplier[] {
  return suppliers.map((supplier) =>
    supplier.id === id ? { ...supplier, active: false } : supplier,
  );
}

export function linkInvoiceToSupplier<T extends { id: string; supplierId?: string }>(
  invoices: T[],
  invoiceId: string,
  supplierId: string,
): T[] {
  return invoices.map((invoice) =>
    invoice.id === invoiceId ? { ...invoice, supplierId } : invoice,
  );
}

function withoutHousePick(supplier: CostSupplier): CostSupplier {
  if (!supplier.houseStore && supplier.houseStorePickedAt == null) return supplier;
  const next: CostSupplier = { ...supplier, houseStore: false };
  delete next.houseStorePickedAt;
  return next;
}

export function houseStoreSupplier(store: OlccStore, id: string, pickedAt = Date.now()): CostSupplier {
  const built = buildSupplier(
    {
      name: store.name,
      kind: "beverage",
      beverage: "spirits",
      contactName: "Store",
      phone: store.phone,
      accountNumber: store.storeNumber,
      orderMethod: "portal",
      notes: HOUSE_STORE_NOTE,
    },
    id,
  );
  if (!built.ok) throw new Error(built.error);
  return {
    ...built.supplier,
    address: store.address,
    olccStoreNumber: store.storeNumber,
    houseStore: true,
    houseStorePickedAt: pickedAt,
    active: true,
  };
}

/** One house store. A previous store stays on file so its invoices still name it. */
export function applyHouseStore(
  suppliers: CostSupplier[],
  store: OlccStore,
  newId: string,
  pickedAt = Date.now(),
): CostSupplier[] {
  let found = false;
  const next = suppliers.map((supplier) => {
    if (supplier.olccStoreNumber !== store.storeNumber) return withoutHousePick(supplier);
    found = true;
    return {
      ...supplier,
      name: store.name,
      phone: store.phone,
      address: store.address,
      kind: "beverage" as const,
      beverage: "spirits" as const,
      category: "Spirits",
      houseStore: true,
      houseStorePickedAt: pickedAt,
      active: true,
      notes: supplier.notes?.trim() ? supplier.notes : HOUSE_STORE_NOTE,
      contacts: [
        {
          name: supplier.contactName || supplier.contacts[0]?.name || "Store",
          email: supplier.email || supplier.contacts[0]?.email || "",
          phone: store.phone,
        },
      ],
    };
  });
  if (found) return next;
  return [houseStoreSupplier(store, newId, pickedAt), ...next.map(withoutHousePick)];
}

/**
 * After a refresh, the location catalog is the supplier list.
 * An empty catalog leaves the in-memory list, including a house store picked before the save returned.
 */
export function suppliersKeptAfterRefresh(
  saved: readonly CostSupplier[] | null | undefined,
  local: readonly CostSupplier[],
): CostSupplier[] {
  const pack = Array.isArray(saved) ? saved.map((row) => ({ ...row })) : [];
  return pack.length ? pack : [...local];
}
