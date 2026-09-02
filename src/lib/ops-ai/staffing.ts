import type { Employee, EmployeeRole, KitchenTicket, Order, Reservation, Table, WaitlistEntry } from "@/lib/pos/types";
import type { TimePunch } from "@/lib/pos/ops-types";
import { baseline30mFor } from "@/lib/ops-jobs/store";
import { daypartOf } from "./learn-store";

export const STAFFING_KINDS = ["recommend_cut", "recommend_hold", "recommend_add"] as const;
export type StaffingKind = (typeof STAFFING_KINDS)[number];

export const STAFFING_ROLES: EmployeeRole[] = [
  "server",
  "bartender",
  "host",
  "kitchen",
  "busser",
  "cashier",
];

export const STAFFING_NOTIFY = ["manager", "host", "expo"] as const;
export type StaffingNotifyRole = (typeof STAFFING_NOTIFY)[number];

export const STAFFING_DAYPARTS = ["morning", "lunch", "afternoon", "dinner", "late"] as const;

export type StaffingRecsConfig = {
  enabled: boolean;
  minHeadcount: Partial<Record<EmployeeRole, number>>;
  laborPctTarget: number;
  laborPctHighAlert: number;
  /** Cents of sales per clocked labor hour. */
  salesPerLaborHourFloorCents: number;
  idleMinutesBeforeCut: number;
  noCutOpenPaddingMinutes: number;
  noCutClosePaddingMinutes: number;
  rushLockDayparts: string[];
  typicalTurnMinutes: number;
  lookaheadMinutes: number;
  openTime: string;
  closeTime: string;
  hourlyProxyCents: number;
  notifyRoles: StaffingNotifyRole[];
  recommendAdd: boolean;
  addWaitlistThreshold: number;
  addQuotedWaitMinutes: number;
  addOdsDepth: number;
};

export const DEFAULT_STAFFING_RECS: StaffingRecsConfig = {
  enabled: true,
  minHeadcount: { server: 1, kitchen: 1, bartender: 0, host: 0, busser: 0, cashier: 0 },
  laborPctTarget: 25,
  laborPctHighAlert: 35,
  salesPerLaborHourFloorCents: 8000,
  idleMinutesBeforeCut: 20,
  noCutOpenPaddingMinutes: 45,
  noCutClosePaddingMinutes: 60,
  rushLockDayparts: ["lunch", "dinner"],
  typicalTurnMinutes: 75,
  lookaheadMinutes: 90,
  openTime: "11:00",
  closeTime: "22:00",
  hourlyProxyCents: 1800,
  notifyRoles: ["manager", "host"],
  recommendAdd: true,
  addWaitlistThreshold: 6,
  addQuotedWaitMinutes: 25,
  addOdsDepth: 8,
};

function int(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function hhmm(raw: unknown, fallback: string): string {
  const s = String(raw ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return fallback;
}

export function parseStaffingRecs(raw: unknown): StaffingRecsConfig {
  const d = DEFAULT_STAFFING_RECS;
  if (!raw || typeof raw !== "object") {
    return {
      ...d,
      minHeadcount: { ...d.minHeadcount },
      rushLockDayparts: [...d.rushLockDayparts],
      notifyRoles: [...d.notifyRoles],
    };
  }
  const o = raw as Record<string, unknown>;
  const minHeadcount: Partial<Record<EmployeeRole, number>> = { ...d.minHeadcount };
  if (o.minHeadcount && typeof o.minHeadcount === "object") {
    for (const role of STAFFING_ROLES) {
      const v = (o.minHeadcount as Record<string, unknown>)[role];
      if (v != null) minHeadcount[role] = int(v, minHeadcount[role] ?? 0, 0, 40);
    }
  }
  const rush = Array.isArray(o.rushLockDayparts)
    ? o.rushLockDayparts.map((x) => String(x)).filter((x) => STAFFING_DAYPARTS.includes(x as (typeof STAFFING_DAYPARTS)[number]))
    : d.rushLockDayparts;
  const notify: StaffingNotifyRole[] = [];
  const rawNotify = Array.isArray(o.notifyRoles) ? o.notifyRoles : String(o.notifyRoles ?? "").split(",");
  for (const x of rawNotify) {
    const s = String(x).trim() as StaffingNotifyRole;
    if ((STAFFING_NOTIFY as readonly string[]).includes(s) && !notify.includes(s)) notify.push(s);
  }
  return {
    enabled: o.enabled !== false,
    minHeadcount,
    laborPctTarget: int(o.laborPctTarget, d.laborPctTarget, 1, 80),
    laborPctHighAlert: int(o.laborPctHighAlert, d.laborPctHighAlert, 1, 90),
    salesPerLaborHourFloorCents: int(o.salesPerLaborHourFloorCents, d.salesPerLaborHourFloorCents, 0, 1_000_000),
    idleMinutesBeforeCut: int(o.idleMinutesBeforeCut, d.idleMinutesBeforeCut, 0, 240),
    noCutOpenPaddingMinutes: int(o.noCutOpenPaddingMinutes, d.noCutOpenPaddingMinutes, 0, 240),
    noCutClosePaddingMinutes: int(o.noCutClosePaddingMinutes, d.noCutClosePaddingMinutes, 0, 240),
    rushLockDayparts: rush.length ? rush : [...d.rushLockDayparts],
    typicalTurnMinutes: int(o.typicalTurnMinutes, d.typicalTurnMinutes, 15, 240),
    lookaheadMinutes: int(o.lookaheadMinutes, d.lookaheadMinutes, 0, 360),
    openTime: hhmm(o.openTime, d.openTime),
    closeTime: hhmm(o.closeTime, d.closeTime),
    hourlyProxyCents: int(o.hourlyProxyCents, d.hourlyProxyCents, 500, 20000),
    notifyRoles: notify.length ? notify : [...d.notifyRoles],
    recommendAdd: o.recommendAdd !== false,
    addWaitlistThreshold: int(o.addWaitlistThreshold, d.addWaitlistThreshold, 1, 80),
    addQuotedWaitMinutes: int(o.addQuotedWaitMinutes, d.addQuotedWaitMinutes, 0, 180),
    addOdsDepth: int(o.addOdsDepth, d.addOdsDepth, 1, 80),
  };
}

export function inNoCutWindow(
  cfg: StaffingRecsConfig,
  now = new Date(),
  daypart = daypartOf(now.getTime()),
): { locked: boolean; reason?: string } {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = cfg.openTime.split(":").map((x) => parseInt(x, 10));
  const [ch, cm] = cfg.closeTime.split(":").map((x) => parseInt(x, 10));
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const sinceOpen = nowMin - openMin;
  const untilClose = closeMin >= openMin ? closeMin - nowMin : closeMin + 24 * 60 - nowMin;
  if (sinceOpen >= 0 && sinceOpen < cfg.noCutOpenPaddingMinutes) {
    return { locked: true, reason: `Inside open padding (${cfg.noCutOpenPaddingMinutes} min)` };
  }
  if (untilClose >= 0 && untilClose < cfg.noCutClosePaddingMinutes) {
    return { locked: true, reason: `Inside close padding (${cfg.noCutClosePaddingMinutes} min)` };
  }
  if (cfg.rushLockDayparts.includes(daypart)) {
    return { locked: true, reason: `Rush lock (${daypart})` };
  }
  return { locked: false };
}

export type StaffingSnapshot = {
  daypart: string;
  now: number;
  clocked: { id: string; name: string; role: EmployeeRole; clockInAt: number; idleMinutes: number }[];
  byRole: Partial<Record<EmployeeRole, number>>;
  clockedHours: number;
  salesCents: number;
  salesLast30mCents: number;
  baseline30mCents: number;
  laborCostProxyCents: number;
  laborPct: number | null;
  splhCents: number | null;
  idleMinutes: number;
  idleTables: number;
  openChecks: number;
  odsOpen: number;
  odsMaxElapsedSec: number;
  waitlistWaiting: number;
  waitlistQuotedAvg: number;
  reservationsSoon: number;
  coversSoon: number;
  inNoCut: { locked: boolean; reason?: string };
};

export function orderSalesCents(o: Pick<Order, "payments">): number {
  return o.payments.reduce((s, p) => s + (p.amountCents || 0), 0);
}

export function salesInWindow(orders: Order[], from: number, to: number): number {
  let n = 0;
  for (const o of orders) {
    if (o.status === "voided" || o.status === "cancelled") continue;
    const at = o.closedAt ?? o.createdAt;
    if (at >= from && at < to) n += orderSalesCents(o);
  }
  return n;
}

/** Average 30-min sales in this daypart from earlier today (baseline). */
export function daypartBaseline30m(orders: Order[], now: number, daypart: string): number {
  const buckets: number[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  for (let t = t0; t + 30 * 60_000 < now; t += 30 * 60_000) {
    if (daypartOf(t) !== daypart) continue;
    buckets.push(salesInWindow(orders, t, t + 30 * 60_000));
  }
  if (buckets.length < 2) return 0;
  return Math.round(buckets.reduce((s, n) => s + n, 0) / buckets.length);
}

export type StaffingDecision = {
  kind: StaffingKind;
  role: EmployeeRole;
  reasons: string[];
  severity: "info" | "watch" | "urgent";
  message: string;
  suggestedAction: string;
};

export function decideStaffing(cfg: StaffingRecsConfig, snap: StaffingSnapshot): StaffingDecision[] {
  if (!cfg.enabled) return [];
  const out: StaffingDecision[] = [];
  const servers = snap.byRole.server ?? 0;
  const kitchen = snap.byRole.kitchen ?? 0;
  const minServer = cfg.minHeadcount.server ?? 0;
  const minKitchen = cfg.minHeadcount.kitchen ?? 0;
  const laborHigh =
    (snap.laborPct != null && snap.laborPct >= cfg.laborPctHighAlert) ||
    (snap.splhCents != null && snap.splhCents < cfg.salesPerLaborHourFloorCents && snap.clocked.length >= 2);
  const slowSales = snap.baseline30mCents > 0 && snap.salesLast30mCents < snap.baseline30mCents * 0.85;
  const idleCut = snap.idleMinutes >= cfg.idleMinutesBeforeCut && snap.openChecks <= Math.max(1, servers - 1);
  const odsHeavy = snap.odsOpen >= cfg.addOdsDepth || snap.odsMaxElapsedSec >= 12 * 60;
  const waitHeavy =
    snap.waitlistWaiting >= cfg.addWaitlistThreshold ||
    (snap.waitlistQuotedAvg >= cfg.addQuotedWaitMinutes && snap.waitlistWaiting >= 3);
  const lookaheadBusy = snap.coversSoon >= 8 || snap.reservationsSoon >= 3;

  const add =
    cfg.recommendAdd &&
    (waitHeavy || odsHeavy || (snap.baseline30mCents > 0 && snap.salesLast30mCents > snap.baseline30mCents * 1.25 && servers <= minServer));

  if (add) {
    const role: EmployeeRole = odsHeavy && kitchen <= (minKitchen || 1) + 1 ? "kitchen" : "server";
    const reasons = [
      waitHeavy ? `Waitlist ${snap.waitlistWaiting} (quoted ~${snap.waitlistQuotedAvg} min)` : "",
      odsHeavy ? `ODS ${snap.odsOpen} open, longest ${(snap.odsMaxElapsedSec / 60).toFixed(0)} min` : "",
      lookaheadBusy ? `Lookahead ${snap.reservationsSoon} reservations / ${snap.coversSoon} covers` : "",
      snap.salesLast30mCents > snap.baseline30mCents
        ? "Sales velocity above same-daypart baseline"
        : "",
    ].filter(Boolean);
    out.push({
      kind: "recommend_add",
      role,
      reasons,
      severity: waitHeavy || odsHeavy ? "urgent" : "watch",
      message: `Add ${role} — ${reasons[0] ?? "queue is building"}.`,
      suggestedAction: "Call or hold a shift. Recommendations only — the manager decides. Never auto clock-in.",
    });
  }

  const cutRole: EmployeeRole | null =
    (snap.byRole.server ?? 0) > minServer
      ? "server"
      : (snap.byRole.busser ?? 0) > (cfg.minHeadcount.busser ?? 0)
        ? "busser"
        : (snap.byRole.host ?? 0) > (cfg.minHeadcount.host ?? 0)
          ? "host"
          : (snap.byRole.bartender ?? 0) > (cfg.minHeadcount.bartender ?? 0)
            ? "bartender"
            : (snap.byRole.cashier ?? 0) > (cfg.minHeadcount.cashier ?? 0)
              ? "cashier"
              : kitchen > minKitchen && snap.odsOpen === 0
                ? "kitchen"
                : null;

  const canCut =
    !!cutRole &&
    laborHigh &&
    idleCut &&
    !odsHeavy &&
    !waitHeavy &&
    (slowSales || snap.baseline30mCents === 0) &&
    !snap.inNoCut.locked &&
    !lookaheadBusy;

  if (canCut && cutRole) {
    const reasons = [
      snap.laborPct != null ? `Labor proxy ${snap.laborPct.toFixed(0)}% (alert ${cfg.laborPctHighAlert}%)` : "",
      snap.splhCents != null ? `Sales/labor-hour ${formatDollars(snap.splhCents)} vs floor ${formatDollars(cfg.salesPerLaborHourFloorCents)}` : "",
      `Idle ${snap.idleMinutes} min with no tables/tickets (cut after ${cfg.idleMinutesBeforeCut})`,
      slowSales ? "Sales velocity below same-daypart baseline" : "Light sales vs headcount",
      `${cutRole}s on clock: ${snap.byRole[cutRole] ?? 0} (min ${cfg.minHeadcount[cutRole] ?? 0})`,
    ].filter(Boolean);
    out.push({
      kind: "recommend_cut",
      role: cutRole,
      reasons,
      severity: snap.laborPct != null && snap.laborPct >= cfg.laborPctHighAlert + 10 ? "urgent" : "watch",
      message: `Cut one ${cutRole} — ${reasons[0]}.`,
      suggestedAction:
        "Accept notifies them to close out when ready. It does not clock anyone out. Manager decides.",
    });
  } else if (laborHigh && !add) {
    const reasons = [
      snap.inNoCut.locked ? snap.inNoCut.reason : "",
      lookaheadBusy ? `Incoming ${snap.coversSoon} covers in ${cfg.lookaheadMinutes} min` : "",
      waitHeavy ? "Waitlist still up" : "",
      odsHeavy ? "ODS still deep" : "",
      !idleCut ? `Idle only ${snap.idleMinutes} min` : "",
      !cutRole ? "At minimum headcount" : "",
    ].filter((x): x is string => Boolean(x));
    out.push({
      kind: "recommend_hold",
      role: "server",
      reasons: reasons.length ? reasons : ["Labor is high but demand is not clearly falling"],
      severity: "info",
      message: `Hold staff — ${reasons[0] ?? "mixed signals"}.`,
      suggestedAction: "Do not cut yet. Recommendations only — the manager decides.",
    });
  }

  const hasAdd = out.some((d) => d.kind === "recommend_add");
  const hasCut = out.some((d) => d.kind === "recommend_cut");
  if (hasAdd && hasCut) {
    return [
      {
        kind: "recommend_hold",
        role: "server",
        reasons: ["Add and cut both fired — holding"],
        severity: "info",
        message: "Hold staff — demand and labor signals conflict.",
        suggestedAction: "Do not cut or add yet. Recommendations only — the manager decides.",
      },
    ];
  }
  return out.slice(0, 3);
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function idleMinutesFor(
  emp: { id: string; clockInAt?: number },
  lastTicketByEmployee: Record<string, number>,
  tables: Table[],
  now: number,
): number {
  const hasOpenTable = tables.some(
    (t) => t.serverId === emp.id && t.status !== "available" && t.status !== "dirty" && t.status !== "closed_not_cleaned",
  );
  if (hasOpenTable) return 0;
  const last = lastTicketByEmployee[emp.id] ?? emp.clockInAt ?? now;
  return Math.max(0, Math.round((now - last) / 60_000));
}

export function clockedHoursFromPunches(punches: TimePunch[], now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  let minutes = 0;
  for (const p of punches) {
    if (p.status === "rejected") continue;
    const a = Math.max(p.clockInAt, from);
    const b = Math.min(p.clockOutAt ?? now, now);
    if (b > a) minutes += (b - a) / 60_000;
  }
  return minutes / 60;
}

export function upcomingCovers(
  reservations: Reservation[],
  waitlist: WaitlistEntry[],
  now: number,
  lookaheadMinutes: number,
  typicalTurnMinutes: number,
): { reservationsSoon: number; coversSoon: number } {
  const until = now + lookaheadMinutes * 60_000;
  let resN = 0;
  let covers = 0;
  for (const r of reservations) {
    if (r.status === "cancelled" || r.status === "no_show" || r.status === "seated") continue;
    const at = r.at ?? r.time ?? 0;
    if (at >= now && at <= until) {
      resN += 1;
      covers += r.partySize || 0;
    }
  }
  const waiting = waitlist.filter((w) => w.status === "waiting" || w.status === "notified");
  covers += waiting.reduce((s, w) => s + (w.partySize || 0), 0);
  if (typicalTurnMinutes > 0 && waiting.length) {
    covers += Math.round(waiting.length * (60 / typicalTurnMinutes));
  }
  return { reservationsSoon: resN, coversSoon: covers };
}

export function odsStats(tickets: KitchenTicket[]): { open: number; maxElapsed: number } {
  const open = tickets.filter((t) => t.status === "new" || t.status === "in_progress" || t.status === "ready");
  const maxElapsed = open.reduce((m, t) => Math.max(m, t.elapsedSec || 0), 0);
  return { open: open.length, maxElapsed };
}

export function buildStaffingSnapshot(input: {
  cfg: StaffingRecsConfig;
  now?: number;
  employees: Employee[];
  punches: TimePunch[];
  orders: Order[];
  tables: Table[];
  tickets: KitchenTicket[];
  waitlist: WaitlistEntry[];
  reservations: Reservation[];
  lastTicketByEmployee: Record<string, number>;
  shiftSalesCents: number;
  shiftOpenedAt: number;
}): StaffingSnapshot {
  const now = input.now ?? Date.now();
  const daypart = daypartOf(now);
  const clockedEmps = input.employees.filter((e) => e.active && e.clockedIn);
  const clocked = clockedEmps.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    clockInAt: e.clockInAt ?? now,
    idleMinutes: idleMinutesFor(e, input.lastTicketByEmployee, input.tables, now),
  }));
  const byRole: Partial<Record<EmployeeRole, number>> = {};
  for (const c of clocked) byRole[c.role] = (byRole[c.role] ?? 0) + 1;
  const hours = Math.max(clockedHoursFromPunches(input.punches, now), clocked.length * 0.25);
  const salesLast30mCents = salesInWindow(input.orders, now - 30 * 60_000, now);
  let baseline30mCents = daypartBaseline30m(input.orders, now, daypart);
  if (baseline30mCents <= 0) {
    baseline30mCents = baseline30mFor(daypart);
  }
  if (baseline30mCents <= 0) {
    const shiftHours = Math.max(0.5, (now - (input.shiftOpenedAt || now)) / 3_600_000);
    baseline30mCents = Math.round((input.shiftSalesCents / shiftHours) * 0.5);
  }
  const laborCostProxyCents = Math.round(hours * cfgHourly(input.cfg));
  const salesCents = Math.max(input.shiftSalesCents, salesLast30mCents);
  const laborPct = salesCents > 0 ? Math.round((laborCostProxyCents / salesCents) * 10000) / 100 : clocked.length > 2 ? 80 : null;
  const splhCents = hours > 0 ? Math.round(salesCents / hours) : null;
  const idleMinutes = clocked.length ? Math.max(...clocked.map((c) => c.idleMinutes)) : 0;
  const waiting = input.waitlist.filter((w) => w.status === "waiting" || w.status === "notified");
  const quoted = waiting.length
    ? Math.round(waiting.reduce((s, w) => s + (w.quotedMinutes || 0), 0) / waiting.length)
    : 0;
  const ods = odsStats(input.tickets);
  const look = upcomingCovers(input.reservations, input.waitlist, now, input.cfg.lookaheadMinutes, input.cfg.typicalTurnMinutes);
  return {
    daypart,
    now,
    clocked,
    byRole,
    clockedHours: hours,
    salesCents,
    salesLast30mCents,
    baseline30mCents,
    laborCostProxyCents,
    laborPct,
    splhCents,
    idleMinutes,
    idleTables: input.tables.filter((t) => t.status === "available").length,
    openChecks: input.orders.filter((o) => o.status === "open").length,
    odsOpen: ods.open,
    odsMaxElapsedSec: ods.maxElapsed,
    waitlistWaiting: waiting.length,
    waitlistQuotedAvg: quoted,
    reservationsSoon: look.reservationsSoon,
    coversSoon: look.coversSoon,
    inNoCut: inNoCutWindow(input.cfg, new Date(now), daypart),
  };
}

function cfgHourly(cfg: StaffingRecsConfig): number {
  return Math.max(500, cfg.hourlyProxyCents);
}
