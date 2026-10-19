/**
 * Supplier and liquor-store orders from an order tablet or the web.
 * A draft stays unsent. Print marks it sent. Send uses the supplier connector
 * when that supplier takes an order. A house liquor store is a pick list.
 */

import { canCost } from "./permissions.ts";
import { CONNECTORS } from "./connectors.ts";
import type { EmployeeRole } from "@/lib/pos/types";
import type { CostSku, CostSupplier, PurchaseOrder } from "./types.ts";

type Role = EmployeeRole;

export function mayCreateSupplierOrder(role: Role | null | undefined): boolean {
  if (!role) return false;
  return canCost({ role }, "po:create");
}

export function supplierVisibleToEntity(
  supplier: Pick<CostSupplier, "active" | "entityIds">,
  entityId: string | null,
): boolean {
  if (supplier.active === false) return false;
  if (!entityId || entityId === "host") return true;
  const ids = supplier.entityIds ?? [];
  if (!ids.length) return true;
  return ids.includes(entityId) || ids.includes("host");
}

/** The selling entity that owns this order. A scoped person cannot leave their entity. */
export function supplierOrderEntityId(opts: {
  actorEntity: string | null;
  requestedEntityId?: string | null;
  supplierEntityIds?: string[];
  stationOperatorId?: string | null;
}): string {
  const actor = opts.actorEntity?.trim() || "";
  const requested = opts.requestedEntityId?.trim() || "";
  if (actor && actor !== "host") return actor;
  if (requested && requested !== "host") return requested;
  const station = opts.stationOperatorId?.trim() || "";
  if (station && station !== "host") return station;
  const ids = (opts.supplierEntityIds ?? []).map((id) => id.trim()).filter((id) => id && id !== "host");
  if (ids.length === 1) return ids[0]!;
  return "host";
}

const DRINK = new Set(["liquor", "beer", "wine"]);

export function catalogForSupplier(
  skus: CostSku[],
  supplier: Pick<CostSupplier, "id" | "houseStore" | "olccStoreNumber" | "beverage" | "kind">,
  entityId: string | null,
): CostSku[] {
  const drinks = supplier.houseStore || supplier.olccStoreNumber
    ? new Set(["liquor"])
    : supplier.beverage === "spirits"
      ? new Set(["liquor"])
      : supplier.beverage === "beer"
        ? new Set(["beer"])
        : supplier.beverage === "wine"
          ? new Set(["wine"])
          : supplier.kind === "beverage"
            ? DRINK
            : null;
  return skus.filter((sku) => {
    if (
      entityId &&
      entityId !== "host" &&
      sku.entityId !== entityId &&
      sku.entityId !== "host"
    ) {
      return false;
    }
    if (sku.supplierId === supplier.id) return true;
    return Boolean(drinks?.has(sku.category));
  });
}

export function catalogSizeLabel(
  sku: Pick<CostSku, "packLabel" | "unit" | "packSize">,
): string {
  const label = sku.packLabel?.trim() || "";
  if (sku.packSize > 1 && label) return `${sku.packSize} ${label}`;
  if (label && label !== "ea") return label;
  return sku.unit || label || "each";
}

export function supplierOrderPlacement(opts: {
  mode: "draft" | "print" | "send";
  pickList: boolean;
}):
  | { ok: true; status: "draft" | "sent"; send: boolean; detail: string }
  | { ok: false; error: string } {
  if (opts.mode === "send" && opts.pickList) {
    return { ok: false, error: "No order is sent to the house liquor store." };
  }
  if (opts.mode === "draft") {
    return { ok: true, status: "draft", send: false, detail: "Saved as a draft." };
  }
  if (opts.pickList) {
    return {
      ok: true,
      status: "sent",
      send: false,
      detail: "Pick list printed. No order is sent.",
    };
  }
  if (opts.mode === "send") {
    return { ok: true, status: "sent", send: true, detail: "Sent to the supplier." };
  }
  return {
    ok: true,
    status: "sent",
    send: false,
    detail: "Printed. Nothing is received until the invoice is matched.",
  };
}

export function dispatchSupplierSend(
  po: PurchaseOrder,
  supplier: Pick<CostSupplier, "connectorId" | "orderMethod" | "contacts">,
): { detail: string; csv?: string; method: string } {
  const conn = CONNECTORS[supplier.connectorId ?? "email_csv"];
  const email = supplier.contacts[0]?.email;
  const result = conn.send(po, email);
  return {
    detail: result.detail,
    csv: result.csv,
    method: supplier.orderMethod ?? result.method,
  };
}
