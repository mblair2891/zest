import { cashPolicyFromSettings } from "@/lib/pos/cash-discount";
import { computeDualTotals, computeTotals, lineCardCents, lineCashCents, linePrintedCents } from "@/lib/pos/calculations";
import { usePosStore } from "@/lib/pos/store";
import type { KitchenTicket, Order, RestaurantSettings } from "@/lib/pos/types";
import { uid } from "@/lib/utils";
import { dispatchPrintJob, kickCashDrawer, printersForStation } from "./dispatch";
import { ADD_RECEIPT_PRINTER, currentStationDeviceId, resolveReceiptPrinter } from "./receipt-printer";
import { NO_DRAWER_ON_STATION, receiptDrawerKickAllowed, resolveReceiptDrawer } from "./receipt-drawer";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import { readStationDeviceRole } from "@/lib/pos/device-roles";
import type { PrintJob, PrintLine } from "./types";
import type { PrintStation } from "@/lib/pos/location-devices";
import { splitTenderByEntity } from "@/lib/payments/entity-split";
import { parseQrPolicy, qrPrintOnTicket } from "@/lib/pos/qr-policy";
import { ticketGuestUrl } from "@/lib/pos/qr-table";
import { parseLanTarget } from "./printer-models";
import { escposBase64, parseDrawerKickPin } from "./escpos";
import { enqueueStationPrintFn, enqueueVenuePrintFn } from "./api";
import { readStationPair } from "@/lib/pos/station-pair";
import type { KitchenPrintSource } from "./station-print-queue";
import {
  printStationForDestination,
  resolveOrderPrinters,
} from "@/lib/pos/fire-routing";
import { DEFAULT_ORDER_DESTINATION } from "@/lib/pos/order-destinations";

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

export const NO_SECTION_RECEIPT =
  "No receipt printer for this section — add one in Devices.";

async function enqueueKitchenJob(
  job: PrintJob,
  printerId: string,
  host: string,
  port: number,
  payload: string,
  source: KitchenPrintSource,
  kind: "ticket" | "receipt" | "test" = "ticket",
): Promise<boolean> {
  const pair = readStationPair();
  const body = {
    locationId: job.locationId,
    printerId,
    host,
    port,
    escposBase64: payload,
    kind,
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
      const destinationName =
        t.destinationName || (t.station === "bar" ? "Bar" : DEFAULT_ORDER_DESTINATION);
      const station: PrintStation = printStationForDestination(destinationName);
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
        destinationName,
        items: linesFromTicket(t),
        at: Date.now(),
        ticketId: t.id,
        printSource: source,
        printerId: t.printerId,
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
      const receiptPrn = resolveReceiptPrinter(devices, currentStationDeviceId(), {
        table,
        tables: s.tables,
        tableId: order.tableId,
        sections: s.floorSections,
        orderType: order.type,
      });
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
  const receiptOrder =
    kind === "receipt" || kind === "guest_check"
      ? (id ? s.orders.find((o) => o.id === id) : null) ?? s.getActiveOrder?.()
      : undefined;
  const receiptTable = receiptOrder?.tableId
    ? s.tables.find((tb) => tb.id === receiptOrder.tableId)
    : undefined;
  const checkCtx = receiptOrder
    ? {
        table: receiptTable,
        tables: s.tables,
        tableId: receiptOrder.tableId,
        sections: s.floorSections,
        orderType: receiptOrder.type,
      }
    : undefined;
  const mappedReceipt = resolveReceiptPrinter(devices, stationId, checkCtx);
  const fireOrder = kind === "send" ? (id ? s.orders.find((o) => o.id === id) : null) : undefined;
  const fireTable = fireOrder?.tableId
    ? s.tables.find((tb) => tb.id === fireOrder.tableId)
    : undefined;

  for (const job of jobs) {
    const printers =
      job.kind === "ticket"
        ? resolveOrderPrinters({
            devices,
            destinationName: job.destinationName || DEFAULT_ORDER_DESTINATION,
            printerId: job.printerId,
            operatorId: job.operatorId,
            stationDeviceId: stationId,
            table: fireTable,
            tables: s.tables,
            tableId: fireOrder?.tableId,
            sections: s.floorSections,
            orderType: fireOrder?.type,
          })
        : printersForStation(devices, job.station, job.operatorId, stationId);
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
            job.kind === "guest_check" || job.kind === "receipt" ? "receipt" : "ticket",
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
  const table = order.tableId ? s.tables.find((tb) => tb.id === order.tableId) : undefined;
  const printer = resolveReceiptPrinter(devices, currentStationDeviceId(), {
    table,
    tables: s.tables,
    tableId: order.tableId,
    sections: s.floorSections,
    orderType: order.type,
  });
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
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
  if (!printer) {
    return { ok: false, error: ADD_RECEIPT_PRINTER };
  }
  const res = await dispatchPrintJob(job, devices, {
    printerId: printer.id,
  });
  if (res.printed > 0) {
    return { ok: true, printerLabel: printer.label };
  }
  const cfg = printer.print;
  const lan = cfg ? parseLanTarget(cfg.ip, cfg.port, cfg.target) : null;
  if (!lan || !cfg) {
    return { ok: false, error: res.error || "Receipt printer needs a static IP." };
  }
  const queued = await enqueueKitchenJob(
    job,
    printer.id,
    lan.host,
    lan.port,
    escposBase64(job, {
      modelPreset: cfg.modelPreset,
      emulation: cfg.emulation,
      paperWidthMm: cfg.paperWidthMm,
      cutter: cfg.cutter,
    }),
    "station",
    "receipt",
  );
  if (queued) {
    return { ok: true, printerLabel: printer.label };
  }
  return {
    ok: false,
    error: res.error || "Use a paired station or print agent.",
  };
}

/** Pre-pay guest check on the section receipt printer. Never kitchen. Never a Star. */
export async function printGuestCheck(orderId?: string): Promise<{
  ok: boolean;
  error?: string;
  printerLabel?: string;
  sentTo?: string;
}> {
  const s = usePosStore.getState();
  const order = (orderId ? s.orders.find((o) => o.id === orderId) : null) ?? s.getActiveOrder?.();
  if (!order) return { ok: false, error: "No check to print." };
  const devices = s.locationDevices;
  const stationId = currentStationDeviceId();
  const table = order.tableId ? s.tables.find((tb) => tb.id === order.tableId) : undefined;
  const sectionName = String(table?.section ?? "").trim();
  const noPrinter = sectionName ? NO_SECTION_RECEIPT : ADD_RECEIPT_PRINTER;
  const printer = resolveReceiptPrinter(devices, stationId, {
    table,
    tables: s.tables,
    tableId: order.tableId,
    sections: s.floorSections,
    orderType: order.type,
  });
  if (!printer || printer.print?.station === "kitchen" || printer.type === "order_printer") {
    return { ok: false, error: noPrinter };
  }
  const sentTo = sectionName ? `${sectionName} receipt printer` : printer.label || "receipt printer";
  const locationId = s.tenantLocationId || "";
  const locationName = s.settings.name || "Summex";
  const cash = parseCashHandling(s.settings.cashHandling);
  const job: PrintJob = {
    ...guestCheckJob(order, s, locationId, locationName),
    kind: "guest_check",
    station: "receipt",
    kickDrawer:
      Boolean(cash.kickOnPrintCheck) &&
      Boolean(resolveReceiptDrawer(devices, stationId)) &&
      Boolean(printer.print && printer.print.drawerKick !== "none"),
    drawerKickPin: parseDrawerKickPin(cash.drawerKickPin),
  };
  const res = await dispatchPrintJob(job, devices, { printerId: printer.id });
  if (res.printed > 0) {
    return { ok: true, printerLabel: printer.label, sentTo };
  }
  const cfg = printer.print;
  const lan = cfg ? parseLanTarget(cfg.ip, cfg.port, cfg.target) : null;
  if (!lan || !cfg) {
    return { ok: false, error: noPrinter };
  }
  const queued = await enqueueKitchenJob(
    job,
    printer.id,
    lan.host,
    lan.port,
    escposBase64(job, {
      modelPreset: cfg.modelPreset,
      emulation: cfg.emulation,
      paperWidthMm: cfg.paperWidthMm,
      cutter: cfg.cutter,
    }),
    "station",
    "receipt",
  );
  if (queued) {
    return { ok: true, printerLabel: printer.label, sentTo };
  }
  return { ok: false, error: noPrinter };
}

/** Bound receipt drawer kick. Never a check. Never kitchen Star. */
export async function performNoSale(opts: {
  reason: string;
  printSlip?: boolean;
  printerId?: string;
}): Promise<{ ok: boolean; error?: string; printerId?: string; printerLabel?: string }> {
  const s = usePosStore.getState();
  const devices = s.locationDevices ?? [];
  const stationId = currentStationDeviceId();
  const named = opts.printerId ? devices.find((d) => d.id === opts.printerId) : undefined;
  const printer =
    named && receiptDrawerKickAllowed(named)
      ? named
      : resolveReceiptDrawer(devices, stationId, readStationDeviceRole());
  if (!printer) {
    return { ok: false, error: NO_DRAWER_ON_STATION };
  }
  const locationId = s.tenantLocationId || "";
  await kickCashDrawer({
    locationId,
    devices,
    printerId: printer.id,
    pin: parseDrawerKickPin(parseCashHandling(s.settings.cashHandling).drawerKickPin),
    deviceId: stationId,
  });
  if (opts.printSlip) {
    const emp = s.getCurrentEmployee?.();
    const station = devices.find((d) => d.id === stationId);
    const job: PrintJob = {
      id: uid("ns"),
      kind: "no_sale",
      station: "receipt",
      locationId,
      locationName: s.settings.name || "Summex",
      checkId: "no_sale",
      checkNumber: "",
      tableLabel: station?.label || "Station",
      serverName: emp?.name || "",
      items: [],
      guestCheckNote: String(opts.reason || "").trim(),
      at: Date.now(),
    };
    await dispatchPrintJob(job, devices, { printerId: printer.id });
  }
  return { ok: true, printerId: printer.id, printerLabel: printer.label ?? "Receipt printer" };
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
