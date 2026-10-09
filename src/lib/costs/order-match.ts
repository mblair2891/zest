/**
 * Supplier order, print, and invoice match.
 * Printing marks the order sent. Inventory does not move until staff confirm a line.
 * A rejected line is not received. A house liquor store prints a pick list and is not sent an order.
 */

import type { CostSku, OrderMatchFlag, OrderMatchLine, PurchaseOrder, PurchaseOrderLine } from "./types.ts";

export type SupplierOrderDraft = {
  name: string;
  size: string;
  qty: number;
  expectedPriceCents: number;
  skuId?: string;
};

export type InvoiceReadLine = {
  name: string;
  size: string;
  qty: number;
  unitCostCents: number;
};

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;",
  );
}

function dollarsToCents(raw: string): number | null {
  const hit = raw.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!hit) return null;
  return Math.round(parseFloat(hit[1]!) * 100);
}

function splitCsv(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function buildSupplierOrderLines(
  drafts: SupplierOrderDraft[],
): { ok: true; lines: PurchaseOrderLine[]; totalCents: number } | { ok: false; error: string } {
  if (!drafts.length) return { ok: false, error: "Add at least one item." };
  const lines: PurchaseOrderLine[] = [];
  for (const draft of drafts) {
    const name = draft.name.trim();
    const size = draft.size.trim();
    if (!name) return { ok: false, error: "Item is required." };
    if (!size) return { ok: false, error: "Size is required." };
    if (!(draft.qty > 0) || !Number.isFinite(draft.qty)) {
      return { ok: false, error: "Quantity is required." };
    }
    if (!(draft.expectedPriceCents >= 0) || !Number.isFinite(draft.expectedPriceCents)) {
      return { ok: false, error: "Expected price is required." };
    }
    lines.push({
      skuId: draft.skuId?.trim() || "",
      name,
      size,
      qty: draft.qty,
      unitCostCents: Math.round(draft.expectedPriceCents),
      receivedQty: 0,
    });
  }
  const totalCents = lines.reduce((sum, line) => sum + Math.round(line.qty * line.unitCostCents), 0);
  return { ok: true, lines, totalCents };
}

/** Print document. Status is sent. This does not change on-hand. */
export function orderPrintHtml(po: PurchaseOrder, house: string): string {
  const pick = po.pickList === true;
  const title = pick ? `${house} pick list` : `${house} order`;
  const rows = po.lines
    .map((line) => {
      const total = (line.qty * line.unitCostCents) / 100;
      return `<tr><td>${esc(line.name)}</td><td>${esc(line.size ?? "")}</td><td>${line.qty}</td><td>${(line.unitCostCents / 100).toFixed(2)}</td><td>${total.toFixed(2)}</td></tr>`;
    })
    .join("");
  const note = pick
    ? "No order is sent. Nothing is received until the store receipt is matched."
    : "Nothing is received until the invoice is matched.";
  return `<!doctype html><html><head><title>${esc(title)}</title>
<style>body{font-family:ui-sans-serif,system-ui;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;text-align:left}</style>
</head><body>
<h1>${esc(title)}</h1>
<p>${esc(po.supplierName)} · Status: sent</p>
<p>${esc(note)}</p>
<table><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Expected price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
<p>Total $${(po.totalCents / 100).toFixed(2)}</p>
</body></html>`;
}

/** Read item, size, quantity, and price from invoice text, CSV, or a PDF text extract. */
export function readInvoiceLines(text: string): InvoiceReadLine[] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length >= 2 && rows[0]!.includes(",")) {
    const header = splitCsv(rows[0]!).map((cell) => cell.toLowerCase().replace(/\s+/g, ""));
    const col = (names: string[]) => header.findIndex((cell) => names.includes(cell));
    const itemI = col(["item", "name", "product", "desc", "description", "sku"]);
    const sizeI = col(["size", "pack", "unit", "packsize"]);
    const qtyI = col(["qty", "quantity", "count", "bottles", "cases"]);
    const priceI = col(["price", "cost", "unitcost", "amount", "each", "expectedprice"]);
    if (itemI >= 0 && qtyI >= 0) {
      const lines: InvoiceReadLine[] = [];
      for (const row of rows.slice(1)) {
        const cells = splitCsv(row);
        const name = cells[itemI]?.trim() ?? "";
        if (!name) continue;
        const qty = parseFloat(cells[qtyI] ?? "");
        const price = dollarsToCents(cells[priceI] ?? "") ?? 0;
        if (!(qty > 0)) continue;
        lines.push({
          name,
          size: sizeI >= 0 ? (cells[sizeI]?.trim() ?? "") : "",
          qty,
          unitCostCents: price,
        });
      }
      if (lines.length) return lines;
    }
  }

  const lines: InvoiceReadLine[] = [];
  const rowRe =
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+(?:x|@)?\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/;
  for (const row of rows) {
    const cells = row.split(/\s*[|]\s*/);
    if (cells.length >= 3) {
      const qtyAt = cells.findIndex((cell, index) => index > 0 && /^\d+(?:\.\d+)?$/.test(cell));
      const priceAt = cells.findIndex((cell, index) => index > qtyAt && qtyAt >= 0 && /\$?\d/.test(cell));
      if (qtyAt > 0 && priceAt > qtyAt) {
        const qty = parseFloat(cells[qtyAt]!);
        const price = dollarsToCents(cells[priceAt]!) ?? 0;
        const name = cells.slice(0, qtyAt).join(" ").trim();
        const size = cells.slice(qtyAt + 1, priceAt).join(" ").trim();
        if (name && qty > 0) lines.push({ name, size, qty, unitCostCents: price });
        continue;
      }
    }
    const hit = rowRe.exec(row);
    if (!hit) continue;
    const qty = parseFloat(hit[2]!);
    if (!(qty > 0)) continue;
    lines.push({
      name: hit[1]!.trim(),
      size: "",
      qty,
      unitCostCents: Math.round(parseFloat(hit[3]!) * 100),
    });
  }
  return lines;
}

function sameItem(order: PurchaseOrderLine, invoice: InvoiceReadLine): boolean {
  const orderName = norm(order.name);
  const invoiceName = norm(invoice.name);
  if (!orderName || !invoiceName) return false;
  const nameOk =
    orderName === invoiceName || orderName.includes(invoiceName) || invoiceName.includes(orderName);
  if (!nameOk) return false;
  if (order.size && invoice.size && norm(order.size) !== norm(invoice.size)) return false;
  return true;
}

function flagsFor(orderQty: number, invoiceQty: number, orderPrice: number, invoicePrice: number, paired: boolean): OrderMatchFlag[] {
  if (!paired && invoiceQty > 0 && orderQty === 0) return ["extra"];
  if (!paired && orderQty > 0 && invoiceQty === 0) return ["short"];
  const flags: OrderMatchFlag[] = [];
  if (invoiceQty < orderQty) flags.push("short");
  else if (invoiceQty > orderQty) flags.push("extra");
  if (orderPrice !== invoicePrice) flags.push("price");
  if (invoiceQty === orderQty && orderPrice === invoicePrice) flags.push("match");
  return flags.length ? flags : ["match"];
}

/** Compare the printed order to the invoice. A line can be short and a different price. */
export function compareOrderToInvoice(
  orderLines: PurchaseOrderLine[],
  invoiceLines: InvoiceReadLine[],
): OrderMatchLine[] {
  const used = new Set<number>();
  const rows: OrderMatchLine[] = [];
  orderLines.forEach((order, orderIndex) => {
    const invoiceIndex = invoiceLines.findIndex((line, index) => !used.has(index) && sameItem(order, line));
    const invoice = invoiceIndex >= 0 ? invoiceLines[invoiceIndex] : undefined;
    if (invoiceIndex >= 0) used.add(invoiceIndex);
    const invoiceQty = invoice?.qty ?? 0;
    const invoicePrice = invoice?.unitCostCents ?? order.unitCostCents;
    rows.push({
      id: `ord_${orderIndex}`,
      item: order.name,
      size: invoice?.size || order.size || "",
      skuId: order.skuId || undefined,
      orderIndex,
      orderQty: order.qty,
      invoiceQty,
      orderPriceCents: order.unitCostCents,
      invoicePriceCents: invoice ? invoice.unitCostCents : 0,
      flags: flagsFor(order.qty, invoiceQty, order.unitCostCents, invoice ? invoice.unitCostCents : order.unitCostCents, Boolean(invoice)),
      decision: "pending",
      confirmQty: invoiceQty,
      confirmPriceCents: invoice ? invoicePrice : order.unitCostCents,
    });
  });
  invoiceLines.forEach((invoice, index) => {
    if (used.has(index)) return;
    rows.push({
      id: `ext_${index}`,
      item: invoice.name,
      size: invoice.size,
      orderIndex: null,
      orderQty: 0,
      invoiceQty: invoice.qty,
      orderPriceCents: 0,
      invoicePriceCents: invoice.unitCostCents,
      flags: ["extra"],
      decision: "pending",
      confirmQty: invoice.qty,
      confirmPriceCents: invoice.unitCostCents,
    });
  });
  return rows;
}

/** Pending lines become confirmed. A rejected line stays rejected. */
export function decisionsForConfirm(lines: OrderMatchLine[]): OrderMatchLine[] {
  return lines.map((line) => (line.decision === "reject" ? line : { ...line, decision: "confirm" }));
}

export function receiveConfirmedLines(
  skus: CostSku[],
  lines: OrderMatchLine[],
  opts: { now: number; makeSku: (line: OrderMatchLine) => CostSku },
): { skus: CostSku[]; received: OrderMatchLine[]; rejected: OrderMatchLine[] } {
  const received = lines.filter((line) => line.decision === "confirm" && line.confirmQty > 0);
  const rejected = lines.filter((line) => line.decision === "reject" || line.decision === "pending" || !(line.confirmQty > 0 && line.decision === "confirm"));
  let next = skus.map((sku) => ({ ...sku }));
  for (const line of received) {
    const key = norm(line.item);
    const byId = line.skuId ? next.findIndex((sku) => sku.id === line.skuId) : -1;
    const index = byId >= 0 ? byId : next.findIndex((sku) => norm(sku.name) === key);
    if (index < 0) {
      const created = opts.makeSku(line);
      next = [
        {
          ...created,
          onHand: created.onHand + line.confirmQty,
          costCents: line.confirmPriceCents,
          lastReceivedAt: opts.now,
          lastReceivedQty: line.confirmQty,
          lastPoPriceCents: line.confirmPriceCents,
          packLabel: line.size || created.packLabel,
        },
        ...next,
      ];
      continue;
    }
    const sku = next[index]!;
    next[index] = {
      ...sku,
      onHand: sku.onHand + line.confirmQty,
      costCents: line.confirmPriceCents,
      lastReceivedAt: opts.now,
      lastReceivedQty: line.confirmQty,
      lastPoPriceCents: line.confirmPriceCents,
      packLabel: line.size || sku.packLabel,
    };
  }
  return { skus: next, received, rejected };
}
