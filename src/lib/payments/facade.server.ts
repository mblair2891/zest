import { getSql } from "@/lib/db";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { DEFAULT_PAYMENTS, paymentsSettingsSchema } from "@/lib/saas/platform-settings";
import type { LocationSetup } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import {
  envPaymentsDefault,
  liveAdapterConfigured,
  locationLifecycleStatus,
  parseLocationPaymentsMode,
  resolvePaymentsMode,
} from "./mode";
import { captureSandbox } from "./sandbox-adapter";
import { captureLiveCardPresent } from "./stripe-terminal.server";
import type { CardPresentInput, CardPresentResult, CardPresentSplit, PaymentsStatus } from "./types";
import { newId } from "@/lib/saas/ids";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

type LocRow = {
  id: string;
  org_id: string;
  name: string;
  host_brand_name: string | null;
  setup: unknown;
  lifecycle_status: string | null;
};

function setupOf(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as LocationSetup) };
}

async function platformPaymentsDefault(): Promise<"sandbox" | "live"> {
  try {
    const sql = await getSql();
    const rows = await sql<{ value: unknown }>`
      select value from platform_settings where key = ${"payments"} limit 1
    `;
    const parsed = paymentsSettingsSchema.safeParse(rows[0]?.value ?? DEFAULT_PAYMENTS);
    const mode = parsed.success ? parsed.data.quantumPaymentsMode : DEFAULT_PAYMENTS.quantumPaymentsMode;
    if (mode === "live" || mode === "sandbox") return mode;
  } catch {
    /* table may be empty */
  }
  return envPaymentsDefault();
}

async function loadLocation(locationId: string): Promise<LocRow> {
  const sql = await getSql();
  const rows = await sql<LocRow>`
    select id, org_id, name, host_brand_name, setup, lifecycle_status
    from locations
    where id = ${locationId} and coalesce(is_demo, false) = false
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  return row;
}

async function ensureMerchant(orgId: string, locationId: string, status: "sandbox" | "live") {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from summex_merchants
    where org_id = ${orgId} and location_id = ${locationId}
    limit 1
  `;
  if (existing[0]) return existing[0].id;
  const id = newId("zmer");
  await sql`
    insert into summex_merchants (id, org_id, location_id, status)
    values (${id}, ${orgId}, ${locationId}, ${status})
  `;
  return id;
}

function readerCandidates(setup: LocationSetup): { id: string; label: string; serial: string; status: string }[] {
  return parseLocationDevices(setup.locationDevices)
    .filter((d) => d.type === "terminal" && d.status !== "inactive")
    .map((d) => ({
      id: d.id,
      label: d.label,
      serial: String(d.serial ?? "").trim(),
      status: d.status,
    }));
}

function pickReaderId(
  setup: LocationSetup,
  requested?: string | null,
): string | null {
  const readers = readerCandidates(setup);
  const want = String(requested ?? setup.quantumReaderId ?? "").trim();
  if (want) {
    const bySerial = readers.find((r) => r.serial === want || r.id === want);
    if (bySerial?.serial) return bySerial.serial;
    if (want.startsWith("tmr_") || want.startsWith("tmr") || want.startsWith("chr_")) return want;
  }
  const first = readers.find((r) => r.serial);
  return first?.serial || null;
}

export async function getPaymentsStatus(
  userId: string,
  locationId: string,
): Promise<PaymentsStatus> {
  const loc = await loadLocation(locationId);
  await requireMembership(userId, loc.org_id, undefined, locationId);
  const setup = setupOf(loc.setup);
  const platformDefault = await platformPaymentsDefault();
  const locationOverride = parseLocationPaymentsMode(setup.paymentsMode);
  const lifecycle = locationLifecycleStatus(setup, loc.lifecycle_status);
  const resolved = resolvePaymentsMode({
    platformDefault,
    locationOverride,
    lifecycleStatus: lifecycle,
  });
  const liveConfigured = liveAdapterConfigured();
  const readers = readerCandidates(setup);
  let hostApproved = false;
  try {
    const { hostPaymentsApproved } = await import("./onboarding.server");
    hostApproved = await hostPaymentsApproved(locationId);
  } catch {
    hostApproved = false;
  }
  const liveReady =
    resolved.mode === "live" &&
    liveConfigured &&
    hostApproved &&
    Boolean(pickReaderId(setup));
  let entityMerchants: PaymentsStatus["entityMerchants"] = [];
  try {
    const { listPaymentAccountsForLocation } = await import("./onboarding.server");
    const accounts = await listPaymentAccountsForLocation(userId, locationId);
    entityMerchants = accounts.map((a) => ({
      entityId: a.kind === "host" ? HOST_SCOPE : (a.operatorId || HOST_SCOPE),
      displayName: a.displayName,
      kind: a.kind,
      status: a.entityStatus,
      canCapture: a.canCapture,
    }));
  } catch {
    entityMerchants = [];
  }
  let message =
    resolved.mode === "sandbox"
      ? "Quantum Payments sandbox. Each brand is its own payments account; the guest still pays one check. Cash always works."
      : !hostApproved
        ? "Each brand needs an approved Quantum Payments account before live cards. Cash always works."
        : liveReady
          ? "Live Quantum Payments. One guest tender splits to each brand’s account. Present the card on a supplied reader."
          : liveConfigured
            ? "Live mode is on, but no Quantum reader is enrolled. Use cash or keep the check open."
            : "Live mode is selected, but live keys are not configured. Use cash or keep the check open.";
  if (resolved.lifecycleForcesSandbox) {
    message =
      "Location is not live yet — Quantum Payments sandbox. Each brand uses a sandbox payments account. Guest still pays one check.";
  }
  return {
    locationId,
    mode: resolved.mode,
    locationOverride,
    platformDefault,
    lifecycleForcesSandbox: resolved.lifecycleForcesSandbox,
    liveConfigured,
    liveReady,
    hostPaymentsApproved: hostApproved,
    entityMerchants,
    readers,
    hostBrand: loc.host_brand_name || loc.name,
    message,
  };
}

export async function captureCardPresent(
  userId: string,
  input: CardPresentInput,
): Promise<CardPresentResult> {
  if (input.amountCents <= 0) {
    return { ok: false, status: "declined", sandbox: true, error: "Invalid amount" };
  }
  const loc = await loadLocation(input.locationId);
  if (loc.org_id !== input.orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const platformDefault = await platformPaymentsDefault();
  const resolved = resolvePaymentsMode({
    platformDefault,
    locationOverride: parseLocationPaymentsMode(setup.paymentsMode),
    lifecycleStatus: locationLifecycleStatus(setup, loc.lifecycle_status),
  });
  const hostBrand = input.hostBrand || loc.host_brand_name || loc.name;
  const merchantId = await ensureMerchant(loc.org_id, loc.id, resolved.mode);
  const entities: CardPresentSplit[] =
    Array.isArray(input.entities) && input.entities.length
      ? input.entities
          .filter((e) => e && e.amountCents > 0)
          .map((e) => ({
            entityId: String(e.entityId || HOST_SCOPE).slice(0, 80),
            kind: e.kind === "operator" ? "operator" : "host",
            displayName: String(e.displayName || hostBrand).slice(0, 80),
            merchandiseCents: Math.max(0, Math.round(Number(e.merchandiseCents) || 0)),
            taxCents: Math.max(0, Math.round(Number(e.taxCents) || 0)),
            serviceCents: Math.max(0, Math.round(Number(e.serviceCents) || 0)),
            tipCents: Math.max(0, Math.round(Number(e.tipCents) || 0)),
            amountCents: Math.max(0, Math.round(Number(e.amountCents) || 0)),
          }))
      : [
          {
            entityId: HOST_SCOPE,
            kind: "host",
            displayName: hostBrand,
            merchandiseCents: input.amountCents,
            taxCents: 0,
            serviceCents: 0,
            tipCents: 0,
            amountCents: input.amountCents,
          },
        ];
  const splitSum = entities.reduce((s, e) => s + e.amountCents, 0);
  if (Math.abs(splitSum - input.amountCents) > 1) {
    return {
      ok: false,
      status: "declined",
      sandbox: resolved.mode === "sandbox",
      error: "Split does not match the tender. Use cash or keep the check open.",
    };
  }

  const training = resolved.lifecycleForcesSandbox || resolved.mode === "sandbox";
  const { assertEntitiesCanCapture, persistPaymentSplits } = await import("./onboarding.server");
  const gate = await assertEntitiesCanCapture({
    locationId: loc.id,
    orgId: loc.org_id,
    training,
    liveMode: resolved.mode === "live",
    entities,
  });
  if (!gate.ok) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: training,
      error: gate.error,
    };
  }

  const payload: CardPresentInput = {
    ...input,
    orgId: loc.org_id,
    locationId: loc.id,
    hostBrand,
    entities,
  };

  const finish = async (result: CardPresentResult): Promise<CardPresentResult> => {
    if (!result.ok || !result.paymentId) return { ...result, splits: entities };
    try {
      await persistPaymentSplits({
        paymentId: result.paymentId,
        orgId: loc.org_id,
        locationId: loc.id,
        entities,
        accounts: gate.accounts,
      });
    } catch {
      /* splits table may be applying */
    }
    return { ...result, splits: entities };
  };

  if (resolved.mode === "sandbox") {
    return finish(await captureSandbox({ input: payload, merchantId }));
  }

  if (!liveAdapterConfigured()) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error:
        "Live Quantum Payments is not configured. Use cash or keep the check open.",
    };
  }

  const readerId = pickReaderId(setup, input.readerId);
  return finish(await captureLiveCardPresent({ input: payload, merchantId, readerId }));
}
