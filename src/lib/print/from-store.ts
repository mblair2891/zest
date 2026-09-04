import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import { usePosStore } from "@/lib/pos/store";
import type { KitchenTicket, Order } from "@/lib/pos/types";
import { uid } from "@/lib/utils";
import { dispatchPrintJob } from "./dispatch";
import type { PrintJob, PrintLine } from "./types";
import type { PrintStation } from "@/lib/pos/location-devices";
import { entityIdForLine, splitTenderByEntity } from "@/lib/payments/entity-split";

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
