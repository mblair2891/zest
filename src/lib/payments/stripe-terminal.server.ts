/**
 * Live card-present adapter behind Quantum Payments.
 * Stripe Terminal is the processor rail — guests never see Stripe as a POS picker.
 * Never stores PAN or CVV.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import {
  isTestReader,
  stripeCapturePlan,
  stripePayoutPlan,
  stripeReaderAllowed,
  stripeTestPaymentIntentId,
  type StripeSplitLine,
} from "./adapter";
import { quantumSecretKey, stripeSecretKey } from "./mode";
import type { CardPresentInput, CardPresentResult } from "./types";

const STRIPE = "https://api.stripe.com/v1";

async function stripeForm(
  path: string,
  body: Record<string, string>,
  secret?: string,
): Promise<{ ok: boolean; json: Record<string, unknown>; status: number }> {
  const key = secret || quantumSecretKey();
  if (!key) {
    return { ok: false, status: 0, json: { error: { message: "Live keys missing" } } };
  }
  const res = await fetch(`${STRIPE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, json, status: res.status };
}

async function stripeGet(path: string, secret?: string): Promise<Record<string, unknown> | null> {
  const key = secret || quantumSecretKey();
  if (!key) return null;
  const res = await fetch(`${STRIPE}/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

function errMsg(json: Record<string, unknown>, fallback: string): string {
  const e = json.error as { message?: string } | undefined;
  return (e?.message || fallback).slice(0, 240);
}

function last4FromIntent(pi: Record<string, unknown>): string | null {
  const charges = pi.charges as { data?: Record<string, unknown>[] } | undefined;
  const charge = charges?.data?.[0];
  const details = charge?.payment_method_details as
    | { card_present?: { last4?: string }; card?: { last4?: string } }
    | undefined;
  const fromPresent = details?.card_present?.last4;
  const fromCard = details?.card?.last4;
  const latest = pi.latest_charge;
  if (latest && typeof latest === "object") {
    const d = (latest as { payment_method_details?: { card_present?: { last4?: string } } })
      .payment_method_details?.card_present?.last4;
    if (d) return d.replace(/\D/g, "").slice(-4) || null;
  }
  const raw = fromPresent || fromCard;
  return raw ? String(raw).replace(/\D/g, "").slice(-4) || null : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function captureLiveCardPresent(opts: {
  input: CardPresentInput;
  merchantId: string;
  readerId: string | null;
}): Promise<CardPresentResult> {
  if (!quantumSecretKey()) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error:
        "Live Quantum Payments is not configured. Use cash or keep the check open.",
    };
  }
  if (!opts.readerId) {
    return {
      ok: false,
      status: "requires_terminal",
      sandbox: false,
      error:
        "Present card on an enrolled Finix/Quantum reader supplied through Summex. Tablets run the POS; they are not card terminals. Customer-owned bank readers are not supported. Use cash or keep the check open.",
    };
  }

  const sql = await getSql();
  if (opts.input.clientMutationId) {
    const dup = await sql<{ id: string; last4: string | null; status: string }>`
      select id, last4, status from summex_payments
      where location_id = ${opts.input.locationId}
        and client_mutation_id = ${opts.input.clientMutationId}
      limit 1
    `;
    if (dup[0]?.status === "captured") {
      return {
        ok: true,
        status: "captured",
        sandbox: false,
        paymentId: dup[0].id,
        last4: dup[0].last4,
        hostBrand: opts.input.hostBrand ?? undefined,
      };
    }
  }

  const localId = newId("zpay");
  const created = await stripeForm("payment_intents", {
    amount: String(opts.input.amountCents),
    currency: "usd",
    "payment_method_types[0]": "card_present",
    capture_method: "automatic",
    description: `Quantum Payments · ${opts.input.hostBrand || "host"}`,
    "metadata[orgId]": opts.input.orgId,
    "metadata[locationId]": opts.input.locationId,
    "metadata[checkId]": opts.input.checkId ?? "",
    "metadata[summexPaymentId]": localId,
    "metadata[hostBrand]": (opts.input.hostBrand ?? "").slice(0, 80),
  });
  if (!created.ok) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error: errMsg(created.json, "Card capture could not start. Use cash or keep the check open."),
    };
  }
  const piId = String(created.json.id ?? "");
  if (!piId) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error: "Card capture could not start. Use cash or keep the check open.",
    };
  }

  const processed = await stripeForm(
    `terminal/readers/${encodeURIComponent(opts.readerId)}/process_payment_intent`,
    { payment_intent: piId },
  );
  if (!processed.ok) {
    await stripeForm(`payment_intents/${piId}/cancel`, {}).catch(() => undefined);
    return {
      ok: false,
      status: "requires_terminal",
      sandbox: false,
      error: errMsg(
        processed.json,
        "Could not reach the Quantum reader. Use cash or keep the check open.",
      ),
    };
  }

  let pi: Record<string, unknown> | null = created.json;
  for (let i = 0; i < 8; i += 1) {
    await sleep(700);
    pi = await stripeGet(`payment_intents/${piId}?expand[]=latest_charge`);
    const st = String(pi?.status ?? "");
    if (st === "succeeded") break;
    if (st === "canceled" || st === "requires_payment_method") break;
  }
  const st = String(pi?.status ?? "");
  if (st !== "succeeded") {
    return {
      ok: false,
      status: st === "canceled" ? "declined" : "timeout",
      sandbox: false,
      error:
        st === "canceled" || st === "requires_payment_method"
          ? "Card declined. Use cash or keep the check open."
          : "Card present timed out. Use cash or keep the check open.",
    };
  }

  const last4 = last4FromIntent(pi ?? {});
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, host_brand,
      client_mutation_id
    ) values (
      ${localId},
      ${opts.input.orgId},
      ${opts.input.locationId},
      ${opts.merchantId},
      ${opts.input.amountCents},
      ${"usd"},
      ${"captured"},
      ${"card"},
      ${last4},
      ${"quantum_payments"},
      ${piId},
      ${"live"},
      ${opts.input.checkId ?? null},
      ${opts.readerId},
      ${opts.input.hostBrand ?? null},
      ${opts.input.clientMutationId ?? null}
    )
    on conflict (id) do nothing
  `;
  return {
    ok: true,
    status: "captured",
    sandbox: false,
    paymentId: localId,
    last4,
    hostBrand: opts.input.hostBrand ?? undefined,
  };
}

async function insertStripePayment(opts: {
  localId: string;
  input: CardPresentInput;
  merchantId: string;
  readerId: string;
  piId: string;
  last4: string | null;
  test: boolean;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, host_brand,
      client_mutation_id
    ) values (
      ${opts.localId},
      ${opts.input.orgId},
      ${opts.input.locationId},
      ${opts.merchantId},
      ${opts.input.amountCents},
      ${"usd"},
      ${"captured"},
      ${"card"},
      ${opts.last4},
      ${"stripe"},
      ${opts.piId},
      ${opts.test ? "sandbox" : "live"},
      ${opts.input.checkId ?? null},
      ${opts.readerId},
      ${opts.input.hostBrand ?? null},
      ${opts.input.clientMutationId ?? null}
    )
    on conflict (id) do nothing
  `;
}

/**
 * Stripe Terminal behind Quantum Payments.
 * Training simulates a test reader when keys are absent or the reader is a test reader.
 * Live keys are used only when the location is Live.
 */
export async function captureStripeTerminal(opts: {
  input: CardPresentInput;
  merchantId: string;
  readerId: string | null;
  locationLive: boolean;
  readerModel?: string | null;
}): Promise<CardPresentResult> {
  const readerId = String(opts.readerId ?? "").trim();
  const secret = stripeSecretKey();
  const plan = stripeCapturePlan({
    locationLive: opts.locationLive,
    secret,
    readerId,
  });
  if (!plan.ok) {
    return { ok: false, status: plan.status, sandbox: !opts.locationLive, error: plan.error };
  }
  const model = String(opts.readerModel ?? "");
  const tap = /tap to pay/i.test(model);
  if (!plan.test && tap && !stripeReaderAllowed(model, "tap_to_pay")) {
    return {
      ok: false,
      status: "requires_terminal",
      sandbox: false,
      error: "Tap to Pay is only on a station model Stripe allows. Use a BBPOS or S700 reader, or cash.",
    };
  }

  const sql = await getSql();
  if (opts.input.clientMutationId) {
    const dup = await sql<{ id: string; last4: string | null; status: string }>`
      select id, last4, status from summex_payments
      where location_id = ${opts.input.locationId}
        and client_mutation_id = ${opts.input.clientMutationId}
      limit 1
    `;
    if (dup[0]?.status === "captured") {
      return {
        ok: true,
        status: "captured",
        sandbox: plan.test,
        paymentId: dup[0].id,
        last4: dup[0].last4,
        hostBrand: opts.input.hostBrand ?? undefined,
      };
    }
  }

  const lines: StripeSplitLine[] = (opts.input.entities ?? []).map((e) => ({
    entityId: e.entityId,
    displayName: e.displayName,
    amountCents: e.amountCents,
  }));
  const payout = stripePayoutPlan(lines);
  const localId = newId("zpay");

  if (plan.simulate || (plan.test && (isTestReader(readerId) || !secret))) {
    const piId = stripeTestPaymentIntentId(opts.input.checkId, opts.input.amountCents);
    await insertStripePayment({
      localId,
      input: opts.input,
      merchantId: opts.merchantId,
      readerId,
      piId,
      last4: "4242",
      test: true,
    });
    return {
      ok: true,
      status: "captured",
      sandbox: true,
      paymentId: localId,
      last4: "4242",
      hostBrand: opts.input.hostBrand ?? undefined,
      splits: opts.input.entities ?? undefined,
    };
  }

  const body: Record<string, string> = {
    amount: String(opts.input.amountCents),
    currency: "usd",
    "payment_method_types[0]": "card_present",
    capture_method: "automatic",
    description: `Quantum Payments · ${opts.input.hostBrand || "host"}`,
    "metadata[processor]": "stripe",
    "metadata[orgId]": opts.input.orgId,
    "metadata[locationId]": opts.input.locationId,
    "metadata[checkId]": opts.input.checkId ?? "",
    "metadata[summexPaymentId]": localId,
    "metadata[payout]": payout.mode,
  };
  lines.forEach((line, i) => {
    body[`metadata[split_${i}_entity]`] = line.entityId.slice(0, 40);
    body[`metadata[split_${i}_cents]`] = String(line.amountCents);
  });
  const created = await stripeForm("payment_intents", body, secret);
  if (!created.ok) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: plan.test,
      error: errMsg(created.json, "Card capture could not start. Use cash or keep the check open."),
    };
  }
  const piId = String(created.json.id ?? "");
  if (!piId) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: plan.test,
      error: "Card capture could not start. Use cash or keep the check open.",
    };
  }
  const processed = await stripeForm(
    `terminal/readers/${encodeURIComponent(readerId)}/process_payment_intent`,
    { payment_intent: piId },
    secret,
  );
  if (!processed.ok) {
    await stripeForm(`payment_intents/${piId}/cancel`, {}, secret).catch(() => undefined);
    return {
      ok: false,
      status: "requires_terminal",
      sandbox: plan.test,
      error: errMsg(processed.json, "Could not reach the reader. Use cash or keep the check open."),
    };
  }
  let pi: Record<string, unknown> | null = created.json;
  for (let i = 0; i < 8; i += 1) {
    await sleep(700);
    pi = await stripeGet(`payment_intents/${piId}?expand[]=latest_charge`, secret);
    const st = String(pi?.status ?? "");
    if (st === "succeeded" || st === "canceled" || st === "requires_payment_method") break;
  }
  const st = String(pi?.status ?? "");
  if (st !== "succeeded") {
    return {
      ok: false,
      status: st === "canceled" ? "declined" : "timeout",
      sandbox: plan.test,
      error:
        st === "canceled" || st === "requires_payment_method"
          ? "Card declined. Use cash or keep the check open."
          : "Card present timed out. Use cash or keep the check open.",
    };
  }
  if (payout.mode === "connected") {
    for (const transfer of payout.transfers) {
      await stripeForm(
        "transfers",
        {
          amount: String(transfer.amountCents),
          currency: "usd",
          destination: transfer.accountId,
          "metadata[entityId]": transfer.entityId,
          "metadata[paymentIntent]": piId,
        },
        secret,
      ).catch(() => undefined);
    }
  }
  const last4 = last4FromIntent(pi ?? {});
  await insertStripePayment({
    localId,
    input: opts.input,
    merchantId: opts.merchantId,
    readerId,
    piId,
    last4,
    test: plan.test,
  });
  return {
    ok: true,
    status: "captured",
    sandbox: plan.test,
    paymentId: localId,
    last4,
    hostBrand: opts.input.hostBrand ?? undefined,
    splits: opts.input.entities ?? undefined,
  };
}

export async function applyStripeWebhookEvent(event: {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}): Promise<{ duplicate: boolean; applied: boolean }> {
  const eventId = String(event.id ?? "").trim();
  if (!eventId) return { duplicate: false, applied: false };
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from stripe_webhook_events where event_id = ${eventId} limit 1
  `;
  if (existing[0]) return { duplicate: true, applied: false };
  try {
    await sql`
      insert into stripe_webhook_events (id, event_id, event_type, payload)
      values (${newId("swe")}, ${eventId}, ${String(event.type ?? "").slice(0, 80)}, ${JSON.stringify(event)}::jsonb)
    `;
  } catch {
    return { duplicate: true, applied: false };
  }
  if (event.type === "payment_intent.succeeded" && event.data?.object) {
    await applyLivePaymentIntent(event.data.object);
    return { duplicate: false, applied: true };
  }
  return { duplicate: false, applied: false };
}

export async function applyLivePaymentIntent(pi: Record<string, unknown>): Promise<void> {
  const id = String(pi.id ?? "");
  const st = String(pi.status ?? "");
  if (!id || st !== "succeeded") return;
  const sql = await getSql();
  const last4 = last4FromIntent(pi);
  await sql`
    update summex_payments
    set status = ${"captured"}, last4 = coalesce(${last4}, last4)
    where processor_payment_id = ${id} and status <> ${"captured"}
  `;
}
