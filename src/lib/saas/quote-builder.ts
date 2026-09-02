import { z } from "zod";
import type { PlanSlug } from "./types";
import { PLAN_SLUGS } from "./types";
import type { ModuleFlags } from "./platform-settings";
import type { IntakeAnswers, InterviewRecommendation, PricingRules, QuoteSnapshot } from "./prospect-types";
import {
  applyInterviewToIntake,
  generateQuote,
} from "./pricing";

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
  terminalQty: z.number().int().min(0).max(200).default(0),
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

/** Build the sendable quote from intake (+ interview) with optional admin overrides. */
export function buildIntakeQuote(opts: {
  answers: IntakeAnswers;
  rules: PricingRules;
  interview?: InterviewRecommendation | null;
  planSlug?: PlanSlug;
  locationCount?: number;
  setupFeeCents?: number | null;
  addOns?: QuoteAddOn[];
  terminalQty?: number;
  trialDays?: number;
  rulesVersion?: number;
  now?: string;
  draft?: boolean;
  sentAt?: string | null;
  expireDays?: number;
}): QuoteSnapshot {
  const answers = applyInterviewToIntake(opts.answers, opts.interview);
  const slug =
    opts.planSlug && (PLAN_SLUGS as readonly string[]).includes(opts.planSlug)
      ? opts.planSlug
      : undefined;
  return generateQuote(answers, opts.rules, {
    planSlug: slug,
    locationCount: opts.locationCount,
    setupFeeCents: opts.setupFeeCents,
    addOns: opts.addOns,
    terminalQty: opts.terminalQty,
    trialDays: opts.trialDays,
    rulesVersion: opts.rulesVersion,
    now: opts.now,
    draft: opts.draft,
    sentAt: opts.sentAt,
    expireDays: opts.expireDays,
  });
}
