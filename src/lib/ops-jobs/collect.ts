import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useCostStore } from "@/lib/costs/store";
import { salesQtyByMenuItem, theoreticalUse } from "@/lib/costs/theoretical";
import { DEFAULT_TARGET_COST_PCT } from "@/lib/costs/types";
import { computePayPeriod, parseLaborRules } from "@/lib/labor/rules";
import { daypartOf, useOpsLearnStore } from "@/lib/ops-ai/learn-store";
import { buildShiftRecommendations } from "@/lib/ops-ai/engine";
import { daypartBaseline30m, salesInWindow } from "@/lib/ops-ai/staffing";
import { CHARGEBACK_FEE_CENTS } from "@/lib/platform/brand";
import { drawerExpected, useCashSessionStore } from "@/lib/pos/cash-session";
import {
  buildNightlyIntegrityPack,
  tableEmptyWithOpenCheck,
  tableOccupiedNoCheck,
} from "@/lib/pos/check-integrity";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
import { liabilityByIssuer } from "@/lib/pos/gift-issuer";
import { parseLossPrevention } from "@/lib/pos/loss-prevention";
import { useNetworkStore } from "@/lib/pos/network-store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import type { Vendor } from "@/lib/pos/types";
import { isHouseOpen, parseOpsJobsConfig } from "./config";
import type {
  DaypartBaseline,
  JobCadence,
  OpsEntityKind,
  OpsJobFacts,
  OpsJobRow,
  OpsJobsConfig,
} from "./types";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const PRINTER_STALE_MS = 15 * 60_000;
const DEVICE_MONTH_MS = 14 * DAY;

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekdayOf(ms: number): number {
  return new Date(ms).getDay();
}

export function operatorKind(v: Vendor): OpsEntityKind {
  if (v.stationType === "bar") return "bar";
  if (v.stationType === "kitchen") return "food";
  const blob = `${v.name} ${v.shortName} ${v.cuisine} ${v.stationLabel}`.toLowerCase();
  if (/steam|bar|distill|liquor|well|wine|tap|pour/.test(blob)) return "bar";
  if (/diamond|food|kitchen|grill|plate|house/.test(blob)) return "food";
  return "other";
}

function costCatsFor(kind: OpsEntityKind): string[] | null {
  if (kind === "bar") return ["liquor", "beer", "wine"];
  if (kind === "food") return ["food"];
  return null;
}

function row(
  type: OpsJobRow["type"],
  severity: OpsJobRow["severity"],
  subject: string,
  suggestedAction: string,
  extra?: Partial<OpsJobRow>,
): OpsJobRow {
  return { type, severity, subject, suggestedAction, ...extra };
}

function lineNet(o: {
  lines: { voided: boolean; comped: boolean; quantity: number; unitPriceCents: number; discountCents: number }[];
}): number {
  let n = 0;
  for (const l of o.lines) {
    if (l.voided) continue;
    n += Math.max(0, l.quantity * l.unitPriceCents - (l.discountCents || 0));
  }
  return n;
}

export function collectOpsJobFacts(
  cadence: JobCadence,
  now = Date.now(),
): OpsJobFacts {
  const pos = usePosStore.getState();
  const cfg = parseOpsJobsConfig(pos.settings.opsJobs);
  const lp = parseLossPrevention(pos.settings.lossPrevention);
  const labor = parseLaborRules(useOpsStore.getState().labor);
  const staffing = labor.staffingRecs;
  const cost = useCostStore.getState();
  const cash = useCashSessionStore.getState();
  const closeouts = useCloseoutStore.getState().records;
  const net = useNetworkStore.getState();
  const learn = useOpsLearnStore.getState().events;
  const vendors = pos.vendors.filter((v) => v.active);
  const dayStart = startOfLocalDay(now);
  const hourAgo = now - HOUR;
  const weekAgo = now - 7 * DAY;
  const weekday = weekdayOf(now);
  const seedRows: OpsJobRow[] = [];
  const dataGaps: string[] = [];

  const openOrders = pos.orders.filter((o) => o.status === "open");
  const todayOrders = pos.orders.filter((o) => (o.closedAt ?? o.createdAt) >= dayStart);
  const hourAudit = (pos.auditLog ?? []).filter((a) => a.at >= hourAgo);
  const todayAudit = (pos.auditLog ?? []).filter((a) => a.at >= dayStart);

  const integrity = buildNightlyIntegrityPack({
    tables: pos.tables,
    orders: pos.orders,
    employees: pos.employees,
    auditLog: pos.auditLog,
    cfg: lp,
    now,
  });

  const occupiedNoCheck = pos.tables.filter((t) => tableOccupiedNoCheck(t, pos.orders)).length;
  const emptyOpen = pos.tables.filter((t) => tableEmptyWithOpenCheck(t, pos.orders)).length;
  const holds = openOrders.filter((o) => o.holdKind).length;

  if (cadence === "service_hourly" || cadence === "nightly") {
    for (const issue of integrity.slice(0, 20)) {
      seedRows.push(
        row(
          "floor_integrity",
          issue.kind === "cash_not_closed" || issue.kind === "late_comp_cash" ? "urgent" : "watch",
          issue.detail,
          "Review the nightly pack. Do not drop the check.",
        ),
      );
    }
    if (occupiedNoCheck) {
      seedRows.push(
        row(
          "floor_integrity",
          "watch",
          `${occupiedNoCheck} occupied table(s) with no check`,
          "Open a check or correct table status.",
        ),
      );
    }
    if (emptyOpen) {
      seedRows.push(
        row(
          "floor_integrity",
          "urgent",
          `${emptyOpen} empty/dirty table(s) still have an open check`,
          "Park as Left to close or transfer to a named server.",
        ),
      );
    }
  }

  const recPack = buildShiftRecommendations({});
  const laborRecs = recPack.recs.filter(
    (r) =>
      r.type === "recommend_cut" || r.type === "recommend_hold" || r.type === "recommend_add",
  );
  if (cadence === "service_hourly") {
    for (const r of laborRecs.slice(0, 8)) {
      seedRows.push(
        row(
          "labor_pulse",
          r.severity,
          r.message,
          `${r.suggestedAction} Recommendations only — never auto clock-out.`,
        ),
      );
    }
    const voids = hourAudit.filter((a) => a.action === "void").length;
    const comps = hourAudit.filter((a) => a.action === "comp").length;
    const noSales = hourAudit.filter((a) => a.action === "no_sale").length;
    const reopens = hourAudit.filter((a) => a.action === "reopen" || a.action === "tender_change").length;
    const giftAdj = hourAudit.filter((a) => a.action === "gift_adjust").length;
    if (voids || comps || noSales || reopens || giftAdj) {
      seedRows.push(
        row(
          "gate_feed",
          voids + comps + giftAdj >= 3 ? "watch" : "info",
          `Last hour: ${voids} void(s), ${comps} comp(s), ${noSales} no-sale(s), ${reopens} reopen/swap(s), ${giftAdj} gift adjust(s)`,
          "Manager devices: review live feed. Flag for the queue — not a verdict.",
        ),
      );
    }
    const giftHour = pos.giftCards.flatMap((c) => (c.ledger ?? []).filter((e) => e.at >= hourAgo));
    const loads = giftHour.filter((e) => e.kind === "issue" || e.kind === "reload");
    const redeems = giftHour.filter((e) => e.kind === "redeem");
    const adjusts = giftHour.filter((e) => e.kind === "adjust");
    if (loads.length + redeems.length + adjusts.length >= 4) {
      seedRows.push(
        row(
          "gift_burst",
          "watch",
          `Gift burst last hour: ${loads.length} load, ${redeems.length} redeem, ${adjusts.length} adjust`,
          "Confirm load has cash or card on the ticket. Adjusts are manager-only.",
        ),
      );
    }
  }

  const printers = (pos.locationDevices ?? []).filter((d) => d.type === "printer");
  const lanPrinters = printers.filter((d) => d.print?.connection === "lan");
  const unreachable = lanPrinters.filter((d) => now - (d.lastSeenAt || 0) > PRINTER_STALE_MS);
  const lanPeers = net.peers ?? [];
  const stalePeers = lanPeers.filter((p) => p.kind === "printer" && now - p.lastSeenAt > PRINTER_STALE_MS);
  if ((cadence === "service_hourly" || cadence === "monthly") && (unreachable.length || stalePeers.length)) {
    const names = [
      ...unreachable.map((d) => d.label),
      ...stalePeers.map((p) => p.name),
    ];
    seedRows.push(
      row(
        cadence === "monthly" ? "device_unseen" : "printer",
        "watch",
        `Ethernet printer(s) not seen: ${names.slice(0, 6).join(", ") || "unnamed"}`,
        "Check AP LAN (not printer Wi‑Fi). Kitchen impact is Epson TM-U220; receipts TM-T20.",
      ),
    );
  }

  const drawers = Object.values(cash.drawers ?? {});
  const banks = Object.values(cash.banks ?? {});
  const overShortDrawers = drawers
    .filter((d) => d.countedCents != null)
    .map((d) => ({
      id: d.drawerId,
      overShort: (d.countedCents ?? 0) - drawerExpected(d),
    }));
  const overShortBanks = banks
    .filter((b) => b.countedCents != null)
    .map((b) => ({
      id: b.employeeId,
      overShort: (b.countedCents ?? 0) - ((b.startCents || 0) + (b.cashSalesCents || 0) - (b.dropsCents || 0) + (b.paidInCents || 0) - (b.paidOutCents || 0) - (b.cashRefundsCents || 0)),
    }));

  if (cadence === "nightly" || cadence === "weekly") {
    for (const d of overShortDrawers) {
      if (Math.abs(d.overShort) < 50) continue;
      seedRows.push(
        row(
          cadence === "weekly" ? "drawer_trend" : "blind_count",
          Math.abs(d.overShort) >= cfg.exceptionDollarCents ? "watch" : "info",
          `Drawer ${d.id} over/short ${d.overShort >= 0 ? "+" : ""}${(d.overShort / 100).toFixed(2)}`,
          "Blind count vs expected. Review — do not accuse.",
          { amountCents: d.overShort },
        ),
      );
    }
    for (const b of overShortBanks) {
      if (Math.abs(b.overShort) < 50) continue;
      const emp = pos.employees.find((e) => e.id === b.id);
      seedRows.push(
        row(
          "blind_count",
          "watch",
          `Server bank ${emp?.name ?? b.id} over/short ${b.overShort >= 0 ? "+" : ""}${(b.overShort / 100).toFixed(2)}`,
          "Compare declared vs expected. Queue for review.",
          { amountCents: b.overShort },
        ),
      );
    }
  }

  const todayClose = closeouts.filter((c) => c.at >= dayStart);
  if (cadence === "nightly" || cadence === "pay_period") {
    for (const c of todayClose.slice(0, 12)) {
      const declared = c.cashTipsDeclaredCents;
      const card = c.cardTipsCents;
      const recTip = c.tipOuts.reduce((s, t) => s + t.recommendedCents, 0);
      const actTip = c.tipOuts.reduce((s, t) => s + t.actualCents, 0);
      if (Math.abs(declared - card) > cfg.exceptionDollarCents || Math.abs(recTip - actTip) > 100) {
        seedRows.push(
          row(
            "tips",
            "watch",
            `${c.employeeName}: declared cash tips $${(declared / 100).toFixed(2)} vs card $${(card / 100).toFixed(2)}; tip-out rec $${(recTip / 100).toFixed(2)} vs actual $${(actTip / 100).toFixed(2)}`,
            "CC tips cash-at-close vs paycheck per labor rules. Summex does not process payroll.",
            { amountCents: declared - card },
          ),
        );
      }
    }
  }

  const closedToday = todayOrders.filter((o) => o.status === "closed");
  const tenderMix = { card: 0, cash: 0, gift: 0, other: 0 };
  for (const o of closedToday) {
    for (const p of o.payments) {
      if (p.method === "card") tenderMix.card += p.amountCents;
      else if (p.method === "cash") tenderMix.cash += p.amountCents;
      else if (p.method === "gift_card") tenderMix.gift += p.amountCents;
      else tenderMix.other += p.amountCents;
    }
  }
  const tenderTotal = tenderMix.card + tenderMix.cash + tenderMix.gift + tenderMix.other;
  const houseCashPct = tenderTotal > 0 ? (tenderMix.cash / tenderTotal) * 100 : 0;

  if (cadence === "nightly" || cadence === "weekly") {
    const byEmp = new Map<string, { name: string; cash: number; card: number; voids: number; comps: number; sales: number }>();
    const ensure = (id: string, name: string) => {
      let r = byEmp.get(id);
      if (!r) {
        r = { name, cash: 0, card: 0, voids: 0, comps: 0, sales: 0 };
        byEmp.set(id, r);
      }
      return r;
    };
    for (const o of closedToday) {
      const r = ensure(o.serverId, o.serverName);
      r.sales += lineNet(o);
      for (const p of o.payments) {
        if (p.method === "cash") r.cash += p.amountCents;
        if (p.method === "card") r.card += p.amountCents;
      }
      for (const l of o.lines) {
        if (l.voided) r.voids += l.quantity * l.unitPriceCents;
        if (l.comped) r.comps += l.quantity * l.unitPriceCents;
      }
    }
    const sameWeekday = pos.orders.filter(
      (o) => o.status === "closed" && o.closedAt && weekdayOf(o.closedAt) === weekday && o.closedAt < dayStart,
    );
    const wdVoids = sameWeekday.reduce(
      (s, o) => s + o.lines.filter((l) => l.voided).reduce((n, l) => n + l.quantity * l.unitPriceCents, 0),
      0,
    );
    const wdSales = sameWeekday.reduce((s, o) => s + lineNet(o), 0);
    const wdVoidPct = wdSales > 0 ? (wdVoids / wdSales) * 100 : 0;
    for (const r of byEmp.values()) {
      const cashPct = r.cash + r.card > 0 ? (r.cash / (r.cash + r.card)) * 100 : 0;
      const voidPct = r.sales > 0 ? (r.voids / r.sales) * 100 : 0;
      const compPct = r.sales > 0 ? (r.comps / r.sales) * 100 : 0;
      if (houseCashPct > 0 && cashPct > houseCashPct * 2 && r.cash > cfg.exceptionDollarCents) {
        seedRows.push(
          row(
            "tender_mix",
            "watch",
            `${r.name} cash mix ${cashPct.toFixed(0)}% vs house ${houseCashPct.toFixed(0)}%`,
            "Flag vs house mix. Review queue — not a verdict.",
            { pct: cashPct, amountCents: r.cash },
          ),
        );
      }
      if (voidPct >= cfg.exceptionPct && r.voids >= cfg.exceptionDollarCents) {
        seedRows.push(
          row(
            "void_comp",
            "watch",
            `${r.name} voids $${(r.voids / 100).toFixed(2)} (${voidPct.toFixed(1)}%) vs this weekday ${wdVoidPct.toFixed(1)}%`,
            "Compare to same weekday. Queue for review.",
            { pct: voidPct, amountCents: r.voids },
          ),
        );
      }
      if (compPct >= cfg.exceptionPct && r.comps >= cfg.exceptionDollarCents) {
        seedRows.push(
          row(
            "void_comp",
            "watch",
            `${r.name} comps $${(r.comps / 100).toFixed(2)} (${compPct.toFixed(1)}%)`,
            "Compare to same weekday. Queue for review.",
            { pct: compPct, amountCents: r.comps },
          ),
        );
      }
    }
  }

  const cardPays = closedToday.flatMap((o) => o.payments.filter((p) => p.method === "card"));
  const captureCents = cardPays.reduce((s, p) => s + p.amountCents, 0);
  const lineOwnerCents = closedToday.reduce((s, o) => {
    for (const l of o.lines) {
      if (l.voided) continue;
      s += Math.max(0, l.quantity * l.unitPriceCents - (l.discountCents || 0));
    }
    return s;
  }, 0);
  if (cadence === "nightly") {
    if (!cardPays.length) {
      dataGaps.push("No Quantum Payments captures in this window — not inventing Finix or Visa charges.");
    } else {
      seedRows.push(
        row(
          "capture_split",
          Math.abs(captureCents - lineOwnerCents) > cfg.exceptionDollarCents ? "watch" : "info",
          `Quantum capture $${(captureCents / 100).toFixed(2)} vs line-owner $${(lineOwnerCents / 100).toFixed(2)}`,
          "Guest cards are Quantum Payments only. Gift is the Summex ledger, not the card.",
          { amountCents: captureCents - lineOwnerCents },
        ),
      );
    }
    const giftTender = tenderMix.gift;
    seedRows.push(
      row(
        "capture_split",
        "info",
        `Gift tendered $${(giftTender / 100).toFixed(2)} vs card $${(tenderMix.card / 100).toFixed(2)}`,
        "Gift ledger vs Quantum card — two rails. Do not invent processor charges.",
        { amountCents: giftTender },
      ),
    );
  }

  const salesRules = {
    includeVoids: cfg.theoreticalIncludeVoids,
    includeComps: cfg.theoreticalIncludeComps,
  };
  const salesQty = salesQtyByMenuItem(pos.orders, dayStart, now, null, salesRules);
  const theo = theoreticalUse({
    recipes: cost.recipes,
    skus: cost.skus,
    sales: salesQty,
  });
  const postedToday = cost.invoices.filter(
    (i) => i.status === "posted" && (i.postedAt ?? i.date) >= dayStart,
  );
  const wasteToday = cost.waste.filter((w) => w.at >= dayStart);
  const eightySix = pos.menuItems.filter((m) => m.available === false);

  function costFlashFor(entityId: string | null, kind: OpsEntityKind, name: string) {
    const cats = costCatsFor(kind);
    const skus = cost.skus.filter((s) => {
      if (entityId && entityId !== HOST_SCOPE && s.entityId && s.entityId !== entityId && s.entityId !== HOST_SCOPE) {
        return kind === "host";
      }
      if (cats && !cats.includes(s.category)) return false;
      if (kind === "bar" && entityId && s.entityId && s.entityId !== entityId && s.entityId !== HOST_SCOPE) {
        return /bar|liquor|steam/i.test(s.entityId + s.name);
      }
      return true;
    });
    let theoCents = 0;
    let purchCents = 0;
    const varianceSkus: { name: string; theo: number; purch: number }[] = [];
    for (const sku of skus) {
      const packs = theo[sku.id] ?? 0;
      const tCents = Math.round(packs * (sku.costCents || 0));
      theoCents += tCents;
      const purch = postedToday
        .filter((inv) => !entityId || entityId === HOST_SCOPE || inv.entityId === entityId)
        .flatMap((inv) => inv.lines)
        .filter((ln) => ln.skuId === sku.id)
        .reduce((s, ln) => s + ln.qty * ln.unitCostCents, 0);
      purchCents += purch;
      if (Math.abs(packs * (sku.costCents || 0) - purch) > cfg.exceptionDollarCents) {
        varianceSkus.push({ name: sku.name, theo: tCents, purch });
      }
    }
    const salesCents = pos.orders
      .filter((o) => (o.closedAt ?? o.createdAt) >= dayStart && o.status === "closed")
      .reduce((s, o) => {
        for (const l of o.lines) {
          if (l.voided && !cfg.theoreticalIncludeVoids) continue;
          if (l.comped && !cfg.theoreticalIncludeComps) continue;
          if (entityId && entityId !== HOST_SCOPE && l.vendorId && l.vendorId !== entityId) continue;
          if (kind === "bar" && l.station !== "bar" && entityId) continue;
          if (kind === "food" && l.station !== "kitchen" && entityId) continue;
          s += Math.max(0, l.quantity * l.unitPriceCents - (l.discountCents || 0));
        }
        return s;
      }, 0);
    const costPct = salesCents > 0 ? (theoCents / salesCents) * 100 : null;
    const target = kind === "bar" ? cfg.liquorCostTargetPct : kind === "food" ? cfg.foodCostTargetPct : cfg.foodCostTargetPct;
    return { theoCents, purchCents, salesCents, costPct, target, varianceSkus: varianceSkus.slice(0, 8) };
  }

  const houseCost = costFlashFor(null, "host", pos.settings.name);
  if (cadence === "nightly" || cadence === "weekly" || cadence === "monthly") {
    if (!cost.recipes.length) dataGaps.push("No recipes mapped — theoretical use is empty.");
    if (!postedToday.length && cadence === "nightly") {
      dataGaps.push("No invoices posted today — purchase vs theoretical is incomplete.");
    }
    if (houseCost.costPct != null && houseCost.costPct > houseCost.target) {
      seedRows.push(
        row(
          "cost_flash",
          "watch",
          `Theoretical cost ${houseCost.costPct.toFixed(1)}% vs target ${houseCost.target}% (food ${cfg.foodCostTargetPct}% / liquor ${cfg.liquorCostTargetPct}%)`,
          "Count SKU, confirm waste, change par, change pour/plate, or change menu price. Never accuse staff.",
          { pct: houseCost.costPct, amountCents: houseCost.theoCents },
        ),
      );
    }
    for (const v of houseCost.varianceSkus.slice(0, 6)) {
      seedRows.push(
        row(
          "menu_recipe",
          "watch",
          `${v.name}: theoretical $${(v.theo / 100).toFixed(2)} vs invoices posted $${(v.purch / 100).toFixed(2)}`,
          "Confirm waste or count. Do not write that someone took product.",
          { amountCents: v.theo - v.purch },
        ),
      );
    }
    if (wasteToday.length) {
      seedRows.push(
        row(
          "cost_flash",
          "info",
          `${wasteToday.length} waste log(s) today`,
          "Confirm waste entries against 86 board.",
        ),
      );
    }
    if (eightySix.length) {
      seedRows.push(
        row(
          "cost_flash",
          "info",
          `86 board: ${eightySix.map((m) => m.name).slice(0, 8).join(", ")}`,
          "Confirm 86 vs theoretical use and waste logs.",
        ),
      );
    }
  }

  if (cadence === "nightly") {
    const accepts = learn.filter((e) => e.at >= dayStart && e.action === "accept").length;
    const dismisses = learn.filter((e) => e.at >= dayStart && e.action === "dismiss").length;
    const volume = closedToday.length;
    seedRows.push(
      row(
        "staffing_postmortem",
        "info",
        `Staffing recs today: ${accepts} accepted, ${dismisses} dismissed vs ${volume} closed checks`,
        "Recommendations only. Accept is not a clock-out.",
      ),
    );
    const remaining = integrity.length;
    seedRows.push(
      row(
        "house_close",
        remaining ? "watch" : "info",
        remaining
          ? `${remaining} nightly pack item(s) remain. House Z is ${lp.nightCloseMode === "hard_block" ? "hard-blocked" : "manager-ack"}`
          : "Nightly pack is clear.",
        lp.nightCloseMode === "hard_block"
          ? "Clear remaining exceptions before house Z."
          : "Manager may acknowledge remaining exceptions with a reason.",
      ),
    );
  }

  if (cadence === "weekly") {
    const weekOrders = pos.orders.filter((o) => (o.closedAt ?? o.createdAt) >= weekAgo && o.status === "closed");
    const roleBuckets = new Map<string, { voids: number; comps: number; cash: number; sales: number; names: string[] }>();
    for (const o of weekOrders) {
      const emp = pos.employees.find((e) => e.id === o.serverId);
      const role = emp?.role ?? "server";
      let b = roleBuckets.get(role);
      if (!b) {
        b = { voids: 0, comps: 0, cash: 0, sales: 0, names: [] };
        roleBuckets.set(role, b);
      }
      if (!b.names.includes(o.serverName)) b.names.push(o.serverName);
      b.sales += lineNet(o);
      b.voids += o.lines.filter((l) => l.voided).reduce((s, l) => s + l.quantity * l.unitPriceCents, 0);
      b.comps += o.lines.filter((l) => l.comped).reduce((s, l) => s + l.quantity * l.unitPriceCents, 0);
      b.cash += o.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amountCents, 0);
    }
    for (const [role, b] of roleBuckets) {
      if (b.names.length < 2) continue;
      seedRows.push(
        row(
          "peer_compare",
          "info",
          `${role}: ${b.names.length} teammates · voids $${(b.voids / 100).toFixed(2)} · comps $${(b.comps / 100).toFixed(2)} · cash $${(b.cash / 100).toFixed(2)}`,
          "Peer flags only vs teammates in the same role. Not a write-up.",
        ),
      );
    }
    const byDaypart: Record<string, { sales: number; hours: number }> = {};
    for (const o of weekOrders) {
      const dp = daypartOf(o.closedAt ?? o.createdAt);
      byDaypart[dp] ??= { sales: 0, hours: 0 };
      byDaypart[dp].sales += lineNet(o);
    }
    const punches = useOpsStore.getState().punches ?? [];
    for (const p of punches) {
      const t = p.clockInAt;
      if (t < weekAgo) continue;
      const dp = daypartOf(t);
      byDaypart[dp] ??= { sales: 0, hours: 0 };
      const out = p.clockOutAt ?? now;
      byDaypart[dp].hours += Math.max(0, (out - t) / 3_600_000);
    }
    for (const [dp, v] of Object.entries(byDaypart)) {
      seedRows.push(
        row(
          "schedule_vs_sales",
          "info",
          `${dp}: sales $${(v.sales / 100).toFixed(0)} · labor hours ${v.hours.toFixed(1)}`,
          "Compare published schedule to daypart volume.",
          { amountCents: v.sales },
        ),
      );
    }
    const liab = liabilityByIssuer(pos.giftCards, pos.settings, vendors);
    for (const L of liab) {
      const aging = pos.giftCards.filter((c) => {
        if (c.issuerId && c.issuerId !== L.issuerId) return false;
        const issued = c.issuedAt ?? 0;
        return c.balanceCents > 0 && issued > 0 && now - issued > 90 * DAY;
      }).length;
      seedRows.push(
        row(
          "gift_liability",
          L.outstandingCents > 0 ? "info" : "info",
          `${L.issuerName} outstanding $${(L.outstandingCents / 100).toFixed(2)} · ${aging} card(s) older than 90 days`,
          "Gift is the Summex ledger by issuer entity — not Quantum/Finix.",
          { amountCents: L.outstandingCents, entityId: L.issuerId, entityName: L.issuerName },
        ),
      );
    }
    const trainingLeft = pos.orders.filter(
      (o) =>
        o.status === "open" &&
        (pos.settings.lifecycleStatus === "training" || o.payments.some((p) => p.sandbox)),
    );
    if (trainingLeft.length) {
      seedRows.push(
        row(
          "training_leftover",
          "watch",
          `${trainingLeft.length} training-mode check(s) still open`,
          "Close or void training leftovers before go-live. Sandbox cards only.",
        ),
      );
    }
  }

  if (cadence === "pay_period") {
    const period = computePayPeriod(now, labor);
    const punches = (useOpsStore.getState().punches ?? []).filter(
      (p) => p.clockInAt >= period.start && p.clockInAt <= period.end,
    );
    const approved = punches.filter((p) => p.status === "approved" || p.status === "auto_approved");
    const hours = punches.reduce((s, p) => {
      const out = p.clockOutAt ?? now;
      return s + Math.max(0, (out - p.clockInAt) / 3_600_000);
    }, 0);
    const ccPaycheck = closeouts
      .filter((c) => c.at >= period.start && c.at <= period.end)
      .reduce((s, c) => s + (c.cardTipsToPayrollCents || 0), 0);
    const cashAtClose = closeouts
      .filter((c) => c.at >= period.start && c.at <= period.end)
      .reduce((s, c) => s + (c.cardTipsCashDueCents || 0) + (c.declaredCashDueCents || 0), 0);
    seedRows.push(
      row(
        "pay_period",
        "info",
        `Pay period ${period.startIso}–${period.endIso}: ${hours.toFixed(1)} hours, ${approved.length}/${punches.length} punches approved. CC tips on paycheck $${(ccPaycheck / 100).toFixed(2)} vs cash-at-close $${(cashAtClose / 100).toFixed(2)}`,
        "Export ADP / Intuit / CSV only. Summex is not the payroll processor.",
        { amountCents: ccPaycheck },
      ),
    );
    const notes = closeouts
      .filter((c) => c.at >= period.start && (c.overShortNote || c.pendingReason))
      .slice(0, 8);
    for (const n of notes) {
      seedRows.push(
        row(
          "pay_period",
          "info",
          `${n.employeeName}: ${n.overShortNote || n.pendingReason || "exception note"}`,
          "Attach to the hours export. Do not invent processor charges.",
        ),
      );
    }
  }

  const daypartBaselines: DaypartBaseline[] = [];
  if (cadence === "monthly") {
    for (const dp of ["morning", "lunch", "afternoon", "dinner", "late"]) {
      const sales30 = daypartBaseline30m(pos.orders, now, dp);
      const windowSales = salesInWindow(pos.orders, now - 30 * DAY, now);
      daypartBaselines.push({
        daypart: dp,
        sales30mCents: sales30,
        laborPct: windowSales > 0 ? cfg.laborPctTarget : null,
        updatedAt: now,
      });
    }
    seedRows.push(
      row(
        "baseline",
        "info",
        "Daypart sales/labor baselines refreshed for staffing recs",
        "Staffing still recommends cut / hold / add only. Never auto clock-out.",
      ),
    );
    const monthOrders = pos.orders.filter(
      (o) => (o.closedAt ?? o.createdAt) >= now - 30 * DAY && o.status === "closed",
    );
    const persistent = { voids: 0, noSales: 0, lateComp: 0, giftAdj: 0 };
    persistent.noSales = (pos.auditLog ?? []).filter(
      (a) => a.at >= now - 30 * DAY && a.action === "no_sale",
    ).length;
    persistent.giftAdj = (pos.auditLog ?? []).filter(
      (a) => a.at >= now - 30 * DAY && a.action === "gift_adjust",
    ).length;
    persistent.lateComp = (pos.auditLog ?? []).filter(
      (a) => a.at >= now - 30 * DAY && a.action === "late_comp_cash",
    ).length;
    persistent.voids = monthOrders.reduce(
      (s, o) => s + o.lines.filter((l) => l.voided).reduce((n, l) => n + l.quantity * l.unitPriceCents, 0),
      0,
    );
    seedRows.push(
      row(
        "risk_digest",
        persistent.voids > cfg.exceptionDollarCents * 4 ? "watch" : "info",
        `30-day digest: voids $${(persistent.voids / 100).toFixed(0)}, ${persistent.noSales} no-sale(s), ${persistent.lateComp} late-comp cash, ${persistent.giftAdj} gift adjust(s)`,
        "Review queue, not verdicts. Never accuse theft.",
        { amountCents: persistent.voids },
      ),
    );

    const priceCreep: { name: string; last: number; prev: number }[] = [];
    for (const sku of cost.skus) {
      const posted = cost.invoices
        .filter((i) => i.status === "posted")
        .sort((a, b) => (a.postedAt ?? a.date) - (b.postedAt ?? b.date));
      const lines = posted.flatMap((i) =>
        i.lines.filter((l) => l.skuId === sku.id).map((l) => ({ at: i.postedAt ?? i.date, cost: l.unitCostCents })),
      );
      if (lines.length < 2) continue;
      const last = lines[lines.length - 1];
      const prev = lines[lines.length - 2];
      if (prev.cost > 0 && last.cost > prev.cost * 1.05) {
        priceCreep.push({ name: sku.name, last: last.cost, prev: prev.cost });
      }
    }
    for (const c of priceCreep.slice(0, 8)) {
      seedRows.push(
        row(
          "vendor_cost",
          "watch",
          `${c.name} invoice price $${(c.last / 100).toFixed(2)} vs prior $${(c.prev / 100).toFixed(2)}`,
          "Purchased vs theoretical by SKU. Confirm map, then par or menu price.",
          { amountCents: c.last - c.prev },
        ),
      );
    }

    const cbs = pos.chargebacks ?? [];
    const monthCb = cbs.filter((c) => c.filedAt >= now - 30 * DAY);
    const feeTotal = monthCb.reduce((s, c) => s + (c.feeCents || 0), 0);
    const periods = pos.settlementPeriods ?? [];
    const monthFees = periods
      .filter((p) => p.closedAt >= now - 30 * DAY)
      .reduce((s, p) => s + (p.cardFeesTotalCents || 0), 0);
    if (!monthCb.length && !monthFees) {
      dataGaps.push(
        "No Quantum settlement fees or chargebacks in this window — not inventing Finix or Visa charges.",
      );
    } else {
      seedRows.push(
        row(
          "processor_fees",
          "info",
          `Quantum card fees posted $${(monthFees / 100).toFixed(2)}; chargebacks ${monthCb.length} with $${(feeTotal / 100).toFixed(2)} in $35 splits (house fee ${CHARGEBACK_FEE_CENTS / 100})`,
          "$35 dispute fee splits by line mix on that check. Guest cards are Quantum Payments only.",
          { amountCents: monthFees + feeTotal },
        ),
      );
    }

    const cashOn = Boolean(pos.settings.cashDiscountEnabled);
    const itemSales = new Map<string, { name: string; qty: number; sales: number; cost: number }>();
    for (const o of monthOrders) {
      for (const l of o.lines) {
        if (l.voided) continue;
        const rec = cost.recipes.find((r) => r.menuItemId === l.menuItemId || r.menuItemIds?.includes(l.menuItemId));
        let recipeCost = 0;
        if (rec) {
          for (const ln of rec.lines) {
            const sku = cost.skus.find((s) => s.id === ln.skuId);
            if (sku) recipeCost += (ln.qty / Math.max(1, rec.yieldQty)) * sku.costCents * (1 + (rec.wasteFactor || 0));
          }
        }
        const cur = itemSales.get(l.menuItemId) ?? { name: l.name, qty: 0, sales: 0, cost: 0 };
        cur.qty += l.quantity;
        cur.sales += l.quantity * l.unitPriceCents - (l.discountCents || 0);
        cur.cost += recipeCost * l.quantity;
        itemSales.set(l.menuItemId, cur);
      }
    }
    const ranked = [...itemSales.values()].sort((a, b) => b.sales - a.sales);
    const stars = ranked.slice(0, 3);
    const dogs = ranked.filter((x) => x.qty > 0).slice(-3);
    for (const s of stars) {
      const margin = s.sales > 0 ? ((s.sales - s.cost) / s.sales) * 100 : null;
      seedRows.push(
        row(
          "menu_engineering",
          "info",
          `Star: ${s.name} · $${(s.sales / 100).toFixed(0)} · margin ${margin == null ? "n/a" : margin.toFixed(0)}%${cashOn ? " (card price; cash discount on)" : ""}`,
          cashOn
            ? "Margin uses printed/card price. Cash discount is a separate tender path."
            : "Keep or promote. Price recs still require a human Save.",
          { pct: margin, amountCents: s.sales },
        ),
      );
    }
    for (const s of dogs) {
      if (stars.some((x) => x.name === s.name)) continue;
      seedRows.push(
        row(
          "menu_engineering",
          "info",
          `Dog: ${s.name} · qty ${s.qty} · $${(s.sales / 100).toFixed(0)}`,
          "Review pour/plate or price. Never auto-change the menu.",
          { amountCents: s.sales },
        ),
      );
    }

    seedRows.push(
      row(
        "hr_packet",
        "info",
        "If HR packets are enabled, review due dates on HR",
        "This job does not invent I-9 or tax dates. Open HR for packet status.",
      ),
    );

    const devices = pos.locationDevices ?? [];
    const unseen = devices.filter((d) => now - (d.lastSeenAt || 0) > DEVICE_MONTH_MS);
    if (unseen.length) {
      seedRows.push(
        row(
          "device_unseen",
          "watch",
          `${unseen.length} device(s)/printer(s) not seen in 14 days: ${unseen
            .slice(0, 5)
            .map((d) => d.label)
            .join(", ")}`,
          "Retire, re-claim, or check the AP LAN.",
        ),
      );
    }
  }

  const entityFacts = vendors.map((v) => {
    const kind = operatorKind(v);
    const flash = costFlashFor(v.id, kind, v.shortName || v.name);
    const sales = todayOrders
      .filter((o) => o.status === "closed")
      .reduce((s, o) => {
        for (const l of o.lines) {
          if (l.vendorId && l.vendorId !== v.id) continue;
          if (kind === "bar" && l.station !== "bar" && l.vendorId !== v.id) continue;
          if (l.voided && !cfg.theoreticalIncludeVoids) continue;
          s += Math.max(0, l.quantity * l.unitPriceCents - (l.discountCents || 0));
        }
        return s;
      }, 0);
    if (cadence === "nightly" || cadence === "weekly") {
      if (kind === "bar" || kind === "food") {
        seedRows.push(
          row(
            "cost_flash",
            flash.costPct != null && flash.costPct > flash.target ? "watch" : "info",
            `${v.shortName || v.name} (${kind}): sales $${(sales / 100).toFixed(0)} · theoretical cost ${
              flash.costPct == null ? "n/a" : flash.costPct.toFixed(1) + "%"
            } vs target ${flash.target}%`,
            kind === "bar"
              ? "Steam-style bar scope: liquor/beer/wine vs bar sales."
              : "Diamond-style food scope: food SKUs vs kitchen sales.",
            { entityId: v.id, entityName: v.shortName || v.name, pct: flash.costPct, amountCents: sales },
          ),
        );
      }
    }
    return {
      id: v.id,
      name: v.shortName || v.name,
      kind,
      facts: {
        salesCents: sales,
        theoreticalCostCents: flash.theoCents,
        invoicesPostedCents: flash.purchCents,
        costPct: flash.costPct,
        targetPct: flash.target,
      },
    };
  });

  const clocked = pos.employees.filter((e) => e.clockedIn);
  const ods = pos.tickets.filter((t) => t.status !== "bumped");
  const wait = pos.waitlist.filter((w) => w.status === "waiting" || w.status === "notified");
  const soon = pos.reservations.filter((r) => {
    const t = r.at ?? r.time ?? 0;
    return t >= now && t <= now + staffing.lookaheadMinutes * 60_000;
  });

  const house: Record<string, unknown> = {
    openChecks: openOrders.length,
    occupiedNoCheck,
    emptyOpenCheck: emptyOpen,
    holdBuckets: holds,
    clocked: clocked.length,
    minStaff: cfg.minStaff,
    laborPctTarget: cfg.laborPctTarget,
    laborRecs: laborRecs.map((r) => ({
      kind: r.staffingKind,
      message: r.message,
      role: r.targetRole,
    })),
    odsOpen: ods.length,
    waitlist: wait.length,
    reservationsSoon: soon.length,
    rushLock: cfg.rushLockDayparts,
    tenderMix,
    captureCents,
    giftTenderCents: tenderMix.gift,
    cost: houseCost,
    wasteToday: wasteToday.length,
    eightySix: eightySix.map((m) => m.name),
    printersUnreachable: unreachable.map((d) => d.label),
    integrityCount: integrity.length,
    nightCloseMode: lp.nightCloseMode ?? cfg.houseCloseMode,
    theoreticalRules: salesRules,
    defaultCostTargets: DEFAULT_TARGET_COST_PCT,
  };

  return {
    cadence,
    generatedAt: now,
    location: {
      id: pos.tenantLocationId || "loc",
      name: pos.settings.name,
      timezone: pos.settings.timezone || "America/Los_Angeles",
      open: isHouseOpen(cfg, new Date(now)),
      lifecycle: pos.settings.lifecycleStatus || "live",
    },
    config: {
      laborPctTarget: cfg.laborPctTarget,
      foodCostTargetPct: cfg.foodCostTargetPct,
      liquorCostTargetPct: cfg.liquorCostTargetPct,
      exceptionDollarCents: cfg.exceptionDollarCents,
      exceptionPct: cfg.exceptionPct,
      exceptionIdleMinutes: cfg.exceptionIdleMinutes,
      houseCloseMode: lp.nightCloseMode ?? cfg.houseCloseMode,
      minStaff: cfg.minStaff,
      rushLockDayparts: cfg.rushLockDayparts,
      theoreticalIncludeVoids: cfg.theoreticalIncludeVoids,
      theoreticalIncludeComps: cfg.theoreticalIncludeComps,
    },
    house,
    entities: entityFacts,
    seedRows: seedRows.slice(0, 40),
    daypartBaselines: daypartBaselines.length ? daypartBaselines : undefined,
    dataGaps,
  };
}

export function resolvedOpsJobsConfig(): OpsJobsConfig {
  return parseOpsJobsConfig(usePosStore.getState().settings.opsJobs);
}
