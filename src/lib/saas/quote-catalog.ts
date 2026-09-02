import type { PlanSlug } from "./types";
import type {
  IntakeAnswers,
  QuoteCatalog,
  QuoteLineItem,
  QuoteStationCounts,
  TerminalNeed,
} from "./prospect-types";

export const DEFAULT_QUOTE_CATALOG: QuoteCatalog = {
  baseCents: 0,
  fullServiceCents: 14900,
  multiOpHostCents: 29900,
  tenantCents: 4900,
  opsPackCents: 9900,
  extraStationCents: 1900,
  includedStations: 4,
  kioskCents: 2900,
  terminalLeaseCents: 1500,
  terminalBuyCents: 0,
  setupCents: 0,
  setupCapCents: 0,
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseQuoteCatalog(raw: unknown): QuoteCatalog {
  const base = { ...DEFAULT_QUOTE_CATALOG };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  base.baseCents = Math.max(0, Math.round(num(o.baseCents, base.baseCents)));
  base.fullServiceCents = Math.max(0, Math.round(num(o.fullServiceCents, base.fullServiceCents)));
  base.multiOpHostCents = Math.max(0, Math.round(num(o.multiOpHostCents, base.multiOpHostCents)));
  base.tenantCents = Math.max(0, Math.round(num(o.tenantCents, base.tenantCents)));
  base.opsPackCents = Math.max(0, Math.round(num(o.opsPackCents, base.opsPackCents)));
  base.extraStationCents = Math.max(0, Math.round(num(o.extraStationCents, base.extraStationCents)));
  base.includedStations = Math.max(1, Math.floor(num(o.includedStations, base.includedStations)));
  base.kioskCents = Math.max(0, Math.round(num(o.kioskCents, base.kioskCents)));
  base.terminalLeaseCents = Math.max(0, Math.round(num(o.terminalLeaseCents, base.terminalLeaseCents)));
  base.terminalBuyCents = Math.max(0, Math.round(num(o.terminalBuyCents, base.terminalBuyCents)));
  base.setupCents = Math.max(0, Math.round(num(o.setupCents, base.setupCents)));
  base.setupCapCents = Math.max(0, Math.round(num(o.setupCapCents, base.setupCapCents)));
  return base;
}

export function publicQuoteCatalog(catalog: QuoteCatalog): QuoteCatalog {
  return { ...catalog };
}

export function isMultiOperatorHouse(answers: IntakeAnswers): boolean {
  return (
    answers.operating.model === "host_operators" ||
    answers.operating.model === "mixed" ||
    (answers.portfolio.typeCounts.food_hall ?? 0) > 0 ||
    (answers.portfolio.typeCounts.truck_pod ?? 0) > 0
  );
}

export function wantsFullServiceFloor(answers: IntakeAnswers): boolean {
  return Boolean(answers.modules.tableService || answers.operating.hostStand);
}

export function wantsOpsPack(answers: IntakeAnswers): boolean {
  return Boolean(answers.modules.inventory || answers.modules.labor);
}

export function tenantEntityCount(answers: IntakeAnswers): number {
  if (!isMultiOperatorHouse(answers)) return 0;
  return Math.max(1, answers.operating.operatorsPerLocation || 1);
}

export function orderStationCount(answers: IntakeAnswers): number {
  const n = answers.volume.orderStations;
  if (typeof n === "number" && n > 0) return Math.floor(n);
  return Math.max(1, Math.floor((answers.volume.peakDevices || 2) / 2) || 1);
}

export function odsStationCount(answers: IntakeAnswers): number {
  const n = answers.volume.odsStations;
  if (typeof n === "number" && n >= 0) return Math.floor(n);
  return answers.modules.kds ? 1 : 0;
}

export function kioskCount(answers: IntakeAnswers): number {
  const n = answers.volume.kioskCount;
  if (typeof n === "number" && n >= 0) return Math.floor(n);
  return answers.modules.kiosk ? 1 : 0;
}

export function terminalNeedOf(answers: IntakeAnswers): TerminalNeed {
  const t = answers.volume.terminalNeed;
  if (t === "lease" || t === "buy" || t === "none") return t;
  return "none";
}

export function extraStationCount(answers: IntakeAnswers, catalog: QuoteCatalog): number {
  const included = Math.max(1, catalog.includedStations || 4);
  const used = orderStationCount(answers) + odsStationCount(answers);
  return Math.max(0, used - included);
}

export function catalogStationCounts(answers: IntakeAnswers): QuoteStationCounts {
  return {
    order: orderStationCount(answers),
    ods: Math.max(answers.modules.kds ? 1 : 0, odsStationCount(answers)),
    host: answers.operating.hostStand || answers.modules.tableService ? 1 : 0,
  };
}

export function recommendedCatalogPlan(answers: IntakeAnswers): PlanSlug {
  if (isMultiOperatorHouse(answers)) return "food_hall";
  if (wantsFullServiceFloor(answers) || answers.operating.hostStand) return "full_service";
  return "starter";
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

export function catalogFeatureList(answers: IntakeAnswers): string[] {
  const out = [
    "Base counter POS + 1 kitchen / bar display (included)",
  ];
  if (isMultiOperatorHouse(answers)) {
    out.push("Multi-operator / hall host — one guest check, per-entity merchants");
    out.push(`${tenantEntityCount(answers)} tenant operator${tenantEntityCount(answers) === 1 ? "" : "s"}`);
  } else if (wantsFullServiceFloor(answers)) {
    out.push("Full service floor, host stand, sections, closeout");
  }
  if (wantsOpsPack(answers)) {
    out.push("Ops pack — recipes, costing, staffing recs, HR, payroll export");
  }
  const extra = extraStationCount(answers, DEFAULT_QUOTE_CATALOG);
  if (extra > 0) out.push(`${extra} extra order/ODS station${extra === 1 ? "" : "s"}`);
  const kiosks = kioskCount(answers);
  if (kiosks > 0) out.push(`${kiosks} guest kiosk${kiosks === 1 ? "" : "s"}`);
  const term = terminalNeedOf(answers);
  if (term === "lease") out.push("Quantum payment terminals (monthly lease)");
  if (term === "buy") out.push("Quantum payment terminals (one-time)");
  return out;
}

/** Customer-facing software lines. Setup and terminal buy are added by generateQuote. */
export function catalogSoftwareLines(
  answers: IntakeAnswers,
  catalog: QuoteCatalog,
  locs: number,
  plan: PlanSlug,
): QuoteLineItem[] {
  const items: QuoteLineItem[] = [];
  const locN = Math.max(1, locs);
  items.push(
    line(
      "base",
      "package",
      "Base counter + 1 ODS",
      locN,
      catalog.baseCents,
      { note: "Included. Hardware is BYO except optional Quantum terminals." },
    ),
  );

  const multi = plan === "food_hall" || isMultiOperatorHouse(answers);
  const full = !multi && (plan === "full_service" || wantsFullServiceFloor(answers));

  if (multi) {
    items.push(
      line(
        "multi_op",
        "plan",
        "Multi-operator / hall host",
        locN,
        catalog.multiOpHostCents,
        { note: "One guest check. Each brand is its own Quantum Payments merchant." },
      ),
    );
    const tenants = tenantEntityCount(answers);
    if (tenants > 0 && catalog.tenantCents > 0) {
      items.push(
        line(
          "tenants",
          "operator",
          "Tenant operator entity",
          tenants,
          catalog.tenantCents,
        ),
      );
    }
  } else if (full) {
    items.push(
      line(
        "full_service",
        "plan",
        "Full service floor / host / sections / closeout",
        locN,
        catalog.fullServiceCents,
      ),
    );
  }

  if (wantsOpsPack(answers) && catalog.opsPackCents > 0) {
    items.push(
      line(
        "ops_pack",
        "package",
        "Ops pack — recipes, costing, staffing recs, HR, payroll export",
        locN,
        catalog.opsPackCents,
      ),
    );
  }

  const extra = extraStationCount(answers, catalog);
  if (extra > 0 && catalog.extraStationCents > 0) {
    items.push(
      line(
        "extra_stations",
        "device_pack",
        `Extra order/ODS stations (over ${catalog.includedStations} included)`,
        extra,
        catalog.extraStationCents,
      ),
    );
  }

  const kiosks = kioskCount(answers);
  if (kiosks > 0 && catalog.kioskCents > 0) {
    items.push(
      line("kiosk", "package", "Guest kiosk", kiosks, catalog.kioskCents),
    );
  }

  const term = terminalNeedOf(answers);
  if (term === "lease" && catalog.terminalLeaseCents > 0) {
    const qty = Math.max(1, orderStationCount(answers));
    items.push(
      line(
        "terminals_mo",
        "custom",
        "Quantum payment terminal lease",
        qty,
        catalog.terminalLeaseCents,
        { note: "Optional. Skip if you already have readers. Other hardware is BYO." },
      ),
    );
  }

  return items;
}

export function cappedSetupCents(catalog: QuoteCatalog, override?: number | null): number {
  let cents = catalog.setupCents;
  if (override != null && Number.isFinite(override)) cents = Math.max(0, Math.round(override));
  if (catalog.setupCapCents > 0) cents = Math.min(cents, catalog.setupCapCents);
  return Math.max(0, cents);
}

/** Apply live-quote toggles back onto intake answers. */
export function applyQuoteToggles(
  answers: IntakeAnswers,
  patch: {
    fullService?: boolean;
    multiOp?: boolean;
    opsPack?: boolean;
    hostStand?: boolean;
    orderStations?: number;
    odsStations?: number;
    kioskCount?: number;
    terminalNeed?: TerminalNeed;
    tenantCount?: number;
  },
): IntakeAnswers {
  const next: IntakeAnswers = {
    ...answers,
    operating: { ...answers.operating },
    modules: { ...answers.modules },
    volume: { ...answers.volume },
    portfolio: { ...answers.portfolio, typeCounts: { ...answers.portfolio.typeCounts } },
  };
  if (patch.multiOp === true) {
    next.operating.model = "host_operators";
    next.operating.guestPaysHostCheck = true;
    next.modules.vendorPortal = true;
    if (!next.portfolio.typeCounts.food_hall && !next.portfolio.typeCounts.truck_pod) {
      next.portfolio.typeCounts = { ...next.portfolio.typeCounts, food_hall: 1 };
    }
  } else if (patch.multiOp === false) {
    next.operating.model = "single";
    next.modules.vendorPortal = false;
    const rest = { ...next.portfolio.typeCounts };
    delete rest.food_hall;
    delete rest.truck_pod;
    next.portfolio.typeCounts = Object.keys(rest).length ? rest : { restaurant: 1 };
  }
  if (patch.fullService === true) {
    next.modules.tableService = true;
    next.operating.hostStand = true;
  } else if (patch.fullService === false && next.operating.model === "single") {
    next.modules.tableService = false;
    next.operating.hostStand = false;
  }
  if (patch.opsPack === true) {
    next.modules.inventory = true;
    next.modules.labor = true;
  } else if (patch.opsPack === false) {
    next.modules.inventory = false;
    next.modules.labor = false;
  }
  if (patch.hostStand != null) {
    next.operating.hostStand = patch.hostStand;
    if (patch.hostStand) next.modules.tableService = true;
  }
  if (patch.orderStations != null) {
    next.volume.orderStations = Math.max(1, Math.floor(patch.orderStations));
  }
  if (patch.odsStations != null) {
    next.volume.odsStations = Math.max(0, Math.floor(patch.odsStations));
    next.modules.kds = next.volume.odsStations > 0;
  }
  if (patch.kioskCount != null) {
    next.volume.kioskCount = Math.max(0, Math.floor(patch.kioskCount));
    next.modules.kiosk = next.volume.kioskCount > 0;
  }
  if (patch.terminalNeed) next.volume.terminalNeed = patch.terminalNeed;
  if (patch.tenantCount != null) {
    next.operating.operatorsPerLocation = Math.max(1, Math.floor(patch.tenantCount));
  }
  next.volume.peakDevices = Math.max(
    1,
    (next.volume.orderStations || 1) + (next.volume.odsStations || 0) + (next.volume.kioskCount || 0),
  );
  return next;
}

export const QUOTE_CATALOG_FIELDS: {
  key: keyof QuoteCatalog;
  label: string;
  hint: string;
}[] = [
  { key: "baseCents", label: "Base counter + 1 ODS", hint: "Included software, default $0" },
  { key: "fullServiceCents", label: "Full service (per location)", hint: "Floor, host, sections, closeout — default $149" },
  { key: "multiOpHostCents", label: "Multi-operator host (per location)", hint: "Hall / pod host — default $299" },
  { key: "tenantCents", label: "Per tenant entity", hint: "Default $49" },
  { key: "opsPackCents", label: "Ops pack (per location)", hint: "Recipes, costing, staffing recs, HR, payroll export — default $99" },
  { key: "extraStationCents", label: "Extra order/ODS station", hint: "Each over included count — default $19" },
  { key: "includedStations", label: "Included order+ODS stations", hint: "Default 4" },
  { key: "kioskCents", label: "Kiosk (each)", hint: "Default $29" },
  { key: "terminalLeaseCents", label: "Terminal lease (each / mo)", hint: "Default $15. BYO other hardware." },
  { key: "terminalBuyCents", label: "Terminal purchase (each, one-time)", hint: "Optional one-time instead of lease" },
  { key: "setupCents", label: "Setup fee", hint: "Default $0" },
  { key: "setupCapCents", label: "Setup fee cap", hint: "0 = no cap beyond the setup amount" },
];
