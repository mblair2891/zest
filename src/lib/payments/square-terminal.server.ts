/**
 * Square Terminal HTTP. One location id from the environment.
 * Does not store a card number.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { readServerEnv } from "@/lib/database-url";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { parseLocationDevices, type LocationDevice } from "@/lib/pos/location-devices";
import { locationLifecycleStatus } from "./mode";
import { cardPresentDispatch, parseCardProcessor } from "./adapter";
import {
  SQUARE_PING_CENTS,
  SQUARE_VERSION,
  checkoutOutcome,
  deviceCodeBody,
  parseSquareWebhook,
  readSquareConfig,
  squareApiBase,
  squareChargePlan,
  squareWebhookNotificationUrl,
  terminalCheckoutBody,
  verifySquareWebhook,
  type ParsedSquareEvent,
  type SquareConfig,
} from "./square-terminal";

type CheckoutRow = {
  id: string;
  org_id: string;
  location_id: string;
  check_id: string | null;
  device_id: string | null;
  amount_cents: number;
  status: string;
  square_checkout_id: string | null;
  square_payment_id: string | null;
  sandbox: boolean;
  simulated: boolean;
  error: string | null;
};

export type SquareCallResult = {
  ok: boolean;
  error?: string;
  code?: string;
  codeId?: string;
  deviceId?: string;
  pairStatus?: "unpaired" | "paired";
  checkoutId?: string;
  squareCheckoutId?: string;
  status?: string;
  paymentId?: string | null;
  last4?: string | null;
  sandbox?: boolean;
  simulated?: boolean;
};

function squareEnv(): Record<string, string | undefined> {
  return {
    SQUARE_ACCESS_TOKEN: readServerEnv("SQUARE_ACCESS_TOKEN"),
    SQUARE_APPLICATION_ID: readServerEnv("SQUARE_APPLICATION_ID"),
    SQUARE_LOCATION_ID: readServerEnv("SQUARE_LOCATION_ID"),
    SQUARE_ENVIRONMENT: readServerEnv("SQUARE_ENVIRONMENT"),
    SQUARE_WEBHOOK_SIGNATURE_KEY: readServerEnv("SQUARE_WEBHOOK_SIGNATURE_KEY"),
    APP_URL: readServerEnv("APP_URL"),
  };
}

function configOrNull(): SquareConfig | null {
  return readSquareConfig(squareEnv());
}

async function squareFetch(
  cfg: SquareConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${squareApiBase(cfg.environment)}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function squareError(json: Record<string, unknown>, fallback: string): string {
  const errors = json.errors as { detail?: string; code?: string }[] | undefined;
  return String(errors?.[0]?.detail || errors?.[0]?.code || fallback).slice(0, 240);
}

async function loadSetup(locationId: string): Promise<{
  orgId: string;
  setup: Record<string, unknown>;
  lifecycle: string | null;
}> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string; setup: unknown; lifecycle_status: string | null }>`
    select org_id, setup, lifecycle_status from locations where id = ${locationId} limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  const setup = row.setup && typeof row.setup === "object" ? (row.setup as Record<string, unknown>) : {};
  return { orgId: row.org_id, setup, lifecycle: row.lifecycle_status };
}

function assertSquareRail(setup: Record<string, unknown>): string | null {
  if (cardPresentDispatch(parseCardProcessor(setup.cardProcessor)) !== "square") {
    return "This venue is not on the Square Terminal rail.";
  }
  return null;
}

async function writeDevices(locationId: string, devices: LocationDevice[]): Promise<void> {
  const sql = await getSql();
  await sql`
    update locations
    set setup = jsonb_set(coalesce(setup, '{}'::jsonb), '{locationDevices}', ${JSON.stringify(devices)}::jsonb)
    where id = ${locationId}
  `;
}

function patchDevice(
  devices: LocationDevice[],
  deviceRowId: string,
  patch: Partial<LocationDevice>,
): LocationDevice[] {
  return devices.map((device) => (device.id === deviceRowId ? { ...device, ...patch } : device));
}

export async function createSquareDeviceCode(opts: {
  userId: string;
  locationId: string;
  deviceRowId: string;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const blocked = assertSquareRail(loc.setup);
  if (blocked) return { ok: false, error: blocked };
  const cfg = configOrNull();
  if (!cfg) return { ok: false, error: "Square is not configured." };
  const devices = parseLocationDevices(loc.setup.locationDevices);
  const row = devices.find((device) => device.id === opts.deviceRowId);
  if (!row) return { ok: false, error: "Pick a card terminal row first." };
  const created = await squareFetch(cfg, "/v2/devices/codes", {
    method: "POST",
    body: deviceCodeBody({
      idempotencyKey: newId("sqc").replace(/[^a-zA-Z0-9]/g, "").slice(0, 45),
      locationId: cfg.locationId,
      name: "Card terminal",
    }),
  });
  if (!created.ok) return { ok: false, error: squareError(created.json, "Could not create a device code.") };
  const deviceCode = (created.json.device_code ?? {}) as Record<string, unknown>;
  const code = String(deviceCode.code ?? "");
  const codeId = String(deviceCode.id ?? "");
  if (!code || !codeId) return { ok: false, error: "Square did not return a device code." };
  await writeDevices(
    opts.locationId,
    patchDevice(devices, row.id, {
      squareCodeId: codeId,
      squareDeviceCode: code,
      squarePairStatus: "unpaired",
      squareDeviceId: undefined,
    }),
  );
  return { ok: true, code, codeId, pairStatus: "unpaired" };
}

export async function refreshSquareDeviceCode(opts: {
  userId: string;
  locationId: string;
  deviceRowId: string;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const devices = parseLocationDevices(loc.setup.locationDevices);
  const row = devices.find((device) => device.id === opts.deviceRowId);
  if (!row) return { ok: false, error: "Pick a card terminal row first." };
  if (row.squarePairStatus === "paired" && row.squareDeviceId) {
    return { ok: true, code: row.squareDeviceCode, codeId: row.squareCodeId, deviceId: row.squareDeviceId, pairStatus: "paired" };
  }
  const cfg = configOrNull();
  if (!cfg || !row.squareCodeId) {
    return { ok: true, code: row.squareDeviceCode, pairStatus: row.squarePairStatus ?? "unpaired" };
  }
  const got = await squareFetch(cfg, `/v2/devices/codes/${encodeURIComponent(row.squareCodeId)}`);
  if (!got.ok) return { ok: false, error: squareError(got.json, "Could not check the device code.") };
  const deviceCode = (got.json.device_code ?? {}) as Record<string, unknown>;
  const paired = String(deviceCode.status ?? "").toUpperCase() === "PAIRED" && Boolean(deviceCode.device_id);
  const deviceId = paired ? String(deviceCode.device_id) : undefined;
  await writeDevices(
    opts.locationId,
    patchDevice(devices, row.id, {
      squarePairStatus: paired ? "paired" : "unpaired",
      squareDeviceId: deviceId,
      squareDeviceCode: deviceCode.code ? String(deviceCode.code) : row.squareDeviceCode,
    }),
  );
  return {
    ok: true,
    code: deviceCode.code ? String(deviceCode.code) : row.squareDeviceCode,
    codeId: row.squareCodeId,
    deviceId,
    pairStatus: paired ? "paired" : "unpaired",
  };
}

async function insertCheckout(row: {
  id: string;
  orgId: string;
  locationId: string;
  checkId: string | null;
  deviceId: string | null;
  amountCents: number;
  status: string;
  squareCheckoutId: string | null;
  squarePaymentId: string | null;
  referenceId: string;
  note: string;
  sandbox: boolean;
  simulated: boolean;
  clientMutationId: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into square_checkouts (
      id, org_id, location_id, check_id, device_id, amount_cents, status,
      square_checkout_id, square_payment_id, reference_id, note, sandbox, simulated, client_mutation_id
    ) values (
      ${row.id},
      ${row.orgId},
      ${row.locationId},
      ${row.checkId},
      ${row.deviceId},
      ${row.amountCents},
      ${row.status},
      ${row.squareCheckoutId},
      ${row.squarePaymentId},
      ${row.referenceId},
      ${row.note},
      ${row.sandbox},
      ${row.simulated},
      ${row.clientMutationId}
    )
  `;
}

async function markCheckout(opts: {
  id: string;
  status: string;
  paymentId?: string | null;
  error?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    update square_checkouts
    set status = ${opts.status},
        square_payment_id = coalesce(${opts.paymentId ?? null}, square_payment_id),
        error = ${opts.error ?? null},
        updated_at = now()
    where id = ${opts.id}
  `;
}

async function rememberSquarePayment(opts: {
  orgId: string;
  locationId: string;
  amountCents: number;
  checkId: string | null;
  deviceId: string | null;
  paymentId: string;
  sandbox: boolean;
  last4: string | null;
}): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from summex_payments
    where processor = ${"square"} and processor_payment_id = ${opts.paymentId}
    limit 1
  `;
  if (existing[0]) return;
  const merchants = await sql<{ id: string }>`
    select id from summex_merchants
    where org_id = ${opts.orgId} and location_id = ${opts.locationId}
    limit 1
  `;
  let merchantId = merchants[0]?.id;
  if (!merchantId) {
    merchantId = newId("zmer");
    await sql`
      insert into summex_merchants (id, org_id, location_id, status)
      values (${merchantId}, ${opts.orgId}, ${opts.locationId}, ${opts.sandbox ? "sandbox" : "live"})
    `;
  }
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id
    ) values (
      ${newId("zpay")},
      ${opts.orgId},
      ${opts.locationId},
      ${merchantId},
      ${opts.amountCents},
      ${"usd"},
      ${"captured"},
      ${"card"},
      ${opts.last4},
      ${"square"},
      ${opts.paymentId},
      ${opts.sandbox ? "sandbox" : "live"},
      ${opts.checkId},
      ${opts.deviceId}
    )
  `;
}

async function last4ForPayment(cfg: SquareConfig, paymentId: string): Promise<string | null> {
  const got = await squareFetch(cfg, `/v2/payments/${encodeURIComponent(paymentId)}`);
  if (!got.ok) return null;
  const payment = (got.json.payment ?? {}) as Record<string, unknown>;
  const card = (payment.card_details as { card?: { last_4?: string } } | undefined)?.card;
  const raw = String(card?.last_4 ?? "").replace(/\D/g, "");
  return raw ? raw.slice(-4) : null;
}

export async function startSquareCheckout(opts: {
  userId: string;
  locationId: string;
  amountCents: number;
  checkId?: string;
  referenceId?: string;
  note?: string;
  deviceId?: string;
  clientMutationId?: string;
  /** False for the $1 test ping so a simulated checkout is not stored as captured. */
  ledger?: boolean;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const blocked = assertSquareRail(loc.setup);
  if (blocked) return { ok: false, error: blocked };
  const amount = Math.round(opts.amountCents);
  if (!(amount > 0)) return { ok: false, error: "Invalid amount" };
  const live = locationLifecycleStatus(
    { lifecycleStatus: typeof loc.setup.lifecycleStatus === "string" ? loc.setup.lifecycleStatus : null },
    loc.lifecycle,
  ) === "live";
  const cfg = configOrNull();
  const devices = parseLocationDevices(loc.setup.locationDevices);
  const paired = devices.find((device) => device.squareDeviceId);
  const deviceId = String(opts.deviceId || paired?.squareDeviceId || "").trim();
  const plan = squareChargePlan({
    locationLive: live,
    squareLiveCards: loc.setup.squareLiveCards === true,
    environment: cfg?.environment ?? null,
    hasToken: Boolean(cfg),
    deviceId,
  });
  if (!plan.ok) return { ok: false, error: plan.error };
  const referenceId = String(opts.referenceId || opts.checkId || "").slice(0, 40);
  const note = String(opts.note || "Check").slice(0, 500);
  const localId = newId("sqco");
  if (plan.simulate || !cfg) {
    const paymentId = `sq_sim_${localId}`;
    await insertCheckout({
      id: localId,
      orgId: loc.orgId,
      locationId: opts.locationId,
      checkId: opts.checkId ?? null,
      deviceId: deviceId || null,
      amountCents: amount,
      status: "COMPLETED",
      squareCheckoutId: null,
      squarePaymentId: paymentId,
      referenceId,
      note,
      sandbox: true,
      simulated: true,
      clientMutationId: opts.clientMutationId ?? null,
    });
    if (opts.ledger !== false) {
      await rememberSquarePayment({
        orgId: loc.orgId,
        locationId: opts.locationId,
        amountCents: amount,
        checkId: opts.checkId ?? null,
        deviceId: deviceId || null,
        paymentId,
        sandbox: true,
        last4: null,
      });
    }
    return {
      ok: true,
      checkoutId: localId,
      status: "COMPLETED",
      paymentId,
      sandbox: true,
      simulated: true,
    };
  }
  const idempotencyKey = (opts.clientMutationId || localId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 45);
  const created = await squareFetch(cfg, "/v2/terminals/checkouts", {
    method: "POST",
    body: terminalCheckoutBody({
      amountCents: amount,
      deviceId,
      referenceId,
      note,
      idempotencyKey,
    }),
  });
  if (!created.ok) return { ok: false, error: squareError(created.json, "Could not start the Square Terminal.") };
  const checkout = (created.json.checkout ?? {}) as Record<string, unknown>;
  const squareCheckoutId = String(checkout.id ?? "");
  if (!squareCheckoutId) return { ok: false, error: "Square did not return a checkout." };
  await insertCheckout({
    id: localId,
    orgId: loc.orgId,
    locationId: opts.locationId,
    checkId: opts.checkId ?? null,
    deviceId,
    amountCents: amount,
    status: String(checkout.status ?? "PENDING"),
    squareCheckoutId,
    squarePaymentId: null,
    referenceId,
    note,
    sandbox: plan.mode !== "production",
    simulated: false,
    clientMutationId: opts.clientMutationId ?? null,
  });
  return {
    ok: true,
    checkoutId: localId,
    squareCheckoutId,
    status: String(checkout.status ?? "PENDING"),
    sandbox: plan.mode !== "production",
    simulated: false,
  };
}

async function readCheckout(id: string): Promise<CheckoutRow | null> {
  const sql = await getSql();
  const rows = await sql<CheckoutRow>`
    select id, org_id, location_id, check_id, device_id, amount_cents, status,
           square_checkout_id, square_payment_id, sandbox, simulated, error
    from square_checkouts
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

async function applyCheckoutStatus(row: CheckoutRow, status: string, paymentId: string | null): Promise<SquareCallResult> {
  const outcome = checkoutOutcome(status);
  const next = outcome === "completed" ? "COMPLETED" : outcome === "canceled" ? "CANCELED" : outcome === "failed" ? "FAILED" : status.toUpperCase() || "PENDING";
  let last4: string | null = null;
  if (outcome === "completed" && paymentId) {
    const cfg = configOrNull();
    if (cfg && !paymentId.startsWith("sq_sim_")) last4 = await last4ForPayment(cfg, paymentId);
    await rememberSquarePayment({
      orgId: row.org_id,
      locationId: row.location_id,
      amountCents: row.amount_cents,
      checkId: row.check_id,
      deviceId: row.device_id,
      paymentId,
      sandbox: row.sandbox,
      last4,
    });
  }
  await markCheckout({
    id: row.id,
    status: next,
    paymentId,
    error: outcome === "failed" ? "Card failed" : outcome === "canceled" ? "Card canceled" : null,
  });
  return {
    ok: outcome === "completed",
    checkoutId: row.id,
    squareCheckoutId: row.square_checkout_id ?? undefined,
    status: next,
    paymentId,
    last4,
    sandbox: row.sandbox,
    simulated: row.simulated,
    error: outcome === "completed" ? undefined : outcome === "canceled" ? "Card canceled. The check stays open." : outcome === "failed" ? "Card failed. The check stays open." : undefined,
  };
}

export async function squareCheckoutStatus(opts: {
  userId: string;
  locationId: string;
  checkoutId: string;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const row = await readCheckout(opts.checkoutId);
  if (!row || row.location_id !== opts.locationId) return { ok: false, error: "Checkout not found" };
  const outcome = checkoutOutcome(row.status);
  if (outcome !== "pending") {
    return {
      ok: outcome === "completed",
      checkoutId: row.id,
      status: row.status,
      paymentId: row.square_payment_id,
      sandbox: row.sandbox,
      simulated: row.simulated,
      error: row.error ?? undefined,
    };
  }
  const cfg = configOrNull();
  if (!cfg || !row.square_checkout_id || row.simulated) {
    return { ok: true, checkoutId: row.id, status: row.status, sandbox: row.sandbox, simulated: row.simulated };
  }
  const got = await squareFetch(cfg, `/v2/terminals/checkouts/${encodeURIComponent(row.square_checkout_id)}`);
  if (!got.ok) return { ok: true, checkoutId: row.id, status: row.status, sandbox: row.sandbox };
  const checkout = (got.json.checkout ?? {}) as Record<string, unknown>;
  const payments = Array.isArray(checkout.payment_ids) ? checkout.payment_ids : [];
  const paymentId = payments.length ? String(payments[0] ?? "") || null : null;
  const status = String(checkout.status ?? row.status);
  if (checkoutOutcome(status) === "pending") {
    return { ok: true, checkoutId: row.id, squareCheckoutId: row.square_checkout_id, status, sandbox: row.sandbox };
  }
  return applyCheckoutStatus(row, status, paymentId);
}

export async function cancelSquareCheckout(opts: {
  userId: string;
  locationId: string;
  checkoutId: string;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const row = await readCheckout(opts.checkoutId);
  if (!row || row.location_id !== opts.locationId) return { ok: false, error: "Checkout not found" };
  if (checkoutOutcome(row.status) === "completed") {
    return { ok: false, error: "This checkout already completed." };
  }
  const cfg = configOrNull();
  if (cfg && row.square_checkout_id && !row.simulated) {
    await squareFetch(cfg, `/v2/terminals/checkouts/${encodeURIComponent(row.square_checkout_id)}/cancel`, {
      method: "POST",
      body: {},
    });
  }
  await markCheckout({ id: row.id, status: "CANCELED", error: "Card canceled" });
  return { ok: true, checkoutId: row.id, status: "CANCELED" };
}

export async function squareTestPing(opts: {
  userId: string;
  locationId: string;
  deviceRowId: string;
  managerConfirm?: boolean;
}): Promise<SquareCallResult> {
  const loc = await loadSetup(opts.locationId);
  await requireMembership(opts.userId, loc.orgId, undefined, opts.locationId);
  const blocked = assertSquareRail(loc.setup);
  if (blocked) return { ok: false, error: blocked };
  const devices = parseLocationDevices(loc.setup.locationDevices);
  const row = devices.find((device) => device.id === opts.deviceRowId);
  if (!row?.squareDeviceId) return { ok: false, error: "Pair a Square Terminal first." };
  const live = locationLifecycleStatus(
    { lifecycleStatus: typeof loc.setup.lifecycleStatus === "string" ? loc.setup.lifecycleStatus : null },
    loc.lifecycle,
  ) === "live";
  if (live && !opts.managerConfirm) {
    return { ok: false, error: "A manager must confirm the Square Terminal test." };
  }
  const started = await startSquareCheckout({
    userId: opts.userId,
    locationId: opts.locationId,
    amountCents: SQUARE_PING_CENTS,
    note: "Terminal test",
    referenceId: `ping-${row.id}`.slice(0, 40),
    deviceId: row.squareDeviceId,
    clientMutationId: newId("ping"),
    ledger: false,
  });
  if (!started.ok || !started.checkoutId) return started;
  if (started.simulated) {
    await markCheckout({ id: started.checkoutId, status: "CANCELED", error: "Test canceled" });
    return { ok: true, checkoutId: started.checkoutId, status: "CANCELED", sandbox: true, simulated: true };
  }
  const canceled = await cancelSquareCheckout({
    userId: opts.userId,
    locationId: opts.locationId,
    checkoutId: started.checkoutId,
  });
  return { ...canceled, sandbox: started.sandbox };
}

async function pairFromEvent(event: Extract<ParsedSquareEvent, { kind: "device" }>): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ id: string; setup: unknown }>`select id, setup from locations`;
  for (const loc of rows) {
    const devices = parseLocationDevices((loc.setup as { locationDevices?: unknown } | null)?.locationDevices);
    const hit = devices.find((device) => device.squareCodeId === event.codeId);
    if (!hit) continue;
    await writeDevices(
      loc.id,
      patchDevice(devices, hit.id, {
        squarePairStatus: event.deviceId ? "paired" : "unpaired",
        squareDeviceId: event.deviceId ?? undefined,
        squareDeviceCode: event.code ?? hit.squareDeviceCode,
      }),
    );
    return;
  }
}

export async function applySquareWebhook(rawBody: string, header: string | null): Promise<{ ok: boolean; ignored?: boolean; duplicate?: boolean; error?: string }> {
  const cfg = configOrNull();
  if (!cfg?.webhookSignatureKey || !cfg.appUrl) return { ok: false, error: "webhook not configured" };
  const url = squareWebhookNotificationUrl(cfg.appUrl);
  if (!verifySquareWebhook({ signatureKey: cfg.webhookSignatureKey, notificationUrl: url, rawBody, header })) {
    return { ok: false, error: "invalid signature" };
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "invalid json" };
  }
  const event = parseSquareWebhook(body);
  if (event.kind === "ignore") return { ok: true, ignored: true };
  const sql = await getSql();
  const seen = await sql<{ event_id: string }>`
    select event_id from square_webhook_events where event_id = ${event.eventId} limit 1
  `;
  if (seen[0]) return { ok: true, duplicate: true, ignored: event.kind !== "checkout" };
  await sql`
    insert into square_webhook_events (id, event_id, event_type, checkout_id, payment_id, payload)
    values (
      ${newId("sqev")},
      ${event.eventId},
      ${event.type},
      ${event.kind === "checkout" ? event.checkoutId : null},
      ${event.kind === "checkout" ? event.paymentId : event.deviceId},
      ${JSON.stringify(body)}::jsonb
    )
  `;
  if (event.kind === "device") {
    await pairFromEvent(event);
    return { ok: true };
  }
  const rows = await sql<CheckoutRow>`
    select id, org_id, location_id, check_id, device_id, amount_cents, status,
           square_checkout_id, square_payment_id, sandbox, simulated, error
    from square_checkouts
    where square_checkout_id = ${event.checkoutId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: true, ignored: true };
  if (checkoutOutcome(row.status) === "completed") return { ok: true, duplicate: true };
  await applyCheckoutStatus(row, event.status, event.paymentId);
  return { ok: true };
}
