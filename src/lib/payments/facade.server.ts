import { getSql } from "@/lib/db";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { DEFAULT_PAYMENTS, paymentsSettingsSchema } from "@/lib/saas/platform-settings";
import type { LocationSetup } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import {
  envPaymentsDefault,
  liveAdapterConfigured,
  parseLocationPaymentsMode,
  resolvePaymentsMode,
} from "./mode";
import { captureSandbox } from "./sandbox-adapter";
import { captureLiveCardPresent } from "./stripe-terminal.server";
import type { CardPresentInput, CardPresentResult, PaymentsStatus } from "./types";
import { newId } from "@/lib/saas/ids";

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
  const lifecycle = setup.lifecycleStatus || loc.lifecycle_status;
  const resolved = resolvePaymentsMode({
    platformDefault,
    locationOverride,
    lifecycleStatus: lifecycle,
  });
  const liveConfigured = liveAdapterConfigured();
  const readers = readerCandidates(setup);
  const liveReady =
    resolved.mode === "live" && liveConfigured && Boolean(pickReaderId(setup));
  let message =
    resolved.mode === "sandbox"
      ? "Quantum Payments sandbox. Training / practice — not a live card capture. Cash always works."
      : liveReady
        ? "Live Quantum Payments. Present the card on a supplied reader. Tablets run POS only."
        : liveConfigured
          ? "Live mode is on, but no Quantum reader is enrolled. Use cash or keep the check open."
          : "Live mode is selected, but live keys are not configured. Use cash or keep the check open.";
  if (resolved.lifecycleForcesSandbox) {
    message =
      "Location is not live yet — Quantum Payments sandbox. Go live before taking real cards.";
  }
  return {
    locationId,
    mode: resolved.mode,
    locationOverride,
    platformDefault,
    lifecycleForcesSandbox: resolved.lifecycleForcesSandbox,
    liveConfigured,
    liveReady,
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
    lifecycleStatus: setup.lifecycleStatus || loc.lifecycle_status,
  });
  const hostBrand = input.hostBrand || loc.host_brand_name || loc.name;
  const merchantId = await ensureMerchant(loc.org_id, loc.id, resolved.mode);
  const payload: CardPresentInput = {
    ...input,
    orgId: loc.org_id,
    locationId: loc.id,
    hostBrand,
  };

  if (resolved.mode === "sandbox") {
    return captureSandbox({ input: payload, merchantId });
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
  return captureLiveCardPresent({ input: payload, merchantId, readerId });
}
