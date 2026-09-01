import type {
  CadenceSchedule,
  JobCadence,
  OpsJobsConfig,
  OpsNotifyRole,
} from "./types";
import { JOB_CADENCES } from "./types";

export const DEFAULT_OPS_JOBS: OpsJobsConfig = {
  enabled: true,
  cadences: {
    service_hourly: { enabled: true, hour: 0, weekday: 1, dayOfMonth: 1 },
    nightly: { enabled: true, hour: 3, weekday: 1, dayOfMonth: 1 },
    weekly: { enabled: true, hour: 6, weekday: 1, dayOfMonth: 1 },
    pay_period: { enabled: true, hour: 7, weekday: 1, dayOfMonth: 1 },
    monthly: { enabled: true, hour: 7, weekday: 1, dayOfMonth: 1 },
  },
  notifyRoles: ["owner", "manager"],
  notifyEmail: "",
  openTime: "11:00",
  closeTime: "22:00",
  laborPctTarget: 25,
  foodCostTargetPct: 28,
  liquorCostTargetPct: 18,
  exceptionDollarCents: 2500,
  exceptionPct: 8,
  exceptionIdleMinutes: 45,
  houseCloseMode: "ack",
  minStaff: 2,
  rushLockDayparts: ["lunch", "dinner"],
  theoreticalIncludeVoids: false,
  theoreticalIncludeComps: true,
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

const NOTIFY: OpsNotifyRole[] = ["owner", "manager", "host", "accountant"];
const DAYPARTS = ["morning", "lunch", "afternoon", "dinner", "late"];

function parseCadence(raw: unknown, fallback: CadenceSchedule): CadenceSchedule {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    hour: int(o.hour, fallback.hour, 0, 23),
    weekday: int(o.weekday, fallback.weekday, 0, 6),
    dayOfMonth: int(o.dayOfMonth, fallback.dayOfMonth, 1, 28),
  };
}

export function parseOpsJobsConfig(raw: unknown): OpsJobsConfig {
  const d = DEFAULT_OPS_JOBS;
  if (!raw || typeof raw !== "object") {
    return {
      ...d,
      cadences: {
        service_hourly: { ...d.cadences.service_hourly },
        nightly: { ...d.cadences.nightly },
        weekly: { ...d.cadences.weekly },
        pay_period: { ...d.cadences.pay_period },
        monthly: { ...d.cadences.monthly },
      },
      notifyRoles: [...d.notifyRoles],
      rushLockDayparts: [...d.rushLockDayparts],
    };
  }
  const o = raw as Record<string, unknown>;
  const cadRaw =
    o.cadences && typeof o.cadences === "object"
      ? (o.cadences as Record<string, unknown>)
      : {};
  const cadences = {} as OpsJobsConfig["cadences"];
  for (const c of JOB_CADENCES) {
    cadences[c] = parseCadence(cadRaw[c], d.cadences[c]);
  }
  const notify: OpsNotifyRole[] = [];
  const rawNotify = Array.isArray(o.notifyRoles)
    ? o.notifyRoles
    : String(o.notifyRoles ?? "").split(",");
  for (const x of rawNotify) {
    const s = String(x).trim() as OpsNotifyRole;
    if ((NOTIFY as readonly string[]).includes(s) && !notify.includes(s)) notify.push(s);
  }
  const rush = Array.isArray(o.rushLockDayparts)
    ? o.rushLockDayparts.map((x) => String(x)).filter((x) => DAYPARTS.includes(x))
    : d.rushLockDayparts;
  return {
    enabled: o.enabled !== false,
    cadences,
    notifyRoles: notify.length ? notify : [...d.notifyRoles],
    notifyEmail: String(o.notifyEmail ?? d.notifyEmail).trim().slice(0, 180),
    openTime: hhmm(o.openTime, d.openTime),
    closeTime: hhmm(o.closeTime, d.closeTime),
    laborPctTarget: int(o.laborPctTarget, d.laborPctTarget, 1, 80),
    foodCostTargetPct: int(o.foodCostTargetPct, d.foodCostTargetPct, 1, 80),
    liquorCostTargetPct: int(o.liquorCostTargetPct, d.liquorCostTargetPct, 1, 80),
    exceptionDollarCents: int(o.exceptionDollarCents, d.exceptionDollarCents, 0, 1_000_000),
    exceptionPct: int(o.exceptionPct, d.exceptionPct, 0, 100),
    exceptionIdleMinutes: int(o.exceptionIdleMinutes, d.exceptionIdleMinutes, 5, 1440),
    houseCloseMode: o.houseCloseMode === "hard_block" ? "hard_block" : "ack",
    minStaff: int(o.minStaff, d.minStaff, 0, 80),
    rushLockDayparts: rush.length ? rush : [...d.rushLockDayparts],
    theoreticalIncludeVoids: o.theoreticalIncludeVoids === true,
    theoreticalIncludeComps: o.theoreticalIncludeComps !== false,
  };
}

export function isHouseOpen(cfg: OpsJobsConfig, now = new Date()): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = cfg.openTime.split(":").map((x) => parseInt(x, 10));
  const [ch, cm] = cfg.closeTime.split(":").map((x) => parseInt(x, 10));
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (closeMin === openMin) return true;
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin;
}

export function fireKeyFor(cadence: JobCadence, at = new Date(), extra = ""): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  const h = String(at.getHours()).padStart(2, "0");
  if (cadence === "service_hourly") return `service_hourly:${y}-${m}-${d}-${h}${extra}`;
  if (cadence === "nightly") return `nightly:${y}-${m}-${d}${extra}`;
  if (cadence === "weekly") {
    const onejan = new Date(at.getFullYear(), 0, 1);
    const week = Math.ceil(((at.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `weekly:${y}-W${String(week).padStart(2, "0")}${extra}`;
  }
  if (cadence === "monthly") return `monthly:${y}-${m}${extra}`;
  return `pay_period:${y}-${m}-${d}${extra}`;
}

export function shouldFireCadence(
  cadence: JobCadence,
  cfg: OpsJobsConfig,
  lastFired: Partial<Record<JobCadence, string>> | Record<string, string>,
  now = new Date(),
): { fire: boolean; key: string } {
  const sched = cfg.cadences[cadence];
  const key = fireKeyFor(cadence, now);
  if (!cfg.enabled || !sched.enabled) return { fire: false, key };
  if (lastFired[cadence] === key) return { fire: false, key };
  if (cadence === "service_hourly") {
    return { fire: isHouseOpen(cfg, now), key };
  }
  if (cadence === "nightly") {
    return { fire: now.getHours() === sched.hour, key };
  }
  if (cadence === "weekly") {
    return { fire: now.getDay() === sched.weekday && now.getHours() === sched.hour, key };
  }
  if (cadence === "monthly") {
    return {
      fire: now.getDate() === sched.dayOfMonth && now.getHours() === sched.hour,
      key,
    };
  }
  return { fire: now.getHours() === sched.hour, key };
}
