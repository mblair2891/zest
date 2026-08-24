import {
  defaultPackagesForMode,
  PACKAGE_BY_ID,
  type PackageId,
} from "@/lib/pos/packages";
import type { LocationMode } from "@/lib/pos/saas-types";
import { PLAN_SLUGS, VENUE_TYPES, type PlanSlug } from "./types";
import type {
  GmvBand,
  IntakeAnswers,
  PricingRules,
  QuoteLineItem,
  QuoteSnapshot,
} from "./prospect-types";
import { GMV_BANDS } from "./prospect-types";

export const DEFAULT_PRICING_RULES: PricingRules = {
  planMonthlyCents: {
    starter: 0,
    full_service: 0,
    food_hall: 0,
    platform_internal: 0,
  },
  perLocationFeeCents: 4900,
  perOperatorFeeCents: 2900,
  seatPackSize: 8,
  seatPackFeeCents: 4000,
  devicePackSize: 4,
  devicePackFeeCents: 2500,
  annualDiscountPercent: 10,
  onboardingFeeCents: {
    starter: 49900,
    full_service: 149900,
    food_hall: 249900,
    platform_internal: 0,
  },
  gmvScaleCents: {
    under_50k: 0,
    "50_150k": 4900,
    "150_400k": 9900,
    "400k_plus": 19900,
  },
  basePlanByLocationType: {
    restaurant: "full_service",
    food_hall: "food_hall",
    truck_pod: "food_hall",
    ghost_kitchen: "starter",
    catering: "starter",
    bar_lounge: "full_service",
    cafe: "starter",
    qsr: "starter",
  },
};

const MODULE_PACKAGES: Record<keyof IntakeAnswers["modules"], PackageId[]> = {
  tableService: ["host_stand"],
  counterQsr: [],
  kiosk: ["online_kiosk"],
  online: ["online_kiosk"],
  kds: ["kds"],
  inventory: ["inventory"],
  labor: ["labor"],
  giftCards: ["guests_crm"],
  crm: ["guests_crm"],
  marketing: ["marketing_suite", "location_website"],
  vendorPortal: ["vendor_portal", "hall_settlement"],
  multiLocationReporting: ["advanced_ops"],
};

export function parsePricingRules(raw: unknown): PricingRules {
  const base = { ...DEFAULT_PRICING_RULES };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  if (o.planMonthlyCents && typeof o.planMonthlyCents === "object") {
    base.planMonthlyCents = {
      ...base.planMonthlyCents,
      ...(o.planMonthlyCents as PricingRules["planMonthlyCents"]),
    };
  }
  base.perLocationFeeCents = num(o.perLocationFeeCents, base.perLocationFeeCents);
  base.perOperatorFeeCents = num(o.perOperatorFeeCents, base.perOperatorFeeCents);
  base.seatPackSize = Math.max(1, Math.floor(num(o.seatPackSize, base.seatPackSize)));
  base.seatPackFeeCents = num(o.seatPackFeeCents, base.seatPackFeeCents);
  base.devicePackSize = Math.max(1, Math.floor(num(o.devicePackSize, base.devicePackSize)));
  base.devicePackFeeCents = num(o.devicePackFeeCents, base.devicePackFeeCents);
  base.annualDiscountPercent = num(o.annualDiscountPercent, base.annualDiscountPercent);
  if (o.onboardingFeeCents && typeof o.onboardingFeeCents === "object") {
    base.onboardingFeeCents = {
      ...base.onboardingFeeCents,
      ...(o.onboardingFeeCents as PricingRules["onboardingFeeCents"]),
    };
  }
  if (o.gmvScaleCents && typeof o.gmvScaleCents === "object") {
    base.gmvScaleCents = {
      ...base.gmvScaleCents,
      ...(o.gmvScaleCents as PricingRules["gmvScaleCents"]),
    };
  }
  if (o.basePlanByLocationType && typeof o.basePlanByLocationType === "object") {
    base.basePlanByLocationType = {
      ...base.basePlanByLocationType,
      ...(o.basePlanByLocationType as PricingRules["basePlanByLocationType"]),
    };
  }
  return base;
}

export function emptyIntakeAnswers(): IntakeAnswers {
  return {
    company: {
      legalName: "",
      dba: "",
      billingEmail: "",
      phone: "",
      hqAddress: "",
      taxId: "",
    },
    portfolio: {
      locationsNow: 1,
      locations12mo: 1,
      typeCounts: { restaurant: 1 },
    },
    operating: {
      model: "single",
      operatorsPerLocation: 1,
      guestPaysHostCheck: false,
      barKitchenSplit: false,
    },
    modules: {
      tableService: true,
      counterQsr: false,
      kiosk: false,
      online: true,
      kds: true,
      inventory: true,
      labor: true,
      giftCards: false,
      crm: true,
      marketing: false,
      vendorPortal: false,
      multiLocationReporting: false,
    },
    volume: {
      volumeKind: "gmv",
      monthlyChecks: 2000,
      gmvBand: "50_150k",
      peakDevices: 6,
      staffSeats: 12,
    },
    payments: {
      zestPaymentsAck: false,
      tips: true,
      splitTenders: true,
      roomCharge: false,
      payoutFrequency: "weekly",
    },
    timeline: {
      goLiveDate: "",
      notes: "",
    },
  };
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function parseIntakeAnswers(raw: unknown): IntakeAnswers {
  const d = emptyIntakeAnswers();
  const o = asObject(raw);
  const company = asObject(o.company);
  d.company = {
    legalName: str(company.legalName),
    dba: str(company.dba),
    billingEmail: str(company.billingEmail).trim().toLowerCase(),
    phone: str(company.phone),
    hqAddress: str(company.hqAddress),
    taxId: str(company.taxId),
  };
  const portfolio = asObject(o.portfolio);
  const typeCounts: Partial<Record<LocationMode, number>> = {};
  const rawCounts = asObject(portfolio.typeCounts);
  for (const t of VENUE_TYPES) {
    const n = Math.max(0, Math.floor(num(rawCounts[t], 0)));
    if (n > 0) typeCounts[t] = n;
  }
  d.portfolio = {
    locationsNow: Math.max(0, Math.floor(num(portfolio.locationsNow, 1))),
    locations12mo: Math.max(0, Math.floor(num(portfolio.locations12mo, 1))),
    typeCounts,
  };
  const operating = asObject(o.operating);
  const model = str(operating.model, "single");
  d.operating = {
    model:
      model === "host_operators" || model === "mixed" || model === "single"
        ? model
        : "single",
    operatorsPerLocation: Math.max(1, Math.floor(num(operating.operatorsPerLocation, 1))),
    guestPaysHostCheck: bool(operating.guestPaysHostCheck),
    barKitchenSplit: bool(operating.barKitchenSplit),
  };
  const modules = asObject(o.modules);
  d.modules = {
    tableService: bool(modules.tableService, d.modules.tableService),
    counterQsr: bool(modules.counterQsr, d.modules.counterQsr),
    kiosk: bool(modules.kiosk, d.modules.kiosk),
    online: bool(modules.online, d.modules.online),
    kds: bool(modules.kds, d.modules.kds),
    inventory: bool(modules.inventory, d.modules.inventory),
    labor: bool(modules.labor, d.modules.labor),
    giftCards: bool(modules.giftCards, d.modules.giftCards),
    crm: bool(modules.crm, d.modules.crm),
    marketing: bool(modules.marketing, d.modules.marketing),
    vendorPortal: bool(modules.vendorPortal, d.modules.vendorPortal),
    multiLocationReporting: bool(modules.multiLocationReporting, d.modules.multiLocationReporting),
  };
  const volume = asObject(o.volume);
  const gmv = str(volume.gmvBand, "50_150k") as GmvBand;
  d.volume = {
    volumeKind: volume.volumeKind === "checks" ? "checks" : "gmv",
    monthlyChecks: Math.max(0, Math.floor(num(volume.monthlyChecks, 2000))),
    gmvBand: GMV_BANDS.includes(gmv) ? gmv : "50_150k",
    peakDevices: Math.max(1, Math.floor(num(volume.peakDevices, 6))),
    staffSeats: Math.max(1, Math.floor(num(volume.staffSeats, 8))),
  };
  const payments = asObject(o.payments);
  const freq = str(payments.payoutFrequency, "weekly");
  d.payments = {
    zestPaymentsAck: bool(payments.zestPaymentsAck),
    tips: bool(payments.tips, true),
    splitTenders: bool(payments.splitTenders, true),
    roomCharge: bool(payments.roomCharge),
    payoutFrequency:
      freq === "daily" || freq === "weekly" || freq === "biweekly" ? freq : "weekly",
  };
  const timeline = asObject(o.timeline);
  d.timeline = {
    goLiveDate: str(timeline.goLiveDate),
    notes: str(timeline.notes),
  };
  return d;
}

export function primaryLocationType(answers: IntakeAnswers): LocationMode {
  let best: LocationMode = "restaurant";
  let max = 0;
  for (const t of VENUE_TYPES) {
    const n = answers.portfolio.typeCounts[t] ?? 0;
    if (n > max) {
      max = n;
      best = t;
    }
  }
  return best;
}

export function locationCount(answers: IntakeAnswers): number {
  const summed = VENUE_TYPES.reduce(
    (s, t) => s + (answers.portfolio.typeCounts[t] ?? 0),
    0,
  );
  return Math.max(1, answers.portfolio.locationsNow || summed || 1);
}

export function hostLocationCount(answers: IntakeAnswers): number {
  if (answers.operating.model === "host_operators") return locationCount(answers);
  const hall =
    (answers.portfolio.typeCounts.food_hall ?? 0) +
    (answers.portfolio.typeCounts.truck_pod ?? 0);
  if (answers.operating.model === "mixed") return Math.max(hall, 0);
  if (hall > 0 && answers.operating.model === "single") return 0;
  return hall;
}

export function recommendedPlan(answers: IntakeAnswers, rules: PricingRules): PlanSlug {
  const primary = primaryLocationType(answers);
  let plan = rules.basePlanByLocationType[primary] ?? "starter";
  if (answers.operating.model === "host_operators" || hostLocationCount(answers) > 0) {
    plan = "food_hall";
  } else if (answers.modules.tableService && plan === "starter") {
    plan = "full_service";
  }
  if (answers.portfolio.locationsNow >= 6 && plan === "starter") plan = "full_service";
  if (!PLAN_SLUGS.includes(plan) || plan === "platform_internal") plan = "starter";
  return plan;
}

function line(
  id: string,
  kind: QuoteLineItem["kind"],
  label: string,
  qty: number,
  unitCents: number,
  extra?: Partial<QuoteLineItem>,
): QuoteLineItem {
  const q = Math.max(0, qty);
  return {
    id,
    kind,
    label,
    qty: q,
    unitCents,
    totalCents: q * unitCents,
    ...extra,
  };
}

export function generateQuote(
  answers: IntakeAnswers,
  rules: PricingRules,
  opts?: { rulesVersion?: number; now?: string },
): QuoteSnapshot {
  const plan = recommendedPlan(answers, rules);
  const locs = locationCount(answers);
  const primary = primaryLocationType(answers);
  const hostLocs = hostLocationCount(answers);
  const operators =
    hostLocs > 0 ? hostLocs * Math.max(1, answers.operating.operatorsPerLocation) : 0;

  const packages = new Set<PackageId>(defaultPackagesForMode(primary));
  if (plan === "food_hall" || hostLocs > 0) {
    for (const p of defaultPackagesForMode("food_hall")) packages.add(p);
  }
  (Object.keys(answers.modules) as (keyof IntakeAnswers["modules"])[]).forEach((key) => {
    if (!answers.modules[key]) return;
    for (const pkg of MODULE_PACKAGES[key]) packages.add(pkg);
  });
  if (hostLocs > 0 || answers.modules.vendorPortal) {
    packages.add("hall_settlement");
    packages.add("vendor_portal");
  }

  const items: QuoteLineItem[] = [];
  const planFee = rules.planMonthlyCents[plan] ?? 0;
  if (planFee > 0) {
    items.push(line("plan", "plan", `${planLabel(plan)} base`, 1, planFee));
  }

  for (const pkgId of [...packages]) {
    const pkg = PACKAGE_BY_ID[pkgId];
    if (!pkg || pkg.priceMonthly <= 0) continue;
    items.push(
      line(`pkg_${pkgId}`, "package", `${pkg.name} × ${locs} loc`, locs, pkg.priceMonthly * 100, {
        packageId: pkgId,
      }),
    );
  }

  if (rules.perLocationFeeCents > 0) {
    items.push(
      line("loc_fee", "location", "Per-location platform fee", locs, rules.perLocationFeeCents),
    );
  }
  if (operators > 0 && rules.perOperatorFeeCents > 0) {
    items.push(
      line(
        "opr_fee",
        "operator",
        "Host-model operator seat",
        operators,
        rules.perOperatorFeeCents,
      ),
    );
  }

  const seatPacks = Math.ceil(Math.max(1, answers.volume.staffSeats) / rules.seatPackSize);
  items.push(
    line(
      "seats",
      "seat_pack",
      `Staff seats (${rules.seatPackSize}/pack)`,
      seatPacks,
      rules.seatPackFeeCents,
    ),
  );
  const devicePacks = Math.ceil(
    Math.max(1, answers.volume.peakDevices) / rules.devicePackSize,
  );
  items.push(
    line(
      "devices",
      "device_pack",
      `Peak devices (${rules.devicePackSize}/pack)`,
      devicePacks,
      rules.devicePackFeeCents,
    ),
  );

  const gmvFee = rules.gmvScaleCents[answers.volume.gmvBand] ?? 0;
  if (gmvFee > 0) {
    items.push(
      line("gmv", "gmv_scale", `Volume band ${gmvLabel(answers.volume.gmvBand)}`, 1, gmvFee),
    );
  }

  const monthlyCents = items.reduce((s, i) => s + i.totalCents, 0);
  const discount = Math.min(90, Math.max(0, rules.annualDiscountPercent)) / 100;
  const annualCents = Math.round(monthlyCents * 12 * (1 - discount));
  const onboardingFeeCents = rules.onboardingFeeCents[plan] ?? 0;
  if (onboardingFeeCents > 0) {
    items.push(
      line("onb", "onboarding", "One-time onboarding", 1, onboardingFeeCents, {
        oneTime: true,
      }),
    );
  }

  const maxLocations = Math.max(
    locs,
    answers.portfolio.locations12mo || locs,
    plan === "starter" ? 1 : plan === "full_service" ? 5 : 10,
  );
  const maxSeats = Math.max(
    answers.volume.staffSeats,
    plan === "starter" ? 8 : plan === "full_service" ? 40 : 80,
  );

  const assumptions: string[] = [
    `Recommended plan: ${planLabel(plan)} from primary venue type (${primary.replaceAll("_", " ")}).`,
    `${locs} location(s) now` +
      (answers.portfolio.locations12mo
        ? `; ${answers.portfolio.locations12mo} planned in 12 months.`
        : "."),
    hostLocs > 0
      ? `Host + operator model: ~${operators} operator(s) across ${hostLocs} host location(s). Guest ${answers.operating.guestPaysHostCheck ? "pays one host check with split settlement." : "may pay per operator (confirm at onboarding)."}`
      : "Single-operator locations.",
    `Guest card processing is Summex Payments only${hostLocs > 0 ? " (host MID for multi-operator)." : "."}`,
    "Gift cards are first-party (our ledger), not an external processor.",
    answers.volume.volumeKind === "checks"
      ? `Volume driver: ~${answers.volume.monthlyChecks.toLocaleString()} checks / month.`
      : `Volume driver: GMV band ${gmvLabel(answers.volume.gmvBand)}.`,
    `Peak concurrent devices ${answers.volume.peakDevices}; staff seats ${answers.volume.staffSeats}.`,
    `Operator payout preference (informational): ${answers.payments.payoutFrequency}.`,
    discount > 0
      ? `Annual prepaid option is ${Math.round(discount * 100)}% off monthly × 12.`
      : "Annual equals monthly × 12.",
  ];
  if (answers.timeline.goLiveDate) {
    assumptions.push(`Target go-live: ${answers.timeline.goLiveDate}.`);
  }
  if (answers.timeline.notes.trim()) {
    assumptions.push(`Notes: ${answers.timeline.notes.trim()}`);
  }

  return {
    version: 1,
    rulesVersion: opts?.rulesVersion ?? 1,
    generatedAt: opts?.now ?? new Date().toISOString(),
    planSlug: plan,
    maxLocations,
    maxSeats,
    lineItems: items,
    monthlyCents,
    annualCents,
    onboardingFeeCents,
    assumptions,
    packages: [...packages],
  };
}

export function retotalQuote(quote: QuoteSnapshot): QuoteSnapshot {
  const lineItems = quote.lineItems.map((i) => ({
    ...i,
    totalCents: Math.max(0, i.qty) * i.unitCents,
  }));
  const monthlyCents = lineItems
    .filter((i) => !i.oneTime)
    .reduce((s, i) => s + i.totalCents, 0);
  const onboardingFeeCents = lineItems
    .filter((i) => i.oneTime)
    .reduce((s, i) => s + i.totalCents, 0);
  const annualCents =
    quote.annualCents && quote.monthlyCents
      ? Math.round(monthlyCents * (quote.annualCents / Math.max(1, quote.monthlyCents)))
      : monthlyCents * 12;
  return {
    ...quote,
    lineItems,
    monthlyCents,
    annualCents,
    onboardingFeeCents,
  };
}

export function planLabel(plan: PlanSlug): string {
  if (plan === "full_service") return "Full service";
  if (plan === "food_hall") return "Food hall";
  if (plan === "platform_internal") return "Platform internal";
  return "Starter";
}

export function gmvLabel(band: GmvBand): string {
  if (band === "under_50k") return "Under $50k / mo";
  if (band === "50_150k") return "$50–150k / mo";
  if (band === "150_400k") return "$150–400k / mo";
  return "$400k+ / mo";
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    prospect: "Request",
    quoted: "Sent",
    accepted: "Accepted",
    contracted: "Contracted",
    onboarding: "Onboarding",
    live: "Live",
    churned: "Churned",
    rejected: "Rejected",
  };
  return map[status] ?? status;
}
