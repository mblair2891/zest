import { cashPolicyFromSettings } from "@/lib/pos/cash-discount";
import { computeDualTotals, computeTotals, lineCardCents, lineCashCents, linePrintedCents } from "@/lib/pos/calculations";
import { isVenueStationOnline } from "@/lib/pos/location-devices";
import { usePosStore } from "@/lib/pos/store";
import type { KitchenTicket, Order, RestaurantSettings } from "@/lib/pos/types";
import { uid } from "@/lib/utils";
import { dispatchPrintJob, printersForStation } from "./dispatch";
import { currentStationDeviceId, resolveReceiptPrinter } from "./receipt-printer";
import type { PrintJob, PrintLine } from "./types";
import type { PrintStation } from "@/lib/pos/location-devices";
import { splitTenderByEntity } from "@/lib/payments/entity-split";
import { parseQrPolicy, qrPrintOnTicket } from "@/lib/pos/qr-policy";
import { ticketGuestUrl } from "@/lib/pos/qr-table";
import { parseLanTarget } from "./printer-models";
import { escposBase64 } from "./escpos";
import { enqueueStationPrintFn, enqueueVenuePrintFn } from "./api";
import { readStationPair } from "@/lib/pos/station-pair";
import type { KitchenPrintSource } from "./station-print-queue";

function linesFromTicket(t: KitchenTicket): PrintLine[] {
  return t.items.map((it) => ({
    qty: it.quantity,
    name: it.name,
    mods: it.modifiers,
    note: it.note,
    seat: it.seat,
  }));
}

function receiptLines(order: Order, settings: RestaurantSettings): PrintLine[] {
  const last = order.payments[order.payments.length - 1];
  const policy =
    last?.method === "cash" ? null : cashPolicyFromSettings(settings);
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
      amountCents: linePrintedCents(l, policy),
    }));
}

async function enqueueKitchenJob(
  job: PrintJob,
  printerId: string,
  host: string,
  port: number,
  payload: string,
  source: KitchenPrintSource,
): Promise<boolean> {
  const pair = readStationPair();
  const body = {
    locationId: job.locationId,
    printerId,
    host,
    port,
    escposBase64: payload,
    kind: "ticket" as const,
    ticketId: job.ticketId,
    checkId: job.checkId,
    source,
    preferDocked: true,
    deviceId: pair?.deviceId || currentStationDeviceId() || "",
  };
  try {
    if (body.deviceId) {
      const q = await enqueueVenuePrintFn({ data: body });
      if (q.ok) return true;
    }
    const q = await enqueueStationPrintFn({ data: body });
    return q.ok === true;
  } catch {
    return false;
  }
}

function guestCheckJob(
  order: Order,
  s: ReturnType<typeof usePosStore.getState>,
  locationId: string,
  locationName: string,
): PrintJob {
  const table = order.tableId ? s.tables.find((tb) => tb.id === order.tableId) : undefined;
  const dual = computeDualTotals(order, s.settings);
  const policy = cashPolicyFromSettings(s.settings);
  const items: PrintLine[] = order.lines
    .filter((l) => !l.voided)
    .map((l) => ({
      qty: l.quantity,
      name: l.name,
      mods: l.modifiers.map((m) => m.optionName),
      note: l.note,
      seat: l.seat,
      vendorId: l.vendorId,
      vendorName: l.vendorName,
      cashCents: lineCashCents(l),
      cardCents: lineCardCents(l, policy),
      amountCents: linePrintedCents(l, policy),
    }));
  return {
    id: uid("prn"),
    kind: "guest_check",
    station: "receipt",
    locationId,
    locationName,
    checkId: order.id,
    checkNumber: order.number,
    tableLabel: table?.label ?? order.tabName ?? order.type.replace("_", " "),
    serverName: order.serverName,
    copy: "guest",
    items,
    guestCheckNote: "Not a receipt — pay server",
    totals: {
      subtotalCents: dual.cash.subtotalCents,
      taxCents: dual.cash.taxCents,
      totalCents: dual.cash.totalCents,
      cashTotalCents: dual.cash.totalCents,
      cardTotalCents: dual.card.totalCents,
    },
    at: Date.now(),
  };
}

export async function printFromPos(
  kind: "send" | "bump" | "ready" | "receipt" | "guest_check" | "test",
  id?: string,
  opts?: { source?: KitchenPrintSource },
): Promise<void> {
  const s = usePosStore.getState();
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
  const devices = s.locationDevices;
  const jobs: PrintJob[] = [];
  const source: KitchenPrintSource = opts?.source ?? "station";
  const queueOnly = source === "qr" || source === "kiosk" || source === "online" || source === "dashboard";

  if (kind === "send") {
    const tickets = id
      ? s.tickets.filter(
          (t) => t.orderId === id && t.status === "new" && Date.now() - (t.createdAt || 0) < 12_000,
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
        destinationName: station === "bar" ? "Bar" : "Kitchen",
        items: linesFromTicket(t),
        at: Date.now(),
        ticketId: t.id,
        printSource: source,
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
      const receiptPrn = resolveReceiptPrinter(devices, currentStationDeviceId());
      const ticketQr =
        qrPrintOnTicket(policy) &&
        receiptPrn?.print?.printPayQr !== false &&
        locationId
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
        items: receiptLines(order, s.settings),
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
    }
  }

  if (kind === "guest_check") {
    const order = (id ? s.orders.find((o) => o.id === id) : null) ?? s.getActiveOrder?.();
    if (order) jobs.push(guestCheckJob(order, s, locationId, locationName));
  }

  const stationId = currentStationDeviceId();
  const mappedReceipt = resolveReceiptPrinter(devices, stationId);

  for (const job of jobs) {
    const printers = printersForStation(devices, job.station, job.operatorId, stationId);
    if (job.kind === "ticket" && (queueOnly || printers.length > 0)) {
      for (const p of printers) {
        const cfg = p.print;
        const lan = parseLanTarget(cfg?.ip, cfg?.port, cfg?.target);
        if (!lan || !cfg) continue;
        const payload = escposBase64(job, {
          modelPreset: cfg.modelPreset,
          emulation: cfg.emulation,
          paperWidthMm: cfg.paperWidthMm,
          cutter: cfg.cutter,
        });
        if (!queueOnly) {
          const local = await dispatchPrintJob(job, [p], { printerId: p.id });
          if (local.printed > 0) continue;
        }
        await enqueueKitchenJob(job, p.id, lan.host, lan.port, payload, source);
      }
      continue;
    }
    if (job.kind === "receipt" || job.kind === "guest_check" || printers.length > 0) {
      const local = await dispatchPrintJob(job, devices, {
        printerId:
          job.kind === "receipt" || job.kind === "guest_check" ? mappedReceipt?.id : undefined,
      });
      if (
        (job.kind === "guest_check" || job.kind === "receipt") &&
        local.printed < 1 &&
        mappedReceipt?.print
      ) {
        const lan = parseLanTarget(
          mappedReceipt.print.ip,
          mappedReceipt.print.port,
          mappedReceipt.print.target,
        );
        if (lan) {
          await enqueueKitchenJob(
            job,
            mappedReceipt.id,
            lan.host,
            lan.port,
            escposBase64(job, {
              modelPreset: mappedReceipt.print.modelPreset,
              emulation: mappedReceipt.print.emulation,
              paperWidthMm: mappedReceipt.print.paperWidthMm,
              cutter: mappedReceipt.print.cutter,
            }),
            source,
          );
        }
      }
    }
  }
}

/** Guest copy only — one document, lines grouped by vendor. ESC-POS on the station printer. */
export async function printGuestReceipt(orderId: string): Promise<{
  ok: boolean;
  error?: string;
  printerLabel?: string;
}> {
  const s = usePosStore.getState();
  const order = s.orders.find((o) => o.id === orderId) ?? s.getActiveOrder?.();
  if (!order) return { ok: false, error: "No check to print." };
  const devices = s.locationDevices;
  const printer = resolveReceiptPrinter(devices, currentStationDeviceId());
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
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
  const job: PrintJob = {
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
    items: receiptLines(order, s.settings),
    allocations: shares.map((sh) => ({
      name: sh.displayName,
      merchandiseCents: sh.merchandiseCents,
      feesCents: sh.taxCents + sh.serviceCents + sh.tipCents,
      totalCents: sh.totalCents,
    })),
    totals: {
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      tipCents: totals.tipCents,
      giftCents: order.payments
        .filter((p) => p.method === "gift_card")
        .reduce((sum, p) => sum + p.amountCents, 0),
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
  const res = await dispatchPrintJob(job, devices, {
    printerId: printer?.id,
  });
  if (res.printed < 1) {
    return {
      ok: false,
      error: res.error || "Use a paired station or print agent.",
    };
  }
  return { ok: true, printerLabel: printer?.label ?? "Station printer" };
}

/** Pre-pay guest check on the bound receipt printer. Not kitchen. Not a paid receipt. */
export async function printGuestCheck(orderId?: string): Promise<{
  ok: boolean;
  error?: string;
  printerLabel?: string;
  viaStation?: string;
}> {
  const s = usePosStore.getState();
  const order = (orderId ? s.orders.find((o) => o.id === orderId) : null) ?? s.getActiveOrder?.();
  if (!order) return { ok: false, error: "No check to print." };
  const devices = s.locationDevices;
  const printer = resolveReceiptPrinter(devices, currentStationDeviceId());
  if (!printer?.print) {
    return { ok: false, error: "Add a receipt printer. Guest checks do not print on the kitchen Star." };
  }
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
  const job = guestCheckJob(order, s, locationId, locationName);
  const res = await dispatchPrintJob(job, devices, { printerId: printer.id });
  if (res.printed > 0) {
    return { ok: true, printerLabel: printer.label };
  }
  const lan = parseLanTarget(printer.print.ip, printer.print.port, printer.print.target);
  if (!lan) {
    return { ok: false, error: res.error || "Receipt printer needs a static IP." };
  }
  const queued = await enqueueKitchenJob(
    job,
    printer.id,
    lan.host,
    lan.port,
    escposBase64(job, {
      modelPreset: printer.print.modelPreset,
      emulation: printer.print.emulation,
      paperWidthMm: printer.print.paperWidthMm,
      cutter: printer.print.cutter,
    }),
    "station",
  );
  if (queued) {
    const via = (devices ?? []).find((d) => isVenueStationOnline(d));
    return {
      ok: true,
      printerLabel: printer.label,
      viaStation: via?.label || "station",
    };
  }
  return { ok: false, error: res.error || "Use a paired station or print agent." };
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
