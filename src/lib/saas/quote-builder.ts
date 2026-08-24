import { z } from "zod";
import { packagesFromModules, type ModuleFlags } from "./platform-settings";
import type { PlanSlug } from "./types";
import { PLAN_SLUGS } from "./types";
import type { QuoteLineItem, QuoteSnapshot } from "./prospect-types";

export const quoteAddOnSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  amountCents: z.number().int().min(0).max(10_000_000),
  oneTime: z.boolean().default(false),
});
export type QuoteAddOn = z.infer<typeof quoteAddOnSchema>;

export const quoteDraftInputSchema = z.object({
  planSlug: z.enum(["starter", "full_service", "food_hall", "platform_internal"]),
  locationCount: z.number().int().min(1).max(999),
  setupFeeCents: z.number().int().min(0).max(10_000_000),
  addOns: z.array(quoteAddOnSchema).max(24).default([]),
});
export type QuoteDraftInput = z.infer<typeof quoteDraftInputSchema>;

export type QuoteCatalogPlan = {
  slug: PlanSlug;
  name: string;
  active: boolean;
  monthlyCents: number;
  onboardingFeeCents: number;
  maxLocations: number;
  maxSeats: number;
  modules: ModuleFlags;
};

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

export function buildStructuredQuote(opts: {
  plan: QuoteCatalogPlan;
  locationCount: number;
  setupFeeCents: number;
  addOns: QuoteAddOn[];
  trialDays: number;
  rulesVersion?: number;
  now?: string;
  draft?: boolean;
  sentAt?: string | null;
}): QuoteSnapshot {
  const loc = Math.max(1, Math.floor(opts.locationCount));
  const setup = Math.max(0, Math.round(opts.setupFeeCents));
  const addOns = opts.addOns.map((a) => quoteAddOnSchema.parse(a));
  const items: QuoteLineItem[] = [
    line(
      "plan",
      "plan",
      `${opts.plan.name} × ${loc} location${loc === 1 ? "" : "s"}`,
      loc,
      opts.plan.monthlyCents,
    ),
  ];
  for (const a of addOns) {
    items.push(
      line(`addon_${a.id}`, a.oneTime ? "onboarding" : "custom", a.name, 1, a.amountCents, {
        oneTime: a.oneTime || undefined,
      }),
    );
  }
  if (setup > 0) {
    items.push(line("setup", "onboarding", "One-time setup", 1, setup, { oneTime: true }));
  }
  const monthlyCents = items.filter((i) => !i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  const onboardingFeeCents = items.filter((i) => i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  const assumptions = [
    `${opts.plan.name} at ${loc} location${loc === 1 ? "" : "s"}. Monthly is price per location × count.`,
    setup > 0 ? `One-time setup ${centsLabel(setup)}.` : "No setup fee on this proposal.",
    opts.trialDays > 0 ? `Trial: ${opts.trialDays} days.` : "No trial period on this proposal.",
    "Guest card processing is Quantum Payments, billed separately from software.",
    "Gift cards are first-party (our ledger), not an external processor.",
  ];
  const slug = (PLAN_SLUGS as readonly string[]).includes(opts.plan.slug)
    ? opts.plan.slug
    : "starter";
  return {
    version: 1,
    rulesVersion: opts.rulesVersion ?? 1,
    generatedAt: opts.now ?? new Date().toISOString(),
    planSlug: slug,
    planName: opts.plan.name,
    maxLocations: Math.max(opts.plan.maxLocations, loc),
    maxSeats: opts.plan.maxSeats,
    locationCount: loc,
    setupFeeCents: setup,
    addOns,
    trialDays: opts.trialDays,
    draft: opts.draft !== false && !opts.sentAt,
    sentAt: opts.sentAt ?? null,
    lineItems: items,
    monthlyCents,
    annualCents: monthlyCents * 12,
    onboardingFeeCents,
    assumptions,
    packages: packagesFromModules(opts.plan.modules),
  };
}

function centsLabel(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export function quoteFromSnapshot(
  quote: QuoteSnapshot,
  plan: QuoteCatalogPlan,
  trialDays: number,
): QuoteSnapshot {
  return buildStructuredQuote({
    plan,
    locationCount: quote.locationCount || 1,
    setupFeeCents: quote.setupFeeCents ?? quote.onboardingFeeCents ?? 0,
    addOns: Array.isArray(quote.addOns) ? quote.addOns : [],
    trialDays: quote.trialDays ?? trialDays,
    rulesVersion: quote.rulesVersion,
    draft: quote.draft,
    sentAt: quote.sentAt,
  });
}
