import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import { usePosStore } from "@/lib/pos/store";
import type { KitchenTicket, Order } from "@/lib/pos/types";
import { uid } from "@/lib/utils";
import { dispatchPrintJob } from "./dispatch";
import type { PrintJob, PrintLine } from "./types";
import type { PrintStation } from "@/lib/pos/location-devices";
import { entityIdForLine, splitTenderByEntity } from "@/lib/payments/entity-split";
import { parseQrPolicy, qrPrintOnTicket } from "@/lib/pos/qr-policy";
import { ticketGuestUrl } from "@/lib/pos/qr-table";

function linesFromTicket(t: KitchenTicket): PrintLine[] {
  return t.items.map((it) => ({
    qty: it.quantity,
    name: it.name,
    mods: it.modifiers,
    note: it.note,
    seat: it.seat,
  }));
}

function receiptLines(order: Order): PrintLine[] {
  return order.lines
    .filter((l) => !l.voided)
    .map((l) => ({
      qty: l.quantity,
      name: l.name,
      mods: l.modifiers.map((m) => m.optionName),
      note: l.note,
      seat: l.seat,
      vendorId: l.vendorId,
      vendorName: l.vendorName,
      amountCents: linePrintedCents(l),
    }));
}

export async function printFromPos(
  kind: "send" | "bump" | "ready" | "receipt" | "test",
  id?: string,
): Promise<void> {
  const s = usePosStore.getState();
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
  const devices = s.locationDevices;
  const jobs: PrintJob[] = [];

  if (kind === "send") {
    const tickets = id
      ? s.tickets.filter(
          (t) => t.orderId === id && t.status === "new" && Date.now() - (t.createdAt || 0) < 8000,
        )
      : [];
    for (const t of tickets) {
      const station: PrintStation = t.station === "bar" ? "bar" : "kitchen";
      jobs.push({
        id: uid("prn"),
        kind: "ticket",
        station,
        locationId,
        locationName,
        checkId: t.orderId,
        checkNumber: t.orderNumber,
        tableLabel: t.tableLabel,
        serverName: t.serverName,
        operatorId: t.vendorId,
        operatorName: t.vendorName,
        items: linesFromTicket(t),
        at: Date.now(),
      });
    }
  }

  if (kind === "ready" || kind === "bump") {
    const t = s.tickets.find((x) => x.id === id);
    if (t) {
      jobs.push({
        id: uid("prn"),
        kind: "ticket",
        station: "expo",
        locationId,
        locationName,
        checkId: t.orderId,
        checkNumber: t.orderNumber,
        tableLabel: t.tableLabel,
        serverName: t.serverName,
        operatorId: t.vendorId,
        operatorName: t.vendorName,
        items: linesFromTicket(t),
        at: Date.now(),
      });
    }
  }

  if (kind === "receipt") {
    const order = (id ? s.orders.find((o) => o.id === id) : null) ?? s.getActiveOrder?.();
    if (order) {
      const table = order.tableId ? s.tables.find((tb) => tb.id === order.tableId) : undefined;
      const tender = order.payments[order.payments.length - 1];
      const totals = computeTotals(order, s.settings, {
        tender: tender?.method === "cash" ? "cash" : "card",
      });
      const shares = splitTenderByEntity({
        order,
        settings: s.settings,
        amountCents: totals.totalCents,
        tipCents: totals.tipCents,
        hostName: locationName,
        operatorName: (id) => s.vendors.find((v) => v.id === id)?.name ?? id,
      });
      const allocations = shares.map((sh) => ({
        name: sh.displayName,
        merchandiseCents: sh.merchandiseCents,
        feesCents: sh.taxCents + sh.serviceCents + sh.tipCents,
        totalCents: sh.totalCents,
      }));
      const policy = parseQrPolicy(s.settings.qrPolicy, s.settings.qrMode);
      const ticketQr =
        qrPrintOnTicket(policy) && locationId
          ? ticketGuestUrl(order.id, locationId, policy.ticketQrTtlSec)
          : null;
      const guestJob: PrintJob = {
        id: uid("prn"),
        kind: "receipt",
        station: "receipt",
        locationId,
        locationName,
        checkId: order.id,
        checkNumber: order.number,
        tableLabel: table?.label ?? order.tabName ?? order.type.replace("_", " "),
        serverName: order.serverName,
        copy: "guest",
        items: receiptLines(order),
        allocations,
        qrUrl: ticketQr?.url,
        qrCaption: ticketQr ? "Scan to pay this check" : undefined,
        totals: {
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          tipCents: totals.tipCents,
          giftCents: order.payments
            .filter((p) => p.method === "gift_card")
            .reduce((s, p) => s + p.amountCents, 0),
          totalCents: totals.totalCents,
          tender: tender
            ? tender.method === "card"
              ? `Card${tender.last4 ? ` ·${tender.last4}` : ""} · Quantum Payments`
              : tender.method === "gift_card"
                ? "Gift"
                : tender.method === "cash"
                  ? "Cash"
                  : tender.method
            : undefined,
        },
        at: Date.now(),
      };
      jobs.push(guestJob);
      if (allocations.length > 1) {
        for (const sh of shares) {
          jobs.push({
            ...guestJob,
            id: uid("prn"),
            copy: "merchant",
            operatorName: sh.displayName,
            items: receiptLines(order).filter((l) => entityIdForLine(l) === sh.entityId),
            allocations: [
              {
                name: sh.displayName,
                merchandiseCents: sh.merchandiseCents,
                feesCents: sh.taxCents + sh.serviceCents + sh.tipCents,
                totalCents: sh.totalCents,
              },
            ],
          });
        }
      }
    }
  }

  for (const job of jobs) {
    const printers = (devices ?? []).filter(
      (d) => d.type === "printer" && d.status !== "inactive" && d.print?.station === job.station,
    );
    if (job.kind === "receipt" || printers.length > 0) {
      await dispatchPrintJob(job, devices, {
        forceBrowser: printers.length === 0 && job.kind === "receipt",
      });
    }
  }
}

export async function printTableTents(): Promise<void> {
  const s = usePosStore.getState();
  const policy = parseQrPolicy(s.settings.qrPolicy, s.settings.qrMode);
  if (!policy.flags.includes("table_tents")) return;
  const { tableGuestUrl } = await import("@/lib/pos/qr-table");
  const { getDemoType } = await import("@/lib/demo/session");
  const demoType = getDemoType();
  const locationName = s.settings.name || "Summex";
  const cards = s.tables
    .filter((t) => !t.mergedIntoId)
    .map((t) => {
      const url = tableGuestUrl(t, { demoType });
      const seats = Math.max(1, t.seats || 1);
      const seatUrls =
        seats > 1 && seats <= 8
          ? Array.from({ length: seats }, (_, i) => ({
              seat: i + 1,
              url: tableGuestUrl(t, { demoType, seat: i + 1 }),
            }))
          : [];
      return { label: t.label, section: t.section, url, seatUrls };
    });
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Table tents · ${escHtml(locationName)}</title>
<style>
  @page { size: letter; margin: 12mm; }
  body { font: 13px/1.3 ui-sans-serif, system-ui, sans-serif; color: #111; }
  h1 { font-size: 18px; text-align: center; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px dashed #333; padding: 12px; text-align: center; break-inside: avoid; }
  img { width: 140px; height: 140px; }
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 8px; }
  .seats img { width: 72px; height: 72px; }
  .muted { color: #555; font-size: 11px; }
</style></head>
<body>
  <h1>${escHtml(locationName)} · table tents</h1>
  <p class="muted" style="text-align:center">Scan to order or pay this table. Quantum Payments · Summex</p>
  <div class="grid">
    ${cards
      .map(
        (c) => `<div class="card">
      <strong>Table ${escHtml(c.label)}</strong>
      <div class="muted">${escHtml(c.section || "")}</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=${encodeURIComponent(c.url)}" alt="Table ${escHtml(c.label)}"/>
      ${
        c.seatUrls.length
          ? `<div class="seats">${c.seatUrls
              .map(
                (s) =>
                  `<div><img src="https://api.qrserver.com/v1/create-qr-code/?size=72x72&margin=2&data=${encodeURIComponent(s.url)}" alt="Seat ${s.seat}"/><div class="muted">Seat ${s.seat}</div></div>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>`,
      )
      .join("")}
  </div>
</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1500);
    }
  };
  if (iframe.contentWindow?.document.readyState === "complete") run();
  else iframe.onload = run;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
