import {
  catalogPackageCents,
  defaultQuotePackageCents,
  PACKAGE_BY_ID,
  type PackageId,
} from "@/lib/pos/packages";
import type { LocationMode } from "@/lib/pos/saas-types";
import { PLAN_SLUGS, VENUE_TYPES, type PlanSlug } from "./types";
import type {
  GmvBand,
  IntakeAnswers,
  InterviewRecommendation,
  PricingRules,
  QuoteAddOn,
  QuoteLineItem,
  QuoteSnapshot,
  QuoteStationCounts,
  SetupFeeMode,
} from "./prospect-types";
import { GMV_BANDS } from "./prospect-types";
import type { TerminalNeed } from "./prospect-types";
import {
  DEFAULT_QUOTE_CATALOG,
  cappedSetupCents,
  catalogFeatureList,
  catalogSoftwareLines,
  catalogStationCounts,
  isMultiOperatorHouse,
  parseQuoteCatalog,
  recommendedCatalogPlan,
  tenantEntityCount,
  terminalNeedOf,
} from "./quote-catalog";

export const DEFAULT_PRICING_RULES: PricingRules = {
  planMonthlyCents: {
    starter: 0,
    full_service: 14900,
    food_hall: 29900,
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
    starter: 0,
    full_service: 0,
    food_hall: 0,
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
  setupFeeMode: "waive",
  setupFeeFlatCents: 0,
  quoteExpireDays: 30,
  terminalMonthlyCents: 1500,
  terminalSetupCents: 0,
  packageMonthlyCents: defaultQuotePackageCents(),
  quoteCatalog: { ...DEFAULT_QUOTE_CATALOG },
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
  const mode = String(o.setupFeeMode ?? "");
  base.setupFeeMode =
    mode === "waive" || mode === "flat" || mode === "by_package" ? mode : base.setupFeeMode;
  base.setupFeeFlatCents = num(o.setupFeeFlatCents, base.setupFeeFlatCents);
  base.quoteExpireDays = Math.max(1, Math.min(180, Math.floor(num(o.quoteExpireDays, base.quoteExpireDays))));
  base.terminalMonthlyCents = num(o.terminalMonthlyCents, base.terminalMonthlyCents);
  base.terminalSetupCents = num(o.terminalSetupCents, base.terminalSetupCents);
  const pkgCents = { ...defaultQuotePackageCents(), ...base.packageMonthlyCents };
  if (o.packageMonthlyCents && typeof o.packageMonthlyCents === "object") {
    for (const [k, v] of Object.entries(o.packageMonthlyCents as Record<string, unknown>)) {
      pkgCents[k as PackageId] = Math.max(0, Math.round(num(v, pkgCents[k as PackageId] ?? 0)));
    }
  }
  base.packageMonthlyCents = pkgCents;
  base.quoteCatalog = parseQuoteCatalog(o.quoteCatalog ?? base.quoteCatalog);
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
      hostStand: true,
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
      peakDevices: 4,
      staffSeats: 12,
      orderStations: 2,
      odsStations: 1,
      kioskCount: 0,
      terminalNeed: "none",
    },
    payments: {
      quantumPaymentsAck: false,
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
    hostStand: bool(operating.hostStand, false),
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
  const term = str(volume.terminalNeed, "none") as TerminalNeed;
  d.volume = {
    volumeKind: volume.volumeKind === "checks" ? "checks" : "gmv",
    monthlyChecks: Math.max(0, Math.floor(num(volume.monthlyChecks, 2000))),
    gmvBand: GMV_BANDS.includes(gmv) ? gmv : "50_150k",
    peakDevices: Math.max(1, Math.floor(num(volume.peakDevices, 4))),
    staffSeats: Math.max(1, Math.floor(num(volume.staffSeats, 8))),
    orderStations: Math.max(1, Math.floor(num(volume.orderStations, d.volume.orderStations))),
    odsStations: Math.max(0, Math.floor(num(volume.odsStations, d.volume.odsStations))),
    kioskCount: Math.max(0, Math.floor(num(volume.kioskCount, d.volume.kioskCount))),
    terminalNeed: term === "lease" || term === "buy" || term === "none" ? term : "none",
  };
  if (!("hostStand" in operating)) {
    d.operating.hostStand = d.modules.tableService;
  }
  const payments = asObject(o.payments);
  const freq = str(payments.payoutFrequency, "weekly");
  d.payments = {
    quantumPaymentsAck: bool(payments.quantumPaymentsAck) || bool(payments.zestPaymentsAck),
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

export function recommendedPlan(
  answers: IntakeAnswers,
  rules: PricingRules,
  interview?: InterviewRecommendation | null,
): PlanSlug {
  const hinted = interview?.pricingHints?.suggestedPlan;
  if (hinted && PLAN_SLUGS.includes(hinted) && hinted !== "platform_internal") {
    if (interview?.operatingModel === "host_multi_operator" || hinted === "food_hall") {
      return hinted === "starter" ? "food_hall" : hinted;
    }
    return hinted;
  }
  const merged = applyInterviewToIntake(answers, interview);
  const catalogPlan = recommendedCatalogPlan(merged);
  if (catalogPlan === "food_hall" || catalogPlan === "full_service" || catalogPlan === "starter") {
    return catalogPlan;
  }
  const primary = primaryLocationType(merged);
  let plan = rules.basePlanByLocationType[primary] ?? "starter";
  if (merged.operating.model === "host_operators" || hostLocationCount(merged) > 0) {
    plan = "food_hall";
  } else if (merged.modules.tableService && plan === "starter") {
    plan = "full_service";
  }
  if (!PLAN_SLUGS.includes(plan) || plan === "platform_internal") plan = "starter";
  return plan;
}

function centsLabel(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
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

export const PROCESSING_NOTE =
  "Guest card processing is Quantum Payments (cash-discount settings apply). It is billed separately from software and is not mixed into the monthly software total unless you chose a bundled plan.";

export function applyInterviewToIntake(
  answers: IntakeAnswers,
  rec: InterviewRecommendation | null | undefined,
): IntakeAnswers {
  if (!rec) return answers;
  const next = parseIntakeAnswers(answers);
  if (rec.operatingModel === "host_multi_operator") {
    next.operating = {
      ...next.operating,
      model: "host_operators",
      guestPaysHostCheck: true,
      hostStand: true,
    };
  } else if (rec.operatingModel === "single_operator" && next.operating.model === "single") {
    next.operating = { ...next.operating, model: "single" };
  }
  if (rec.venueTypes && rec.venueTypes.length > 0) {
    const typeCounts: IntakeAnswers["portfolio"]["typeCounts"] = { ...next.portfolio.typeCounts };
    for (const t of rec.venueTypes) {
      typeCounts[t] = Math.max(typeCounts[t] ?? 0, 1);
    }
    next.portfolio = { ...next.portfolio, typeCounts };
  }
  for (const m of rec.modules ?? []) {
    if (m in next.modules) next.modules[m as keyof IntakeAnswers["modules"]] = true;
  }
  if (rec.estimates?.locations) {
    next.portfolio = {
      ...next.portfolio,
      locationsNow: Math.max(next.portfolio.locationsNow, rec.estimates.locations),
    };
  }
  if (rec.estimates?.operators) {
    next.operating = {
      ...next.operating,
      operatorsPerLocation: Math.max(next.operating.operatorsPerLocation, rec.estimates.operators),
    };
  }
  if (rec.estimates?.seats) {
    next.volume = { ...next.volume, staffSeats: Math.max(next.volume.staffSeats, rec.estimates.seats) };
  }
  if (rec.estimates?.devices) {
    const devices = Math.max(next.volume.peakDevices, rec.estimates.devices);
    next.volume = {
      ...next.volume,
      peakDevices: devices,
      orderStations: Math.max(next.volume.orderStations, Math.max(1, Math.ceil(devices / 2))),
      odsStations: Math.max(next.volume.odsStations, 1),
    };
  }
  if (rec.modules?.includes("tableService")) next.operating.hostStand = true;
  if (rec.modules?.includes("kiosk")) next.volume.kioskCount = Math.max(next.volume.kioskCount, 1);
  return next;
}

export function featureListFromAnswers(answers: IntakeAnswers): string[] {
  return catalogFeatureList(answers);
}

export function stationCountsFromAnswers(answers: IntakeAnswers): QuoteStationCounts {
  return catalogStationCounts(answers);
}

/** Software packages the house actually asked for — not the full venue default dump. */
export function packagesFromIntake(answers: IntakeAnswers): PackageId[] {
  const pkgs = new Set<PackageId>(["pos_core", "kds"]);
  const host =
    answers.operating.model === "host_operators" ||
    answers.operating.model === "mixed" ||
    hostLocationCount(answers) > 0;
  if (answers.modules.tableService) pkgs.add("host_stand");
  if (answers.modules.kiosk || answers.modules.online) pkgs.add("online_kiosk");
  if (answers.modules.inventory) pkgs.add("inventory");
  if (answers.modules.labor) pkgs.add("labor");
  if (answers.modules.giftCards || answers.modules.crm) pkgs.add("guests_crm");
  if (answers.modules.marketing) {
    pkgs.add("marketing_suite");
    pkgs.add("location_website");
  }
  if (answers.modules.vendorPortal || host) {
    pkgs.add("hall_settlement");
    pkgs.add("vendor_portal");
  }
  if (answers.modules.multiLocationReporting) pkgs.add("advanced_ops");
  const primary = primaryLocationType(answers);
  if (primary === "truck_pod") pkgs.add("truck_pod");
  return [...pkgs];
}

export function packageUnitCents(id: PackageId, rules: PricingRules): number {
  const fromSettings = rules.packageMonthlyCents?.[id];
  if (typeof fromSettings === "number" && Number.isFinite(fromSettings)) {
    return Math.max(0, Math.round(fromSettings));
  }
  return catalogPackageCents(id);
}

export function resolveSetupFeeCents(
  plan: PlanSlug,
  rules: PricingRules,
  override?: number | null,
): { cents: number; mode: SetupFeeMode } {
  const mode = rules.setupFeeMode ?? "by_package";
  if (override != null && Number.isFinite(override)) {
    return { cents: Math.max(0, Math.round(override)), mode };
  }
  if (mode === "waive") return { cents: 0, mode };
  if (mode === "flat") return { cents: Math.max(0, rules.setupFeeFlatCents ?? 0), mode };
  return { cents: Math.max(0, rules.onboardingFeeCents[plan] ?? 0), mode };
}

/** Software package is present when there is at least one non-setup line (including $0 POS core). */
export function quoteHasSoftwarePackage(quote: QuoteSnapshot | null | undefined): boolean {
  if (!quote) return false;
  return quote.lineItems.some((i) => !i.oneTime);
}

export function quoteIsSetupOnly(quote: QuoteSnapshot | null | undefined): boolean {
  if (!quote) return false;
  const software = quote.lineItems.filter((i) => !i.oneTime);
  const setup = quote.lineItems.filter((i) => i.oneTime);
  return software.length === 0 && setup.length > 0;
}

export type GenerateQuoteOpts = {
  rulesVersion?: number;
  now?: string;
  planSlug?: PlanSlug;
  locationCount?: number;
  setupFeeCents?: number | null;
  terminalQty?: number;
  addOns?: QuoteAddOn[];
  expireDays?: number;
  draft?: boolean;
  sentAt?: string | null;
  trialDays?: number;
};

export function generateQuote(
  answers: IntakeAnswers,
  rules: PricingRules,
  opts?: GenerateQuoteOpts,
): QuoteSnapshot {
  const recommended = recommendedPlan(answers, rules);
  const plan =
    opts?.planSlug && PLAN_SLUGS.includes(opts.planSlug) && opts.planSlug !== "platform_internal"
      ? opts.planSlug
      : recommended;
  const locs = Math.max(1, opts?.locationCount ?? locationCount(answers));
  const primary = primaryLocationType(answers);
  const hostLocs = hostLocationCount(answers);
  const operators =
    hostLocs > 0 ? Math.max(hostLocs, 1) * Math.max(1, answers.operating.operatorsPerLocation) : 0;
  const nowIso = opts?.now ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso) || Date.now();
  const expireDays = Math.max(1, opts?.expireDays ?? rules.quoteExpireDays ?? 30);
  const expiresAt = new Date(nowMs + expireDays * 86_400_000).toISOString();
  const catalog = parseQuoteCatalog(rules.quoteCatalog ?? DEFAULT_QUOTE_CATALOG);
  const stations = stationCountsFromAnswers(answers);
  const tenants = tenantEntityCount(answers);
  const entityCount =
    isMultiOperatorHouse(answers) ? Math.max(1, locs) + tenants : Math.max(1, locs);

  const packages = new Set<PackageId>(packagesFromIntake(answers));
  const items: QuoteLineItem[] = catalogSoftwareLines(answers, catalog, locs, plan);

  let terminalQty = Math.max(0, Math.floor(opts?.terminalQty ?? 0));
  const need = terminalNeedOf(answers);
  if (terminalQty === 0 && (need === "lease" || need === "buy")) {
    terminalQty = Math.max(1, Math.min(12, stations.order || 1));
  }
  if (need === "buy" && catalog.terminalBuyCents > 0 && terminalQty > 0) {
    items.push(
      line("terminals_buy", "onboarding", "Quantum payment terminal (purchase)", terminalQty, catalog.terminalBuyCents, {
        oneTime: true,
        note: "Optional. Other hardware is BYO.",
      }),
    );
  }

  for (const a of opts?.addOns ?? []) {
    if (!a.name?.trim()) continue;
    items.push(
      line(`addon_${a.id}`, a.oneTime ? "onboarding" : "custom", a.name.trim(), 1, a.amountCents, {
        oneTime: a.oneTime || undefined,
      }),
    );
  }

  const monthlyCents = items.filter((i) => !i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  const discount = Math.min(90, Math.max(0, rules.annualDiscountPercent)) / 100;
  const annualCents = Math.round(monthlyCents * 12 * (1 - discount));
  const setupCents = cappedSetupCents(catalog, opts?.setupFeeCents);
  if (setupCents > 0) {
    items.push(
      line("onb", "onboarding", "One-time setup", 1, setupCents, { oneTime: true }),
    );
  }
  const onboardingFeeCents = items.filter((i) => i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  const setup = { cents: setupCents, mode: (catalog.setupCents > 0 ? "flat" : "waive") as SetupFeeMode };

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
    `Package: ${planLabel(plan)} from intake (primary venue ${primary.replaceAll("_", " ")}).`,
    `${locs} location(s) now` +
      (answers.portfolio.locations12mo
        ? `; ${answers.portfolio.locations12mo} planned in 12 months.`
        : "."),
    `${entityCount} entit${entityCount === 1 ? "y" : "ies"} · stations: order ${stations.order}, ODS ${stations.ods}, host ${stations.host}.`,
    hostLocs > 0
      ? `Host + operator model: ~${operators} operator(s) across ${hostLocs} host location(s). Guest pays one check; capture splits to each brand’s Quantum merchant.`
      : "Single-operator location.",
    PROCESSING_NOTE,
    "Gift cards are first-party (Summex ledger), not Finix.",
    "Hardware is bring-your-own except optional Quantum terminals on this quote.",
    answers.volume.volumeKind === "checks"
      ? `Volume driver: ~${answers.volume.monthlyChecks.toLocaleString()} checks / month.`
      : `Volume driver: GMV band ${gmvLabel(answers.volume.gmvBand)}.`,
    `Staff seats ${answers.volume.staffSeats}.`,
    setup.cents > 0
      ? `Setup ${centsLabel(setup.cents)} (${setup.mode === "waive" ? "waived" : setup.mode === "flat" ? "flat" : "by package"}).`
      : "No setup fee on this proposal.",
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
    generatedAt: nowIso,
    planSlug: plan,
    planName: planLabel(plan),
    maxLocations,
    maxSeats,
    locationCount: locs,
    entityCount,
    stationCounts: stations,
    setupFeeCents: setup.cents,
    setupFeeMode: setup.mode,
    addOns: opts?.addOns ?? [],
    trialDays: opts?.trialDays ?? 0,
    draft: opts?.draft !== false && !opts?.sentAt,
    sentAt: opts?.sentAt ?? null,
    expiresAt,
    featureList: featureListFromAnswers(answers),
    processingNote: PROCESSING_NOTE,
    terminalQty,
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
  if (plan === "food_hall") return "Multi-operator";
  if (plan === "platform_internal") return "Platform internal";
  return "Counter";
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
