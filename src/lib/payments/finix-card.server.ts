/**
 * Quantum Payments card authorization on the Finix rail.
 * Sandbox keys stay on the sandbox host. Live keys run only when the location is live.
 * Run card authorizes the check. Apply tip and close captures that authorization.
 * Training and sandbox close the check without a tip adjust. A live capture failure leaves the check open.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import { authorizeCardPresent, captureAuthorization, voidAuthorization } from "./finix";
import { mintFinixAttemptIdempotencyId } from "./idempotency";
import { claimPaymentIdempotencyId } from "./payment-idempotency.server";
import { TIP_CAPTURE_FAILED, logTipAdjust, tipCaptureOutcome } from "./tip-capture";
import { missingFinixKeyMessage, readFinixCreds, type FinixMode } from "./finix-keys";
import { liveCardGate } from "./finix-events";
import { envPaymentsDefault, locationLifecycleStatus, parseLocationPaymentsMode, resolvePaymentsMode } from "./mode";
import { finixCaptureRoute } from "./training-rail";
import type { CardPresentInput, CardPresentResult } from "./types";

type PaymentAttemptRow = {
  id: string;
  last4: string | null;
  status: string;
  idempotency_id: string | null;
};

async function beginCardPresentAttempt(
  sql: Awaited<ReturnType<typeof getSql>>,
  opts: {
    input: CardPresentInput;
    merchantId: string;
    readerId: string | null;
    sandbox: boolean;
  },
): Promise<
  | { done: true; paymentId: string; status: "authorized" | "captured"; last4: string | null }
  | { done: false; paymentId: string; idempotencyId: string }
> {
  const mutationId = String(opts.input.clientMutationId ?? "").trim();
  const load = async () => {
    if (!mutationId) return undefined;
    const rows = await sql<PaymentAttemptRow>`
      select id, last4, status, idempotency_id from summex_payments
      where location_id = ${opts.input.locationId}
        and client_mutation_id = ${mutationId}
      limit 1
    `;
    return rows[0];
  };
  const finish = async (
    row: PaymentAttemptRow,
  ): Promise<
    | { done: true; paymentId: string; status: "authorized" | "captured"; last4: string | null }
    | { done: false; paymentId: string; idempotencyId: string }
  > => {
    if (row.status === "authorized" || row.status === "captured") {
      return {
        done: true,
        paymentId: row.id,
        status: row.status,
        last4: row.last4,
      };
    }
    const idempotencyId = await claimPaymentIdempotencyId({
      paymentId: row.id,
      locationId: opts.input.locationId,
      existing: row.idempotency_id,
    });
    return { done: false as const, paymentId: row.id, idempotencyId };
  };
  const existing = await load();
  if (existing) return finish(existing);

  const paymentId = newId("zpay");
  const idempotencyId = mintFinixAttemptIdempotencyId();
  try {
    await sql`
      insert into summex_payments (
        id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
        processor, processor_payment_id, capture_mode, check_id, reader_id, host_brand,
        client_mutation_id, idempotency_id
      ) values (
        ${paymentId},
        ${opts.input.orgId},
        ${opts.input.locationId},
        ${opts.merchantId},
        ${opts.input.amountCents},
        ${"usd"},
        ${"pending"},
        ${"card"},
        ${null},
        ${"quantum_payments"},
        ${null},
        ${opts.sandbox ? "sandbox" : "live"},
        ${opts.input.checkId ?? null},
        ${opts.readerId},
        ${opts.input.hostBrand ?? null},
        ${mutationId || null},
        ${idempotencyId}
      )
    `;
    return { done: false, paymentId, idempotencyId };
  } catch (err) {
    const raced = await load();
    if (raced) return finish(raced);
    throw err;
  }
}

export async function captureFinixCardPresent(opts: {
  input: CardPresentInput;
  merchantId: string;
  readerId: string | null;
  splits?: Array<{ merchantId: string; amountCents: number }>;
  mode?: FinixMode;
  locationLive?: boolean;
}): Promise<CardPresentResult> {
  const mode: FinixMode = opts.mode ?? (opts.locationLive ? "live" : "sandbox");
  const sandbox = mode === "sandbox";
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    return {
      ok: false,
      status: "unavailable",
      sandbox,
      error: missingFinixKeyMessage(creds.missing),
    };
  }
  const merchantId = opts.merchantId.trim();
  if (mode === "live") {
    const gate = liveCardGate({ locationLive: opts.locationLive !== false, merchantId });
    if (!gate.ok) {
      return { ok: false, status: "unavailable", sandbox: false, error: gate.error };
    }
    if (!opts.readerId) {
      return {
        ok: false,
        status: "requires_terminal",
        sandbox: false,
        error:
          "Present card on an enrolled Quantum reader supplied through Summex. Tablets run the POS; they are not card terminals. Use cash or keep the check open.",
      };
    }
  } else if (!merchantId) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: true,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }

  const sql = await getSql();
  const attempt = await beginCardPresentAttempt(sql, {
    input: opts.input,
    merchantId,
    readerId: opts.readerId,
    sandbox,
  });
  if (attempt.done) {
    return {
      ok: true,
      status: attempt.status,
      sandbox,
      paymentId: attempt.paymentId,
      last4: attempt.last4,
      hostBrand: opts.input.hostBrand ?? undefined,
    };
  }

  const authorized = await authorizeCardPresent({
    mode,
    locationLive: mode === "live",
    merchantId,
    amountCents: opts.input.amountCents,
    readerId: opts.readerId,
    checkId: opts.input.checkId,
    splits: opts.splits,
    idempotencyId: attempt.idempotencyId,
  });
  if (!authorized.ok || !authorized.id) {
    if (authorized.keepIdempotency === false) {
      await sql`
        update summex_payments
        set idempotency_id = null
        where id = ${attempt.paymentId}
          and location_id = ${opts.input.locationId}
          and processor_payment_id is null
      `;
    }
    return {
      ok: false,
      status: "unavailable",
      sandbox,
      error: authorized.error || "Card capture could not start. Use cash or keep the check open.",
    };
  }

  await sql`
    update summex_payments
    set status = ${"authorized"},
        processor_payment_id = ${authorized.id},
        last4 = ${authorized.last4},
        merchant_id = ${merchantId},
        amount_cents = ${opts.input.amountCents},
        reader_id = ${opts.readerId},
        idempotency_id = ${attempt.idempotencyId},
        capture_mode = ${sandbox ? "sandbox" : "live"}
    where id = ${attempt.paymentId}
      and location_id = ${opts.input.locationId}
  `;
  return {
    ok: true,
    status: "authorized",
    sandbox,
    paymentId: attempt.paymentId,
    authorizationId: authorized.id,
    last4: authorized.last4,
    hostBrand: opts.input.hostBrand ?? undefined,
  };
}

function setupOf(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as LocationSetup) };
}

async function modeForCheck(opts: {
  userId: string;
  locationId: string;
  orgId: string;
}): Promise<
  | { ok: true; mode: FinixMode; sandbox: boolean }
  | { ok: false; error: string; sandbox: boolean }
> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string; setup: unknown; lifecycle_status: string | null }>`
    select org_id, setup, lifecycle_status from locations where id = ${opts.locationId} limit 1
  `;
  const loc = rows[0];
  if (!loc) return { ok: false, error: "Location not found", sandbox: true };
  if (loc.org_id !== opts.orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(opts.userId, loc.org_id, undefined, opts.locationId);
  const setup = setupOf(loc.setup);
  const resolved = resolvePaymentsMode({
    platformDefault: envPaymentsDefault(),
    locationOverride: parseLocationPaymentsMode(setup.paymentsMode),
    lifecycleStatus: locationLifecycleStatus(setup, loc.lifecycle_status),
  });
  const locationLive = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  const route = finixCaptureRoute({
    locationLive,
    paymentsMode: resolved.mode,
    sandboxKeys: readFinixCreds("sandbox").ok,
    liveKeys: readFinixCreds("live").ok,
  });
  const sandbox = !locationLive || resolved.mode === "sandbox";
  if (!route.ok) {
    const missing = route.reason === "missing-live" ? readFinixCreds("live") : readFinixCreds("sandbox");
    const key = missing.ok ? "FINIX_USERNAME" : missing.missing;
    return { ok: false, error: missingFinixKeyMessage(key), sandbox };
  }
  return { ok: true, mode: route.mode, sandbox: route.mode === "sandbox" };
}

async function markAuthorizationCaptured(
  locationId: string,
  authorizationId: string,
  captureAmountCents: number,
): Promise<void> {
  try {
    const sql = await getSql();
    await sql`
      update summex_payments
      set status = ${"captured"}, amount_cents = ${captureAmountCents}
      where location_id = ${locationId}
        and status = ${"authorized"}
        and processor_payment_id = ${authorizationId}
    `;
  } catch {
    /* The card is captured. A bookkeeping miss does not keep the check open. */
  }
}

export async function captureCheckAuthorization(
  userId: string,
  input: {
    locationId: string;
    orgId: string;
    authorizationId: string;
    captureAmountCents: number;
    tipCents: number;
    checkId?: string;
    paymentId?: string;
  },
): Promise<{ ok: true; transferId: string | null; sandbox: boolean } | { ok: false; error: string; sandbox: boolean }> {
  const tipCents = Math.max(0, Math.round(input.tipCents));
  const captureAmountCents = Math.max(0, Math.round(input.captureAmountCents));
  const authorizationId = String(input.authorizationId ?? "").trim();
  const trace = {
    authorizationId,
    captureAmountCents,
    tipCents,
    checkId: input.checkId,
  };
  if (authorizationId && tipCents <= 0) {
    logTipAdjust({ phase: "request", sandbox: false, simulated: true, ...trace });
    logTipAdjust({
      phase: "response",
      sandbox: false,
      simulated: true,
      ok: true,
      transferId: authorizationId,
      ...trace,
    });
    await markAuthorizationCaptured(input.locationId, authorizationId, captureAmountCents);
    return { ok: true, transferId: authorizationId, sandbox: false };
  }
  try {
    const routed = await modeForCheck({ userId, locationId: input.locationId, orgId: input.orgId });
    logTipAdjust({
      phase: "request",
      sandbox: routed.sandbox,
      simulated: Boolean(routed.ok && routed.sandbox),
      ...trace,
    });
    if (!routed.ok) {
      const outcome = tipCaptureOutcome({
        sandbox: routed.sandbox,
        capturedOk: false,
        error: routed.error,
        authorizationId,
        tipCents,
      });
      logTipAdjust({
        phase: "response",
        sandbox: routed.sandbox,
        simulated: outcome.ok,
        ok: outcome.ok,
        error: routed.error,
        transferId: outcome.ok ? outcome.transferId ?? undefined : undefined,
        ...trace,
      });
      if (!outcome.ok) return { ok: false, error: outcome.error || TIP_CAPTURE_FAILED, sandbox: routed.sandbox };
      return { ok: true, transferId: outcome.transferId, sandbox: routed.sandbox };
    }
    if (routed.sandbox) {
      if (!authorizationId) return { ok: false, error: TIP_CAPTURE_FAILED, sandbox: true };
      logTipAdjust({
        phase: "response",
        sandbox: true,
        simulated: true,
        ok: true,
        transferId: authorizationId,
        ...trace,
      });
      await markAuthorizationCaptured(input.locationId, authorizationId, captureAmountCents);
      return { ok: true, transferId: authorizationId, sandbox: true };
    }
    let captured: { ok: boolean; transferId?: string; error?: string; sandbox: boolean };
    try {
      captured = await captureAuthorization({
        mode: routed.mode,
        authorizationId,
        captureAmountCents,
        tipCents,
        checkId: input.checkId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : TIP_CAPTURE_FAILED;
      captured = { ok: false, error: message, sandbox: routed.sandbox };
    }
    const outcome = tipCaptureOutcome({
      sandbox: routed.sandbox,
      capturedOk: captured.ok,
      error: captured.error,
      transferId: captured.transferId,
      authorizationId,
      tipCents,
    });
    logTipAdjust({
      phase: "response",
      sandbox: routed.sandbox,
      simulated: outcome.ok && !captured.ok,
      ok: outcome.ok,
      error: captured.ok ? undefined : captured.error,
      transferId: outcome.ok ? outcome.transferId ?? captured.transferId : undefined,
      ...trace,
    });
    if (!outcome.ok) {
      return { ok: false, error: outcome.error || TIP_CAPTURE_FAILED, sandbox: routed.sandbox };
    }
    await markAuthorizationCaptured(input.locationId, authorizationId, captureAmountCents);
    return { ok: true, transferId: outcome.transferId, sandbox: routed.sandbox };
  } catch (err) {
    const message = err instanceof Error ? err.message : TIP_CAPTURE_FAILED;
    const outcome = tipCaptureOutcome({
      sandbox: false,
      capturedOk: false,
      error: message,
      authorizationId,
      tipCents,
    });
    logTipAdjust({
      phase: "response",
      sandbox: false,
      simulated: outcome.ok,
      ok: outcome.ok,
      error: message,
      transferId: outcome.ok ? outcome.transferId ?? undefined : undefined,
      ...trace,
    });
    if (!outcome.ok) return { ok: false, error: outcome.error || message, sandbox: false };
    return { ok: true, transferId: outcome.transferId, sandbox: false };
  }
}

export async function voidCheckAuthorization(
  userId: string,
  input: {
    locationId: string;
    orgId: string;
    authorizationId: string;
    checkId?: string;
  },
): Promise<{ ok: true; sandbox: boolean } | { ok: false; error: string; sandbox: boolean }> {
  const routed = await modeForCheck({ userId, locationId: input.locationId, orgId: input.orgId });
  if (!routed.ok) return { ok: false, error: routed.error, sandbox: routed.sandbox };
  const voided = await voidAuthorization({ mode: routed.mode, authorizationId: input.authorizationId });
  if (!voided.ok) {
    return { ok: false, error: voided.error || "The authorization could not be voided. The check stays open.", sandbox: voided.sandbox };
  }
  const sql = await getSql();
  await sql`
    update summex_payments
    set status = ${"voided"}
    where location_id = ${input.locationId}
      and status = ${"authorized"}
      and processor_payment_id = ${input.authorizationId}
  `;
  return { ok: true, sandbox: voided.sandbox };
}
