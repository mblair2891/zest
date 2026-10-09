import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildSupplierOrderLines,
  compareOrderToInvoice,
  orderPrintHtml,
  readInvoiceLines,
  receiveConfirmedLines,
} from "../src/lib/costs/order-match.ts";
import type { CostSku, PurchaseOrder } from "../src/lib/costs/types.ts";

function sku(partial: Pick<CostSku, "id" | "name" | "onHand" | "costCents">): CostSku {
  return {
    category: "beer",
    entityId: "host",
    unit: "case",
    packSize: 1,
    packLabel: "case",
    par: 0,
    parMin: 0,
    parMax: 0,
    leadDays: 2,
    ...partial,
  };
}

test("print marks the order sent and receives nothing until confirmed lines", () => {
  const built = buildSupplierOrderLines([
    { name: "Mirror Pond IPA", size: "1/2 bbl", qty: 4, expectedPriceCents: 12000 },
    { name: "Breakside Lager", size: "case", qty: 2, expectedPriceCents: 2800 },
    { name: "Pilsner", size: "case", qty: 1, expectedPriceCents: 1000 },
  ]);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.lines.every((line) => line.receivedQty === 0), true);

  const po: PurchaseOrder = {
    id: "po_test",
    supplierId: "sup_hop",
    supplierName: "Hop Co",
    entityId: "host",
    status: "sent",
    lines: built.lines,
    expectedDate: 0,
    createdAt: 0,
    createdById: "u",
    createdByName: "Pat",
    totalCents: built.totalCents,
    matchRequired: true,
    sentAt: 1,
  };
  const html = orderPrintHtml(po, "House");
  assert.match(html, /Mirror Pond IPA/);
  assert.match(html, /1\/2 bbl/);
  assert.match(html, /Breakside Lager/);
  assert.match(html, /Status: sent/);
  assert.match(html, /Nothing is received until the invoice is matched/);
  assert.equal(po.lines[0]?.receivedQty, 0);

  const pick = orderPrintHtml(
    { ...po, pickList: true, supplierName: "Heppner Liquor Store" },
    "House",
  );
  assert.match(pick, /pick list/i);
  assert.match(pick, /No order is sent/);
  assert.match(pick, /Status: sent/);
  assert.doesNotMatch(pick, /Queued email|mailto:/);

  const invoice = readInvoiceLines(`item,size,qty,price
Mirror Pond IPA,1/2 bbl,2,120.00
Breakside Lager,case,2,31.00
Pilsner,case,1,10.00
Stout,case,1,15.00
`);
  const match = compareOrderToInvoice(built.lines, invoice);
  const ipa = match.find((line) => line.item === "Mirror Pond IPA");
  const lager = match.find((line) => line.item === "Breakside Lager");
  const pils = match.find((line) => line.item === "Pilsner");
  const stout = match.find((line) => line.item === "Stout");
  assert.ok(ipa && ipa.flags.includes("short"));
  assert.ok(lager && lager.flags.includes("price"));
  assert.equal(lager?.orderPriceCents, 2800);
  assert.equal(lager?.invoicePriceCents, 3100);
  assert.ok(pils && pils.flags.includes("match"));
  assert.ok(stout && stout.flags.includes("extra"));

  const decided = match.map((line) =>
    line.item === "Breakside Lager" || line.item === "Stout"
      ? { ...line, decision: "reject" as const }
      : { ...line, decision: "confirm" as const },
  );
  const before = [
    sku({ id: "sku_ipa", name: "Mirror Pond IPA", onHand: 1, costCents: 10000 }),
    sku({ id: "sku_lager", name: "Breakside Lager", onHand: 5, costCents: 2800 }),
    sku({ id: "sku_pils", name: "Pilsner", onHand: 0, costCents: 900 }),
  ];
  const applied = receiveConfirmedLines(before, decided, {
    now: 1,
    makeSku: (line) => sku({ id: `new_${line.item}`, name: line.item, onHand: 0, costCents: 0 }),
  });
  const afterIpa = applied.skus.find((row) => row.id === "sku_ipa");
  const afterLager = applied.skus.find((row) => row.id === "sku_lager");
  const afterPils = applied.skus.find((row) => row.id === "sku_pils");
  assert.equal(afterIpa?.onHand, 3);
  assert.equal(afterIpa?.costCents, 12000);
  assert.equal(afterLager?.onHand, 5);
  assert.equal(afterLager?.costCents, 2800);
  assert.equal(afterPils?.onHand, 1);
  assert.equal(afterPils?.costCents, 1000);
  assert.equal(applied.skus.some((row) => row.name === "Stout"), false);
  assert.equal(applied.received.length, 2);
  assert.ok(applied.rejected.some((line) => line.item === "Breakside Lager"));
  assert.equal(before[1]?.onHand, 5);

  const view = readFileSync("src/components/pos/SuppliersView.tsx", "utf8");
  const store = readFileSync("src/lib/costs/store.ts", "utf8");
  const costs = readFileSync("src/components/pos/CostWorkspace.tsx", "utf8");
  assert.match(view, /data-order-item/);
  assert.match(view, /data-order-size/);
  assert.match(view, /data-order-qty/);
  assert.match(view, /data-order-price/);
  assert.match(view, /data-order-print/);
  assert.match(view, /data-order-invoice/);
  assert.match(view, /data-match-flag/);
  assert.match(view, /data-match-reject/);
  assert.match(view, /data-order-receive/);
  assert.match(view, /Print pick list/);
  const body = store.slice(
    store.indexOf("placeSupplierOrder: (supplierId"),
    store.indexOf("attachOrderInvoice: (poId"),
  );
  assert.match(body, /status: "sent"/);
  assert.match(body, /matchRequired: true/);
  assert.match(body, /pickList/);
  assert.doesNotMatch(body, /CONNECTORS|sendPo\(/);
  assert.match(store, /Nothing is received until the invoice is matched/);
  assert.match(costs, /!p\.matchRequired/);
});
