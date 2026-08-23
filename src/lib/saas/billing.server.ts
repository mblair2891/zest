import { getSql } from "@/lib/db";
import { newId } from "./ids";
import { appPublicUrl } from "./flags";
import type { PlanSlug } from "./types";
import { PLAN_SLUGS } from "./types";
import { requireActiveOrg, setTenantPlan, writeAudit } from "./tenancy.server";

export type BillingProvider = {
  kind: "sandbox" | "stripe";
  createCheckout: (opts: {
    orgId: string;
    planId: PlanSlug;
    email: string | null;
    successUrl: string;
    cancelUrl: string;
    customerId?: string | null;
  }) => Promise<{ url: string | null; message: string }>;
  createPortal: (opts: {
    customerId: string;
    returnUrl: string;
  }) => Promise<{ url: string | null; message: string }>;
};

function stripeKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY?.trim() || undefined;
}

function priceIdFor(plan: PlanSlug): string | undefined {
  const map: Record<PlanSlug, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER?.trim(),
    full_service: process.env.STRIPE_PRICE_FULL_SERVICE?.trim(),
    food_hall: process.env.STRIPE_PRICE_FOOD_HALL?.trim(),
    platform_internal: process.env.STRIPE_PRICE_PLATFORM_INTERNAL?.trim(),
  };
  return map[plan];
}

async function stripeForm(
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const key = stripeKey();
  if (!key) throw new Error("Stripe is not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || "Stripe request failed");
  }
  return json;
}

const sandboxProvider: BillingProvider = {
  kind: "sandbox",
  async createCheckout() {
    return {
      url: null,
      message:
        "Sandbox billing: assign a plan in the platform console. Add STRIPE_SECRET_KEY for live checkout.",
    };
  },
  async createPortal() {
    return {
      url: null,
      message: "Customer portal is unavailable in sandbox billing.",
    };
  },
};

const stripeProvider: BillingProvider = {
  kind: "stripe",
  async createCheckout(opts) {
    const price = priceIdFor(opts.planId);
    if (!price) {
      return {
        url: null,
        message: `No Stripe price id for plan ${opts.planId}. Set STRIPE_PRICE_* env vars.`,
      };
    }
    const body: Record<string, string> = {
      mode: "subscription",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      client_reference_id: opts.orgId,
      "metadata[orgId]": opts.orgId,
      "metadata[planId]": opts.planId,
      "subscription_data[metadata][orgId]": opts.orgId,
      "subscription_data[metadata][planId]": opts.planId,
    };
    if (opts.email) body.customer_email = opts.email;
    if (opts.customerId) body.customer = opts.customerId;
    const session = await stripeForm("checkout/sessions", body);
    return { url: String(session.url ?? ""), message: "ok" };
  },
  async createPortal(opts) {
    const session = await stripeForm("billing_portal/sessions", {
      customer: opts.customerId,
      return_url: opts.returnUrl,
    });
    return { url: String(session.url ?? ""), message: "ok" };
  },
};

export function getBillingProvider(): BillingProvider {
  return stripeKey() ? stripeProvider : sandboxProvider;
}

export async function startCheckout(
  userId: string,
  orgId: string,
  planId: PlanSlug,
): Promise<{ url: string | null; message: string; provider: string }> {
  if (!PLAN_SLUGS.includes(planId)) throw new Error("Unknown plan");
  const access = await requireActiveOrg(userId, orgId, ["owner", "manager"]);
  const sql = await getSql();
  const sub = await sql<{ stripe_customer_id: string | null }>`
    select stripe_customer_id from org_subscriptions where org_id = ${orgId} limit 1
  `;
  const origin = appPublicUrl();
  const provider = getBillingProvider();
  if (provider.kind === "sandbox") {
    await setTenantPlan(userId, orgId, planId);
    return {
      url: null,
      message: `Sandbox: ${access.org.name} is now on ${planId}.`,
      provider: provider.kind,
    };
  }
  const result = await provider.createCheckout({
    orgId,
    planId,
    email: (await (await import("./tenancy.server")).loadUser(userId))?.email ?? null,
    successUrl: `${origin}/platform?billing=success`,
    cancelUrl: `${origin}/platform?billing=cancel`,
    customerId: sub[0]?.stripe_customer_id,
  });
  return { ...result, provider: provider.kind };
}

export async function startPortal(userId: string, orgId: string) {
  await requireActiveOrg(userId, orgId, ["owner", "manager"]);
  const sql = await getSql();
  const sub = await sql<{ stripe_customer_id: string | null }>`
    select stripe_customer_id from org_subscriptions where org_id = ${orgId} limit 1
  `;
  const customerId = sub[0]?.stripe_customer_id;
  if (!customerId) {
    return { url: null, message: "No Stripe customer on file.", provider: getBillingProvider().kind };
  }
  const origin = appPublicUrl();
  const provider = getBillingProvider();
  const result = await provider.createPortal({
    customerId,
    returnUrl: `${origin}/platform`,
  });
  return { ...result, provider: provider.kind };
}

export async function applyStripeSubscription(opts: {
  orgId: string;
  planId?: string | null;
  status: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  periodEnd?: number | null;
}): Promise<void> {
  const planId = (opts.planId && PLAN_SLUGS.includes(opts.planId as PlanSlug)
    ? opts.planId
    : null) as PlanSlug | null;
  const mapped =
    opts.status === "active" || opts.status === "trialing"
      ? opts.status
      : opts.status === "past_due"
        ? "past_due"
        : "canceled";
  const sql = await getSql();
  const existing = await sql<{ id: string; plan_id: string }>`
    select id, plan_id from org_subscriptions where org_id = ${opts.orgId} limit 1
  `;
  const nextPlan = planId ?? (existing[0]?.plan_id as PlanSlug) ?? "starter";
  const period =
    opts.periodEnd != null ? new Date(opts.periodEnd * 1000).toISOString() : null;
  if (existing[0]) {
    await sql`
      update org_subscriptions
      set plan_id = ${nextPlan},
          status = ${mapped},
          stripe_customer_id = coalesce(${opts.customerId ?? null}, stripe_customer_id),
          stripe_subscription_id = coalesce(${opts.subscriptionId ?? null}, stripe_subscription_id),
          current_period_end = coalesce(${period}, current_period_end),
          updated_at = now()
      where org_id = ${opts.orgId}
    `;
  } else {
    await sql`
      insert into org_subscriptions (
        id, org_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end
      ) values (
        ${newId("sub")}, ${opts.orgId}, ${nextPlan}, ${mapped},
        ${opts.customerId ?? null}, ${opts.subscriptionId ?? null}, ${period}
      )
    `;
  }
  await writeAudit({
    orgId: opts.orgId,
    action: "plan_changed",
    payload: { source: "stripe", status: mapped, planId: nextPlan },
  });
}
