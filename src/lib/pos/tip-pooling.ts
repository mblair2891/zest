import type { EmployeeRole, Order } from "./types";
import type { TimePunch } from "./ops-types";
import type { CcTipPayout } from "./cash-handling";

export const TIP_POOL_MODES = [
  "individual",
  "individual_plus_tipout",
  "foh_pool",
  "bar_pool",
  "team_pool",
  "dual_pool",
] as const;
export type TipPoolMode = (typeof TIP_POOL_MODES)[number];

export const POOL_CONTRIBUTIONS = [
  "card_tips",
  "cash_declared",
  "both",
  "percent_of_tips",
  "percent_of_sales",
] as const;
export type PoolContribution = (typeof POOL_CONTRIBUTIONS)[number];

export const POOL_SPLITS = ["hours", "points", "equal", "sales", "manual"] as const;
export type PoolSplit = (typeof POOL_SPLITS)[number];

export const POOL_SETTLES = ["end_of_shift", "end_of_pay_period"] as const;
export type PoolSettle = (typeof POOL_SETTLES)[number];

export const AUTOGRAT_DESTS = ["stays_with_server", "enters_pool", "split_custom"] as const;
export type AutogratDest = (typeof AUTOGRAT_DESTS)[number];

export const SERVICE_CHARGE_DESTS = ["house", "percent_to_staff_pool"] as const;
export type ServiceChargeDest = (typeof SERVICE_CHARGE_DESTS)[number];

export const BAR_POOL_SCOPES = ["all_wells", "per_well"] as const;
export type BarPoolScope = (typeof BAR_POOL_SCOPES)[number];

export const TIP_POOL_STAFF_ROLES: EmployeeRole[] = [
  "server",
  "bartender",
  "host",
  "busser",
  "cashier",
  "kitchen",
];

export const FOH_POOL_ROLES: EmployeeRole[] = ["server", "host", "busser", "cashier"];
export const BAR_POOL_ROLES: EmployeeRole[] = ["bartender"];
export const TEAM_POOL_ROLES: EmployeeRole[] = ["server", "bartender", "host", "busser", "cashier"];

export const TIP_POOL_MODE_LABEL: Record<TipPoolMode, string> = {
  individual: "Individual — keep own tips",
  individual_plus_tipout: "Individual + mix-based tip-out",
  foh_pool: "FOH pool",
  bar_pool: "Bar pool",
  team_pool: "Team pool",
  dual_pool: "Dual pool (food vs drink)",
};

export const TIP_POOL_MODE_BLURB: Record<TipPoolMode, string> = {
  individual: "Each person keeps their own tips. No house pool.",
  individual_plus_tipout: "Keep own tips after mix-based tip-outs to kitchen, bar, host, busser.",
  foh_pool: "Front-of-house tips share one pool (servers, hosts, bussers, cashiers).",
  bar_pool: "Bartender tips share a pool — all wells together, or each well on its own.",
  team_pool: "One pool for every included role on the floor.",
  dual_pool: "Food-line tips pool to FOH; drink-line tips pool to bar, from ticket line ownership.",
};

export type TipPoolingConfig = {
  mode: TipPoolMode;
  barPoolScope: BarPoolScope;
  contribution: PoolContribution;
  contributionPercent: number;
  split: PoolSplit;
  settle: PoolSettle;
  autogratDest: AutogratDest;
  autogratPoolPercent: number;
  serviceChargeDest: ServiceChargeDest;
  serviceChargeToPoolPercent: number;
  /** Service charge is never labeled a tip unless this is on. */
  serviceChargeTreatAsTip: boolean;
  rolePoints: Partial<Record<EmployeeRole, number>>;
  includeRoles: EmployeeRole[];
  excludeRoles: EmployeeRole[];
  excludeManagers: boolean;
};

export const DEFAULT_ROLE_POINTS: Partial<Record<EmployeeRole, number>> = {
  server: 1,
  bartender: 1,
  host: 0.5,
  busser: 0.5,
  cashier: 0.5,
  kitchen: 0.25,
};

export const DEFAULT_TIP_POOLING: TipPoolingConfig = {
  mode: "individual_plus_tipout",
  barPoolScope: "all_wells",
  contribution: "both",
  contributionPercent: 100,
  split: "hours",
  settle: "end_of_shift",
  autogratDest: "stays_with_server",
  autogratPoolPercent: 50,
  serviceChargeDest: "house",
  serviceChargeToPoolPercent: 0,
  serviceChargeTreatAsTip: false,
  rolePoints: { ...DEFAULT_ROLE_POINTS },
  includeRoles: [...TEAM_POOL_ROLES],
  excludeRoles: ["owner", "manager", "accountant", "kiosk", "vendor_operator"],
  excludeManagers: true,
};

function asMode(raw: unknown): TipPoolMode | null {
  const s = String(raw ?? "");
  return (TIP_POOL_MODES as readonly string[]).includes(s) ? (s as TipPoolMode) : null;
}

function asRole(raw: unknown): EmployeeRole | null {
  const s = String(raw ?? "");
  const roles: EmployeeRole[] = [
    "owner",
    "manager",
    "server",
    "bartender",
    "host",
    "kitchen",
    "busser",
    "cashier",
    "vendor_operator",
    "accountant",
    "kiosk",
  ];
  return roles.includes(s as EmployeeRole) ? (s as EmployeeRole) : null;
}

function rolesList(raw: unknown, fallback: EmployeeRole[]): EmployeeRole[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: EmployeeRole[] = [];
  for (const x of raw.slice(0, 16)) {
    const r = asRole(x);
    if (r && !out.includes(r)) out.push(r);
  }
  return out.length ? out : [...fallback];
}

export function parseTipPooling(raw: unknown): TipPoolingConfig {
  const d = DEFAULT_TIP_POOLING;
  if (!raw || typeof raw !== "object") return { ...d, includeRoles: [...d.includeRoles], excludeRoles: [...d.excludeRoles], rolePoints: { ...d.rolePoints } };
  const o = raw as Record<string, unknown>;
  const mode = asMode(o.mode) ?? d.mode;
  const rolePoints: Partial<Record<EmployeeRole, number>> = { ...d.rolePoints };
  if (o.rolePoints && typeof o.rolePoints === "object") {
    for (const [k, v] of Object.entries(o.rolePoints as Record<string, unknown>)) {
      const r = asRole(k);
      if (!r) continue;
      const n = Number(v);
      if (Number.isFinite(n)) rolePoints[r] = Math.min(10, Math.max(0, n));
    }
  }
  return {
    mode,
    barPoolScope: o.barPoolScope === "per_well" ? "per_well" : "all_wells",
    contribution: (POOL_CONTRIBUTIONS as readonly string[]).includes(String(o.contribution))
      ? (o.contribution as PoolContribution)
      : d.contribution,
    contributionPercent: Math.min(100, Math.max(0, Number(o.contributionPercent) || 0)) || d.contributionPercent,
    split: (POOL_SPLITS as readonly string[]).includes(String(o.split)) ? (o.split as PoolSplit) : d.split,
    settle: o.settle === "end_of_pay_period" ? "end_of_pay_period" : "end_of_shift",
    autogratDest: (AUTOGRAT_DESTS as readonly string[]).includes(String(o.autogratDest))
      ? (o.autogratDest as AutogratDest)
      : d.autogratDest,
    autogratPoolPercent: Math.min(100, Math.max(0, Number(o.autogratPoolPercent) || 0)),
    serviceChargeDest: o.serviceChargeDest === "percent_to_staff_pool" ? "percent_to_staff_pool" : "house",
    serviceChargeToPoolPercent: Math.min(100, Math.max(0, Number(o.serviceChargeToPoolPercent) || 0)),
    serviceChargeTreatAsTip: Boolean(o.serviceChargeTreatAsTip),
    rolePoints,
    includeRoles: rolesList(o.includeRoles, includeRolesForMode(mode)),
    excludeRoles: rolesList(o.excludeRoles, d.excludeRoles),
    excludeManagers: o.excludeManagers !== false,
  };
}

export type TipPoolingSetting = TipPoolingConfig | "inherit";

export function parseTipPoolingSetting(raw: unknown): TipPoolingSetting {
  if (raw === "inherit" || raw == null || raw === "") return "inherit";
  if (typeof raw === "object") return parseTipPooling(raw);
  return "inherit";
}

export function resolveTipPooling(
  location: TipPoolingConfig,
  ...overrides: Array<TipPoolingSetting | null | undefined>
): TipPoolingConfig {
  for (const o of overrides) {
    if (o && o !== "inherit") return o;
  }
  return location;
}

export function includeRolesForMode(mode: TipPoolMode): EmployeeRole[] {
  if (mode === "bar_pool") return [...BAR_POOL_ROLES];
  if (mode === "foh_pool") return [...FOH_POOL_ROLES];
  if (mode === "dual_pool") return [...TEAM_POOL_ROLES];
  if (mode === "team_pool") return [...TEAM_POOL_ROLES];
  return [...TEAM_POOL_ROLES];
}

export function poolingActive(cfg: TipPoolingConfig): boolean {
  return cfg.mode === "foh_pool" || cfg.mode === "bar_pool" || cfg.mode === "team_pool" || cfg.mode === "dual_pool";
}

export function tipOutWithMode(cfg: TipPoolingConfig): boolean {
  return cfg.mode === "individual_plus_tipout" || poolingActive(cfg);
}

export function roleInPool(cfg: TipPoolingConfig, role: string): boolean {
  const r = role as EmployeeRole;
  if (cfg.excludeManagers && (r === "manager" || r === "owner")) return false;
  if (cfg.excludeRoles.includes(r)) return false;
  if (cfg.includeRoles.length && !cfg.includeRoles.includes(r)) return false;
  return true;
}

export function routeAutograt(cfg: TipPoolingConfig, autogratCents: number): { own: number; pool: number } {
  const n = Math.max(0, autogratCents);
  if (!n) return { own: 0, pool: 0 };
  if (cfg.autogratDest === "enters_pool" && poolingActive(cfg)) return { own: 0, pool: n };
  if (cfg.autogratDest === "split_custom" && poolingActive(cfg)) {
    const pool = Math.round((n * cfg.autogratPoolPercent) / 100);
    return { own: n - pool, pool };
  }
  return { own: n, pool: 0 };
}

export function routeServiceCharge(
  cfg: TipPoolingConfig,
  serviceChargeCents: number,
): { house: number; pool: number; labeledTip: boolean } {
  const n = Math.max(0, serviceChargeCents);
  if (!n || cfg.serviceChargeDest === "house" || !poolingActive(cfg)) {
    return { house: n, pool: 0, labeledTip: false };
  }
  const pool = Math.round((n * cfg.serviceChargeToPoolPercent) / 100);
  return { house: n - pool, pool, labeledTip: cfg.serviceChargeTreatAsTip };
}

export function contributionFromTips(cfg: TipPoolingConfig, opts: {
  cardTipsCents: number;
  declaredCents: number;
  salesCents: number;
  tipOutsCents: number;
}): number {
  if (!poolingActive(cfg)) return 0;
  const card = Math.max(0, opts.cardTipsCents);
  const cash = Math.max(0, opts.declaredCents);
  const tips = card + cash;
  const pct = Math.max(0, cfg.contributionPercent) / 100;
  let base = 0;
  if (cfg.contribution === "card_tips") base = card;
  else if (cfg.contribution === "cash_declared") base = cash;
  else if (cfg.contribution === "both") base = tips;
  else if (cfg.contribution === "percent_of_tips") base = Math.round(tips * pct);
  else base = Math.round(Math.max(0, opts.salesCents) * pct);
  if (cfg.contribution !== "percent_of_sales") {
    base = Math.max(0, base - Math.max(0, opts.tipOutsCents));
  }
  return base;
}

export type PoolParticipant = {
  employeeId: string;
  name: string;
  role: string;
  hours: number;
  salesCents: number;
  wellId?: string | null;
};

export function punchHours(punches: TimePunch[], employeeId: string, from: number, to: number, now = Date.now()): number {
  let minutes = 0;
  for (const p of punches) {
    if (p.employeeId !== employeeId) continue;
    if (p.status === "rejected") continue;
    const start = Math.max(p.clockInAt, from);
    const end = Math.min(p.clockOutAt ?? now, to);
    if (end > start) minutes += (end - start) / 60_000;
  }
  return minutes / 60;
}

export function participantWeight(cfg: TipPoolingConfig, p: PoolParticipant): number {
  if (cfg.split === "equal" || cfg.split === "manual") return 1;
  if (cfg.split === "hours") return Math.max(0, p.hours);
  if (cfg.split === "sales") return Math.max(0, p.salesCents);
  const pts = cfg.rolePoints[p.role as EmployeeRole] ?? 0;
  const hours = p.hours > 0 ? p.hours : 1;
  return Math.max(0, pts * hours);
}

function allocate(total: number, weights: { id: string; w: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  const sum = weights.reduce((s, x) => s + x.w, 0);
  if (total <= 0 || !weights.length) {
    for (const x of weights) out[x.id] = 0;
    return out;
  }
  if (sum <= 0) {
    const each = Math.floor(total / weights.length);
    let rem = total - each * weights.length;
    weights.forEach((x, i) => {
      out[x.id] = each + (i === weights.length - 1 ? rem : 0);
    });
    return out;
  }
  let used = 0;
  weights.forEach((x, i) => {
    const n = i === weights.length - 1 ? total - used : Math.round((total * x.w) / sum);
    out[x.id] = n;
    used += n;
  });
  return out;
}

export type PoolKey = "foh" | "bar" | "team" | `well:${string}` | "food" | "drink";

export function poolKeysForMode(cfg: TipPoolingConfig, wellId?: string | null): PoolKey[] {
  if (cfg.mode === "foh_pool") return ["foh"];
  if (cfg.mode === "team_pool") return ["team"];
  if (cfg.mode === "dual_pool") return ["food", "drink"];
  if (cfg.mode === "bar_pool") {
    if (cfg.barPoolScope === "per_well") return wellId ? [`well:${wellId}`] : ["bar"];
    return ["bar"];
  }
  return [];
}

export function dualMixShare(foodCents: number, drinkCents: number): { food: number; drink: number } {
  const t = Math.max(0, foodCents) + Math.max(0, drinkCents);
  if (t <= 0) return { food: 0.5, drink: 0.5 };
  return { food: foodCents / t, drink: drinkCents / t };
}

export type PoolContributionRow = {
  employeeId: string;
  poolKey: PoolKey;
  cents: number;
};

export function contributionsForPerson(
  cfg: TipPoolingConfig,
  opts: {
    employeeId: string;
    role: string;
    cardTipsCents: number;
    declaredCents: number;
    salesCents: number;
    foodSalesCents: number;
    drinkSalesCents: number;
    tipOutsCents: number;
    autogratCents: number;
    serviceChargeCents: number;
    wellId?: string | null;
  },
): { rows: PoolContributionRow[]; ownAutogratCents: number; poolAutogratCents: number; scPoolCents: number; scHouseCents: number } {
  const ag = routeAutograt(cfg, opts.autogratCents);
  const sc = routeServiceCharge(cfg, opts.serviceChargeCents);
  const tipContrib = contributionFromTips(cfg, {
    cardTipsCents: opts.cardTipsCents,
    declaredCents: opts.declaredCents,
    salesCents: opts.salesCents,
    tipOutsCents: opts.tipOutsCents,
  });
  const extraPool = ag.pool + sc.pool;
  const rows: PoolContributionRow[] = [];
  if (!poolingActive(cfg) || !roleInPool(cfg, opts.role)) {
    return { rows, ownAutogratCents: ag.own, poolAutogratCents: ag.pool, scPoolCents: sc.pool, scHouseCents: sc.house };
  }
  const totalIn = tipContrib + extraPool;
  if (cfg.mode === "dual_pool") {
    const mix = dualMixShare(opts.foodSalesCents, opts.drinkSalesCents);
    const food = Math.round(totalIn * mix.food);
    rows.push({ employeeId: opts.employeeId, poolKey: "food", cents: food });
    rows.push({ employeeId: opts.employeeId, poolKey: "drink", cents: totalIn - food });
  } else {
    const keys = poolKeysForMode(cfg, opts.wellId);
    const key = keys[0] ?? "team";
    rows.push({ employeeId: opts.employeeId, poolKey: key, cents: totalIn });
  }
  return { rows, ownAutogratCents: ag.own, poolAutogratCents: ag.pool, scPoolCents: sc.pool, scHouseCents: sc.house };
}

export function participantsForPool(
  cfg: TipPoolingConfig,
  poolKey: PoolKey,
  people: PoolParticipant[],
): PoolParticipant[] {
  return people.filter((p) => {
    if (!roleInPool(cfg, p.role)) return false;
    if (poolKey === "foh" || poolKey === "food") {
      return p.role !== "bartender" || cfg.mode === "team_pool";
    }
    if (poolKey === "bar" || poolKey === "drink") {
      return cfg.mode === "dual_pool" || cfg.mode === "bar_pool" || cfg.mode === "team_pool"
        ? cfg.mode === "dual_pool"
          ? p.role === "bartender"
          : cfg.mode === "bar_pool"
            ? p.role === "bartender"
            : true
        : p.role === "bartender";
    }
    if (poolKey.startsWith("well:")) {
      const id = poolKey.slice(5);
      return p.role === "bartender" && (p.wellId === id || !p.wellId);
    }
    return true;
  });
}

export function splitPool(
  cfg: TipPoolingConfig,
  poolKey: PoolKey,
  totalCents: number,
  people: PoolParticipant[],
): Record<string, number> {
  const parts = participantsForPool(cfg, poolKey, people);
  const weights = parts.map((p) => ({ id: p.employeeId, w: participantWeight(cfg, p) }));
  return allocate(totalCents, weights);
}

export type CloseoutPoolNet = {
  ownTipsCents: number;
  tipOutsCents: number;
  poolInCents: number;
  poolOutCents: number;
  poolHeldCents: number;
  netTipsCents: number;
  netDueNowCents: number;
  netToPayrollCents: number;
  byPool: { key: PoolKey; label: string; inCents: number; outCents: number }[];
  ownAutogratCents: number;
  scHouseCents: number;
};

export function poolLabel(key: PoolKey): string {
  if (key === "foh") return "FOH pool";
  if (key === "bar") return "Bar pool";
  if (key === "team") return "Team pool";
  if (key === "food") return "Food pool";
  if (key === "drink") return "Drink pool";
  if (key.startsWith("well:")) return `Well ${key.slice(5)}`;
  return key;
}

export function netTipsForCloseout(opts: {
  cfg: TipPoolingConfig;
  payout: CcTipPayout;
  cardTipsCents: number;
  declaredCents: number;
  salesCents: number;
  foodSalesCents: number;
  drinkSalesCents: number;
  tipOutsCents: number;
  autogratCents: number;
  serviceChargeCents: number;
  employeeId: string;
  role: string;
  wellId?: string | null;
  people: PoolParticipant[];
  priorContributions: PoolContributionRow[];
  poolOutOverride?: number | null;
}): CloseoutPoolNet {
  const { cfg, payout } = opts;
  const routed = contributionsForPerson(cfg, opts);
  const ownTips = opts.cardTipsCents + opts.declaredCents + routed.ownAutogratCents;
  const tipOuts = Math.max(0, opts.tipOutsCents);
  const poolIn = routed.rows.reduce((s, r) => s + r.cents, 0);
  const allRows = [...opts.priorContributions, ...routed.rows];
  const byKey = new Map<PoolKey, number>();
  for (const r of allRows) byKey.set(r.poolKey, (byKey.get(r.poolKey) ?? 0) + r.cents);

  let poolOut = 0;
  const byPool: CloseoutPoolNet["byPool"] = [];
  if (poolingActive(cfg) && roleInPool(cfg, opts.role)) {
    for (const [key, total] of byKey) {
      const shares = splitPool(cfg, key, total, opts.people);
      const mine = shares[opts.employeeId] ?? 0;
      const myIn = routed.rows.filter((r) => r.poolKey === key).reduce((s, r) => s + r.cents, 0);
      byPool.push({ key, label: poolLabel(key), inCents: myIn, outCents: mine });
      poolOut += mine;
    }
  }
  if (opts.poolOutOverride != null) poolOut = Math.max(0, opts.poolOutOverride);

  const held = cfg.settle === "end_of_pay_period" && poolingActive(cfg);
  const poolHeld = held ? poolIn : 0;
  const poolOutNow = held ? 0 : poolOut;
  const net = ownTips - tipOuts - poolIn + poolOutNow;
  const declaredDue = payout === "cash_tips_only_at_close" ? Math.max(0, opts.declaredCents) : 0;
  let netDueNow: number;
  let netToPayroll: number;
  if (payout === "paycheck") {
    netDueNow = declaredDue;
    netToPayroll = Math.max(0, net - netDueNow + poolHeld);
  } else if (payout === "cash_tips_only_at_close") {
    netDueNow = Math.max(0, opts.declaredCents - (cfg.contribution === "card_tips" ? 0 : Math.min(poolIn, opts.declaredCents)));
    netToPayroll = Math.max(0, net - netDueNow + poolHeld);
  } else {
    netDueNow = Math.max(0, net);
    netToPayroll = 0;
  }
  if (held && payout === "cash_at_close") {
    netDueNow = Math.max(0, ownTips - tipOuts - poolIn);
    netToPayroll = 0;
  }

  return {
    ownTipsCents: ownTips,
    tipOutsCents: tipOuts,
    poolInCents: poolIn,
    poolOutCents: poolOutNow,
    poolHeldCents: poolHeld,
    netTipsCents: net,
    netDueNowCents: netDueNow,
    netToPayrollCents: netToPayroll,
    byPool,
    ownAutogratCents: routed.ownAutogratCents,
    scHouseCents: routed.scHouseCents,
  };
}

export function autogratFromOrders(orders: Order[], employeeId: string): { autogratCents: number; serviceChargeCents: number } {
  let autogratCents = 0;
  let serviceChargeCents = 0;
  for (const o of orders) {
    if (o.serverId !== employeeId) continue;
    if (o.status === "voided" || o.status === "cancelled") continue;
    const sc = Math.max(0, o.serviceChargeCents || 0);
    if (o.autoGratApplied) autogratCents += sc;
    else serviceChargeCents += sc;
  }
  return { autogratCents, serviceChargeCents };
}
