import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  catalogForSupplier,
  catalogSizeLabel,
  mayCreateSupplierOrder,
  supplierOrderEntityId,
  supplierOrderPlacement,
} from "../src/lib/costs/supplier-order.ts";
import type { CostSku } from "../src/lib/costs/types.ts";
import { stationMenuItems } from "../src/lib/pos/station-menu.ts";

function sku(partial: Partial<CostSku> & Pick<CostSku, "id" | "name" | "category">): CostSku {
  return {
    entityId: "bar",
    unit: "bottle",
    packSize: 1,
    packLabel: "750ml",
    onHand: 2,
    par: 0,
    parMin: 0,
    parMax: 0,
    costCents: 1899,
    leadDays: 1,
    ...partial,
  };
}

test("catalog, entity, and placement for a liquor order", () => {
  const rows = [
    sku({ id: "vodka", name: "Well Vodka", category: "liquor", supplierId: "other" }),
    sku({ id: "flour", name: "Flour", category: "food", supplierId: "food", entityId: "kitchen" }),
    sku({ id: "house_sku", name: "House Bourbon", category: "liquor", supplierId: "olcc", entityId: "host" }),
  ];
  const liquor = catalogForSupplier(
    rows,
    { id: "olcc", houseStore: true, kind: "beverage", beverage: "spirits" },
    "bar",
  );
  assert.deepEqual(
    liquor.map((row) => row.id),
    ["vodka", "house_sku"],
  );
  assert.equal(catalogSizeLabel(rows[0]!), "750ml");

  assert.equal(supplierOrderEntityId({ actorEntity: "bar", requestedEntityId: "kitchen" }), "bar");
  assert.equal(
    supplierOrderEntityId({ actorEntity: null, requestedEntityId: "kitchen", stationOperatorId: "bar" }),
    "kitchen",
  );
  assert.equal(
    supplierOrderEntityId({ actorEntity: "host", requestedEntityId: "", stationOperatorId: "bar" }),
    "bar",
  );
  assert.equal(supplierOrderEntityId({ actorEntity: null, supplierEntityIds: ["only"] }), "only");
  assert.equal(supplierOrderEntityId({ actorEntity: null, supplierEntityIds: ["a", "b"] }), "host");

  const draft = supplierOrderPlacement({ mode: "draft", pickList: true });
  assert.equal(draft.ok, true);
  if (draft.ok) {
    assert.equal(draft.status, "draft");
    assert.equal(draft.send, false);
    assert.match(draft.detail, /draft/i);
  }
  const refused = supplierOrderPlacement({ mode: "send", pickList: true });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.error, /No order is sent/);
  const pick = supplierOrderPlacement({ mode: "print", pickList: true });
  assert.equal(pick.ok, true);
  if (pick.ok) {
    assert.equal(pick.status, "sent");
    assert.equal(pick.send, false);
    assert.match(pick.detail, /No order is sent/);
  }
  const printed = supplierOrderPlacement({ mode: "print", pickList: false });
  assert.equal(printed.ok, true);
  if (printed.ok) {
    assert.equal(printed.status, "sent");
    assert.equal(printed.send, false);
  }
  const sent = supplierOrderPlacement({ mode: "send", pickList: false });
  assert.equal(sent.ok, true);
  if (sent.ok) assert.equal(sent.send, true);

  assert.equal(mayCreateSupplierOrder("server"), false);
  assert.equal(mayCreateSupplierOrder("bartender"), false);
  assert.equal(mayCreateSupplierOrder("supervisor"), false);
  assert.equal(mayCreateSupplierOrder("manager"), true);
  assert.equal(mayCreateSupplierOrder("owner"), true);
  assert.equal(mayCreateSupplierOrder("vendor_operator"), true);
  assert.equal(mayCreateSupplierOrder(null), false);
});

test("order tablet menu shows Orders only for roles that can order", () => {
  const manager = stationMenuItems({
    deviceRole: "order",
    employeeRole: "manager",
    hasFloor: true,
    hasBarRail: true,
    canPayStation: true,
    giftEnabled: true,
    cashEnabled: true,
    hasPossession: false,
    serviceStyle: "full_service",
  });
  assert.ok(manager.some((item) => item.id === "supplier_orders" && item.label === "Orders"));
  assert.ok(manager.some((item) => item.id === "closeout"));
  assert.ok(manager.length <= 9);
  const ordersAt = manager.findIndex((item) => item.id === "supplier_orders");
  const closeAt = manager.findIndex((item) => item.id === "closeout");
  assert.ok(ordersAt >= 0 && closeAt > ordersAt);

  const server = stationMenuItems({
    deviceRole: "order",
    employeeRole: "server",
    hasFloor: true,
    hasBarRail: true,
    canPayStation: true,
    giftEnabled: true,
    serviceStyle: "full_service",
  });
  assert.equal(server.some((item) => item.id === "supplier_orders"), false);

  const host = stationMenuItems({
    deviceRole: "host",
    employeeRole: "manager",
    hasFloor: true,
  });
  assert.equal(host.some((item) => item.id === "supplier_orders"), false);
});

test("tablet and web order surfaces share draft, print, and history", () => {
  const view = readFileSync("src/components/pos/SuppliersView.tsx", "utf8");
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  const mode = readFileSync("src/components/pos/DeviceModeView.tsx", "utf8");
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  const purchasing = readFileSync("src/components/pos/PlatformViews.tsx", "utf8");
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  const store = readFileSync("src/lib/costs/store.ts", "utf8");
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  assert.match(view, /data-order-catalog/);
  assert.match(view, /data-order-draft/);
  assert.match(view, /data-order-send/);
  assert.match(view, /data-order-entity/);
  assert.match(view, /data-order-history/);
  assert.match(view, /data-supplier-orders/);
  assert.match(view, /Print pick list/);
  assert.match(view, /Save draft/);
  assert.match(menu, /supplier_orders/);
  assert.match(menu, /mayCreateSupplierOrder/);
  assert.match(mode, /job === "supplier_orders"/);
  assert.match(mode, /SupplierOrdersBoard/);
  assert.match(shell, /id: "purchasing", label: "Orders"/);
  assert.match(purchasing, /SupplierOrdersBoard/);
  assert.match(purchasing, /CostWorkspace initialTab="invoices"/);
  assert.match(venue, /tab === "orders"/);
  assert.match(venue, /SupplierOrdersBoard/);
  assert.match(dash, /\["orders", "Orders"\]/);
  const body = store.slice(
    store.indexOf("placeSupplierOrder: (supplierId"),
    store.indexOf("attachOrderInvoice: (poId"),
  );
  assert.match(body, /status: "sent"/);
  assert.match(body, /mode === "draft"|placement\.status === "draft"/);
  assert.match(body, /matchRequired: true/);
  assert.doesNotMatch(body, /CONNECTORS|sendPo\(/);
});
