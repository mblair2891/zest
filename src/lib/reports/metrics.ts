import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import { cashPolicyFromSettings, cashPriceCents } from "@/lib/pos/cash-discount";
import type {
  Chargeback,
  Employee,
  InventoryItem,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  Order,
  Reservation,
  RestaurantSettings,
  SettlementPeriod,
  Vendor,
  VenueEntityId,
  WaitlistEntry,
} from "@/lib/pos/types";
import type { ShiftState } from "@/lib/pos/pos-store";
import type { LocationMetrics, RangeKey } from "./types";

export type MetricsInput = {
  locationId: string;
  locationName: string;
  venueType: VenueEntityId;
  range: RangeKey;
  isDemo: boolean;
  operatorId?: string | null;
  serverId?: string | null;
  now?: number;
  settings: RestaurantSettings;
  orders: Order[];
  tickets: KitchenTicket[];
  waitlist: WaitlistEntry[];
  reservations: Reservation[];
  employees: Employee[];
  menuItems: MenuItem[];
  categories: MenuCategory[];
  vendors: Vendor[];
  inventory: InventoryItem[];
  chargebacks: Chargeback[];
  settlementPeriods: SettlementPeriod[];
  shift: ShiftState;
};

function rangeBounds(range: RangeKey, now: number, shiftOpenedAt: number): { from: number; to: number } {
  const to = now;
  if (range === "shift") return { from: shiftOpenedAt || to - 8 * 3600_000, to };
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { from: d.getTime(), to };
  }
  if (range === "7d") return { from: to - 7 * 86400_000, to };
  return { from: to - 30 * 86400_000, to };
}

function daypart(hour: number): string {
  if (hour < 11) return "Morning";
  if (hour < 15) return "Lunch";
  if (hour < 17) return "Afternoon";
  if (hour < 22) return "Dinner";
  return "Late";
}

export function buildLocationMetrics(input: MetricsInput): LocationMetrics {
  const now = input.now ?? Date.now();
  const { from, to } = rangeBounds(input.range, now, input.shift.openedAt);
  const settings = input.settings;
  const hostMulti = Boolean(settings.hostMultiOperator || input.venueType === "food_hall");
  const op = input.operatorId || null;
  const srv = input.serverId || null;

  const inRange = input.orders.filter((o) => o.createdAt >= from && o.createdAt <= to);
  const scoped = inRange.filter((o) => {
    if (srv && o.serverId !== srv) return false;
    if (op) {
      return o.lines.some((l) => l.vendorId === op);
    }
    return true;
  });

  const closed = scoped.filter((o) => o.status === "closed");
  const open = scoped.filter((o) => o.status === "open");
  const policy = cashPolicyFromSettings(settings);

  let netCents = 0;
  let covers = 0;
  let tipsCents = 0;
  let cardCents = 0;
  let cashCents = 0;
  let giftCents = 0;
  let otherCents = 0;
  let voidsCents = 0;
  let compsCents = 0;
  let cashDiscountCostCents = 0;
  let refundsCents = 0;
  let kioskOrders = 0;

  const byHour: Record<number, number> = {};
  const byDaypart: Record<string, { cents: number; checks: number }> = {};
  const byCat: Record<string, { cents: number; qty: number }> = {};
  const byItem: Record<
    string,
    { id: string; name: string; cents: number; qty: number; station: string; vendorId?: string }
  > = {};
  const byChannel: Record<string, { cents: number; checks: number }> = {};
  const byServer: Record<string, { id: string; name: string; salesCents: number; tipsCents: number; checks: number }> =
    {};
  const byOperator: Record<string, { id: string; name: string; cents: number; tickets: number }> = {};

  for (const o of scoped) {
    const t = computeTotals(o, settings);
    const paid = o.payments.reduce((s, p) => s + p.amountCents, 0);
    const contrib = o.status === "voided" ? 0 : paid || (o.status === "closed" ? t.totalCents : 0);
    if (o.status === "voided") voidsCents += t.subtotalCents;
    compsCents += o.lines.filter((l) => l.comped).reduce((s, l) => s + linePrintedCents(l), 0);
    netCents += contrib;
    covers += o.guestCount;
    tipsCents += t.tipCents;
    if (o.type === "kiosk") kioskOrders += 1;
    if (o.status === "closed" && paid < 0) refundsCents += Math.abs(paid);

    for (const p of o.payments) {
      if (p.method === "card") cardCents += p.amountCents;
      else if (p.method === "cash") cashCents += p.amountCents;
      else if (p.method === "gift_card") giftCents += p.amountCents;
      else otherCents += p.amountCents;
    }

    const hour = new Date(o.createdAt).getHours();
    byHour[hour] = (byHour[hour] ?? 0) + contrib;
    const part = daypart(hour);
    if (!byDaypart[part]) byDaypart[part] = { cents: 0, checks: 0 };
    byDaypart[part].cents += contrib;
    byDaypart[part].checks += 1;

    const ch = o.type || "dine_in";
    if (!byChannel[ch]) byChannel[ch] = { cents: 0, checks: 0 };
    byChannel[ch].cents += contrib;
    byChannel[ch].checks += 1;

    if (!byServer[o.serverId]) {
      byServer[o.serverId] = { id: o.serverId, name: o.serverName, salesCents: 0, tipsCents: 0, checks: 0 };
    }
    byServer[o.serverId]!.salesCents += contrib;
    byServer[o.serverId]!.tipsCents += t.tipCents;
    byServer[o.serverId]!.checks += 1;

    for (const line of o.lines) {
      if (op && line.vendorId && line.vendorId !== op) continue;
      const printed = linePrintedCents(line);
      if (line.voided) continue;
      if (policy && !line.comped) {
        const cash = cashPriceCents(line.unitPriceCents, policy) * line.quantity;
        cashDiscountCostCents += Math.max(0, printed - cash);
      }
      const mi = input.menuItems.find((m) => m.id === line.menuItemId);
      const cat = input.categories.find((c) => c.id === mi?.categoryId)?.name ?? "Other";
      if (!byCat[cat]) byCat[cat] = { cents: 0, qty: 0 };
      byCat[cat].cents += printed;
      byCat[cat].qty += line.quantity;
      const ik = line.menuItemId || line.name;
      if (!byItem[ik]) {
        byItem[ik] = {
          id: line.menuItemId,
          name: line.name,
          cents: 0,
          qty: 0,
          station: line.station,
          vendorId: line.vendorId,
        };
      }
      byItem[ik]!.cents += printed;
      byItem[ik]!.qty += line.quantity;
      const vid = line.vendorId;
      if (vid) {
        const v = input.vendors.find((x) => x.id === vid);
        if (!byOperator[vid]) {
          byOperator[vid] = { id: vid, name: v?.name ?? vid, cents: 0, tickets: 0 };
        }
        byOperator[vid]!.cents += printed;
      }
    }
  }

  const tickets = input.tickets.filter((t) => t.createdAt >= from && t.createdAt <= to);
  const scopedTickets = op ? tickets.filter((t) => t.vendorId === op) : tickets;
  const kit = scopedTickets.filter((t) => t.station === "kitchen");
  const bar = scopedTickets.filter((t) => t.station === "bar");
  const avg = (list: KitchenTicket[]) => {
    if (!list.length) return 0;
    return Math.round(
      list.reduce((s, t) => {
        if (t.bumpedAt) return s + Math.max(0, (t.bumpedAt - t.createdAt) / 1000);
        return s + (t.elapsedSec || 0);
      }, 0) / list.length,
    );
  };
  for (const t of scopedTickets) {
    if (!t.vendorId) continue;
    if (!byOperator[t.vendorId]) {
      const v = input.vendors.find((x) => x.id === t.vendorId);
      byOperator[t.vendorId] = { id: t.vendorId, name: v?.name ?? t.vendorId, cents: 0, tickets: 0 };
    }
    byOperator[t.vendorId]!.tickets += 1;
  }

  const wait = input.waitlist.filter((w) => w.createdAt >= from && w.createdAt <= to);
  const seatedW = wait.filter((w) => w.status === "seated");
  const quotedAvg =
    wait.length === 0 ? 0 : Math.round(wait.reduce((s, w) => s + (w.quotedMinutes || 0), 0) / wait.length);

  const res = input.reservations.filter((r) => (r.at ?? r.time ?? r.createdAt) >= from);

  const costItems = Object.values(byItem).map((it) => {
    const inv = input.inventory.find((i) => i.linkedMenuItemIds.includes(it.id));
    const unitCost = inv ? inv.costCents : null;
    const costCents = unitCost == null ? null : unitCost * it.qty;
    const marginBps =
      costCents == null || it.cents <= 0 ? null : Math.round(((it.cents - costCents) / it.cents) * 10000);
    return {
      id: it.id,
      name: it.name,
      salesCents: it.cents,
      qty: it.qty,
      costCents,
      marginBps,
    };
  });
  const withCost = costItems.filter((c) => c.costCents != null).length;
  const coverage = costItems.length ? withCost / costItems.length : 0;

  const cbs = input.chargebacks.filter((c) => c.filedAt >= from && c.filedAt <= to);
  const lastPeriod = input.settlementPeriods[0];
  const hostCutCents = lastPeriod?.rows.reduce((s, r) => s + (r.hostCutCents || 0), 0) ?? 0;

  const clockedMap: Record<string, number> = {};
  for (const e of input.employees.filter((e) => e.active && e.clockedIn)) {
    clockedMap[e.role] = (clockedMap[e.role] ?? 0) + 1;
  }

  const aging = open
    .map((o) => ({
      id: o.id,
      number: o.number,
      minutes: Math.max(0, Math.round((now - o.createdAt) / 60000)),
      serverName: o.serverName,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 20);

  return {
    locationId: input.locationId,
    locationName: input.locationName,
    venueType: input.venueType,
    range: input.range,
    from,
    to,
    isDemo: input.isDemo,
    hostMulti,
    operatorId: op,
    serverId: srv,
    sales: {
      netCents,
      closedChecks: closed.length,
      openChecks: open.length,
      covers,
      avgCheckCents: closed.length ? Math.round(netCents / closed.length) : 0,
      byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, cents: byHour[hour] ?? 0 })),
      byDaypart: Object.entries(byDaypart).map(([part, v]) => ({ part, ...v })),
      byCategory: Object.entries(byCat)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 20),
      byItem: Object.values(byItem)
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 20),
      byChannel: Object.entries(byChannel).map(([channel, v]) => ({ channel, ...v })),
    },
    payments: {
      cardCents,
      cashCents,
      giftCents,
      otherCents,
      tipsCents,
      refundsCents,
      voidsCents,
      compsCents,
      cashDiscountCostCents,
      chargebacks: {
        count: cbs.length,
        feeCents: cbs.reduce((s, c) => s + (c.feeCents ?? 3500), 0),
      },
    },
    staff: {
      clocked: Object.entries(clockedMap).map(([role, count]) => ({ role, count })),
      byServer: Object.values(byServer).sort((a, b) => b.salesCents - a.salesCents),
      agingOpen: aging,
    },
    tickets: {
      kitchenAvgSec: avg(kit),
      barAvgSec: avg(bar),
      kitchenOpen: kit.filter((t) => t.status !== "bumped").length,
      barOpen: bar.filter((t) => t.status !== "bumped").length,
      kitchenReady: kit.filter((t) => t.status === "ready").length,
      eightySix: input.menuItems
        .filter((m) => m.available === false)
        .map((m) => ({ name: m.name, station: m.station })),
    },
    guest: {
      waitlistWaiting: wait.filter((w) => w.status === "waiting" || w.status === "notified").length,
      waitlistQuotedAvg: quotedAvg,
      waitlistSeated: seatedW.length,
      noShows:
        wait.filter((w) => w.status === "no_show").length +
        res.filter((r) => r.status === "no_show").length,
      reservations: res.length,
      checkedIn: res.filter((r) => r.status === "checked_in" || r.status === "seated").length,
      kioskOrders,
    },
    multiOp: {
      byOperator: Object.values(byOperator).sort((a, b) => b.cents - a.cents),
      hostCutCents,
      periodCount: input.settlementPeriods.length,
    },
    cost: {
      items: costItems.slice(0, 20),
      dataCoverage: coverage,
      note:
        coverage < 0.15
          ? "Insufficient cost data — recipe or inventory cost is missing on most items."
          : coverage < 0.6
            ? "Partial cost coverage from inventory links. Gaps are labeled, not invented."
            : "Cost from inventory links on sold items.",
    },
  };
}

export function csvFromRows(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
