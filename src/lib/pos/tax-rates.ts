/**
 * Named venue tax rates. Settings is a list of rates — not a JSON blob.
 * Zero rates = no tax line. Menu prices are cash-source; tax is on top
 * unless a rate is inclusive.
 */
import { uid } from "@/lib/utils";
import type { OrderLine, RestaurantSettings } from "./types";

export const TAX_APPLY_TO = ["food", "bev", "retail", "gift", "service", "all"] as const;
export type TaxApplyTo = (typeof TAX_APPLY_TO)[number];

export const TAX_APPLY_LABEL: Record<TaxApplyTo, string> = {
  food: "Food",
  bev: "Bev",
  retail: "Retail",
  gift: "Gift",
  service: "Service",
  all: "All",
};

export type TaxCompound = "stacked" | "compound";

export type TaxRateDef = {
  id: string;
  name: string;
  /** Percent points — 6.5 means 6.5%. */
  percent: number;
  appliesTo: TaxApplyTo;
  /** stacked = pre-tax base; compound = running taxable (base + prior tax). */
  compound: TaxCompound;
  /** Inclusive extracts tax from the cash price. Default add-on. */
  inclusive: boolean;
};

export type ComputedTaxLine = {
  id: string;
  name: string;
  cents: number;
};

export const DEMO_TAX_RATES: TaxRateDef[] = [
  {
    id: "tax_sales",
    name: "Sales",
    percent: 6.5,
    appliesTo: "all",
    compound: "stacked",
    inclusive: false,
  },
  {
    id: "tax_restaurant",
    name: "Restaurant",
    percent: 2.25,
    appliesTo: "all",
    compound: "stacked",
    inclusive: false,
  },
];

export function emptyTaxRates(): TaxRateDef[] {
  return [];
}

export function newTaxRate(patch?: Partial<TaxRateDef>): TaxRateDef {
  return {
    id: patch?.id || uid("tax"),
    name: (patch?.name ?? "Sales").trim() || "Tax",
    percent: clampPercent(patch?.percent ?? 0),
    appliesTo: parseApplyTo(patch?.appliesTo),
    compound: patch?.compound === "compound" ? "compound" : "stacked",
    inclusive: patch?.inclusive === true,
  };
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10000) / 10000));
}

function parseApplyTo(raw: unknown): TaxApplyTo {
  const s = String(raw ?? "").toLowerCase();
  return (TAX_APPLY_TO as readonly string[]).includes(s) ? (s as TaxApplyTo) : "all";
}

export function parseTaxRateDef(raw: unknown): TaxRateDef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  const percent = clampPercent(Number(o.percent));
  if (!name) return null;
  return {
    id: String(o.id ?? "").trim() || uid("tax"),
    name: name.slice(0, 40),
    percent,
    appliesTo: parseApplyTo(o.appliesTo),
    compound: o.compound === "compound" || o.compound === true ? "compound" : "stacked",
    inclusive: o.inclusive === true,
  };
}

export function parseTaxRates(raw: unknown): TaxRateDef[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.map(parseTaxRateDef).filter((r): r is TaxRateDef => !!r);
}

/** Legacy single taxRate (fraction, e.g. 0.0875) → one named rate. */
export function legacyTaxRates(taxRate: number): TaxRateDef[] {
  const n = Number(taxRate);
  if (!Number.isFinite(n) || n <= 0) return [];
  return [
    {
      id: "tax_legacy",
      name: "Tax",
      percent: clampPercent(n * 100),
      appliesTo: "all",
      compound: "stacked",
      inclusive: false,
    },
  ];
}

/**
 * Venue rates. Explicit `[]` is no tax. Missing field falls back to taxRate.
 */
export function resolveVenueTaxRates(settings: Pick<RestaurantSettings, "taxRates" | "taxRate">): TaxRateDef[] {
  if (Array.isArray(settings.taxRates)) return settings.taxRates.map((r) => newTaxRate(r));
  return legacyTaxRates(settings.taxRate);
}

export function ratesForEntity(
  settings: Pick<RestaurantSettings, "taxRates" | "taxRate" | "taxMode" | "entityTaxRates">,
  entityId?: string | null,
): TaxRateDef[] {
  if (settings.taxMode === "per_entity" && entityId) {
    const override = settings.entityTaxRates?.[entityId];
    if (Array.isArray(override)) return override.map((r) => newTaxRate(r));
  }
  return resolveVenueTaxRates(settings);
}

export function lineTaxCategory(line: {
  taxCategory?: TaxApplyTo | null;
  station?: string | null;
}): TaxApplyTo {
  const cat = line.taxCategory;
  if (cat && cat !== "all" && (TAX_APPLY_TO as readonly string[]).includes(cat)) return cat;
  return line.station === "bar" ? "bev" : "food";
}

function rateApplies(rate: TaxRateDef, category: TaxApplyTo): boolean {
  if (rate.appliesTo === "all") return category !== "service";
  return rate.appliesTo === category;
}

export function computeTaxLines(
  bases: Partial<Record<TaxApplyTo, number>>,
  rates: TaxRateDef[],
): { taxCents: number; addOnCents: number; lines: ComputedTaxLine[] } {
  const lines: ComputedTaxLine[] = [];
  let running = 0;
  let addOn = 0;
  for (const rate of rates) {
    let base = 0;
    for (const cat of TAX_APPLY_TO) {
      if (cat === "all") continue;
      if (!rateApplies(rate, cat)) continue;
      base += Math.max(0, bases[cat] ?? 0);
    }
    if (rate.compound === "compound") base += running;
    const r = rate.percent / 100;
    if (r <= 0 || base <= 0) {
      lines.push({ id: rate.id, name: rate.name, cents: 0 });
      continue;
    }
    const tax = rate.inclusive
      ? Math.round(base - base / (1 + r))
      : Math.round(base * r);
    running += tax;
    if (!rate.inclusive) addOn += tax;
    lines.push({ id: rate.id, name: rate.name, cents: tax });
  }
  const shown = lines.filter((l) => l.cents > 0);
  const taxCents = shown.reduce((s, l) => s + l.cents, 0);
  return { taxCents, addOnCents: addOn, lines: shown };
}

export function mergeTaxLines(groups: ComputedTaxLine[][]): ComputedTaxLine[] {
  const map = new Map<string, ComputedTaxLine>();
  for (const group of groups) {
    for (const line of group) {
      const prev = map.get(line.id);
      if (prev) prev.cents += line.cents;
      else map.set(line.id, { ...line });
    }
  }
  return [...map.values()].filter((l) => l.cents > 0);
}

export function taxableBasesForLines(
  lines: Array<
    Pick<OrderLine, "voided" | "comped" | "taxExempt" | "station"> & {
      taxCategory?: TaxApplyTo | null;
      merchCents: number;
    }
  >,
  serviceChargeCents = 0,
): Partial<Record<TaxApplyTo, number>> {
  const bases: Partial<Record<TaxApplyTo, number>> = {};
  for (const line of lines) {
    if (line.voided || line.comped || line.taxExempt) continue;
    const cat = lineTaxCategory(line);
    bases[cat] = (bases[cat] ?? 0) + Math.max(0, line.merchCents);
  }
  if (serviceChargeCents > 0) {
    bases.service = (bases.service ?? 0) + serviceChargeCents;
  }
  return bases;
}

/** Mirror of named rates for older single-field consumers. */
export function taxRateFractionFromRates(rates: TaxRateDef[]): number {
  const stackedAll = rates.filter(
    (r) => !r.inclusive && r.compound === "stacked" && r.appliesTo === "all",
  );
  if (!stackedAll.length) return 0;
  return stackedAll.reduce((s, r) => s + r.percent, 0) / 100;
}
