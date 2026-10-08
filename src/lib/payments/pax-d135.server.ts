/**
 * Register a sandbox PAX D135 and journal the SDK transfer.
 * The sale itself is created by the Android SDK. This file does not call Stripe
 * and does not post a second transfer.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { locationLifecycleStatus } from "./mode";
import { finixSandboxLogin } from "./finix";
import {
  PAX_MSG,
  envBlock,
  normalizePaxSerial,
  parsePaxReaders,
  placePaxReader,
  readerForSerial,
  renamePaxReader,
  type PaxReader,
} from "./pax-d135";

function setupOf(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as LocationSetup) };
}

async function loadLoc(locationId: string) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    org_id: string;
    name: string;
    setup: unknown;
    lifecycle_status: string | null;
    operating_model: string | null;
  }>`
    select id, org_id, name, setup, lifecycle_status, operating_model
    from locations
    where id = ${locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  return row;
}

export async function listPaxReaders(userId: string, locationId: string): Promise<PaxReader[]> {
  const loc = await loadLoc(locationId);
  await requireMembership(userId, loc.org_id, undefined, locationId);
  return parsePaxReaders(setupOf(loc.setup).paxReaders);
}

export async function registerPaxReader(
  userId: string,
  input: { locationId: string; name: string; serial: string; entityId: string; entityName: string },
): Promise<{ ok: true; reader: PaxReader } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const live = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  if (live) return { ok: false, error: PAX_MSG.liveRegister };
  const entityId = input.entityId.trim().slice(0, 80);
  if (loc.operating_model === "peer_venue" && entityId === HOST_SCOPE) {
    return { ok: false, error: "The venue is not a selling entity. Pick the operator on the check." };
  }
  const serial = normalizePaxSerial(input.serial);
  const existing = readerForSerial(parsePaxReaders(setup.paxReaders), serial);
  if (existing && existing.entityId !== entityId) {
    return { ok: false, error: PAX_MSG.serialTaken };
  }
  if (existing) return { ok: true, reader: existing };

  const { ensureEntityPaymentAccount } = await import("./onboarding.server");
  const account = await ensureEntityPaymentAccount({
    orgId: loc.org_id,
    locationId: loc.id,
    entityId,
    displayName: input.entityName || entityId,
  });
  const merchantId = String(account.finix_merchant_id ?? "");
  const { createPaxD135Device } = await import("./finix");
  const created = await createPaxD135Device({
    merchantId,
    serial,
    name: `${input.entityName || "Reader"} ${serial}`.trim(),
  });
  if (!created.ok) return { ok: false, error: created.error };

  const placed = placePaxReader({
    readers: parsePaxReaders(setup.paxReaders),
    name: input.name,
    serial,
    entityId,
    entityName: input.entityName,
    locationLive: false,
    deviceId: created.id,
    merchantId,
    id: newId("pax"),
  });
  if (!placed.ok) return { ok: false, error: placed.message };

  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: placed.readers },
  });
  return { ok: true, reader: placed.reader };
}

/** Local name only. Does not call Finix and does not change the device id or serial. */
export async function renamePaxReaderRecord(
  userId: string,
  input: { locationId: string; id: string; name: string },
): Promise<{ ok: true; reader: PaxReader } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const renamed = renamePaxReader({
    readers: parsePaxReaders(setup.paxReaders),
    id: input.id,
    name: input.name,
  });
  if (!renamed.ok) return { ok: false, error: renamed.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: renamed.readers },
  });
  return { ok: true, reader: renamed.reader };
}

export async function paxReaderSession(
  userId: string,
  input: { locationId: string; serial: string; entityId: string },
): Promise<
  | {
      ok: true;
      merchantId: string;
      deviceId: string;
      userId: string;
      password: string;
      env: "SB";
    }
  | { ok: false; error: string }
> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const live = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  const reader = readerForSerial(parsePaxReaders(setup.paxReaders), input.serial);
  if (!reader) return { ok: false, error: PAX_MSG.notRegistered };
  if (reader.entityId !== input.entityId.trim()) {
    return { ok: false, error: PAX_MSG.wrongEntity };
  }
  const blocked = envBlock(live, reader.env);
  if (blocked) return { ok: false, error: blocked };
  const login = finixSandboxLogin();
  if (!login) {
    return { ok: false, error: "Quantum Payments sandbox is not configured." };
  }
  return {
    ok: true,
    merchantId: reader.finixMerchantId,
    deviceId: reader.finixDeviceId,
    userId: login.userId,
    password: login.password,
    env: "SB",
  };
}

export async function recordPaxSale(
  userId: string,
  input: {
    locationId: string;
    orgId: string;
    checkId: string;
    transferId: string;
    last4?: string | null;
    amountCents: number;
    readerId: string;
    merchantId: string;
  },
): Promise<{ ok: true; duplicate: boolean; transferId: string } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  if (loc.org_id !== input.orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const transferId = input.transferId.trim();
  if (!transferId) return { ok: false, error: PAX_MSG.unread };
  const sql = await getSql();
  const prior = await sql<{ processor_payment_id: string | null }>`
    select processor_payment_id from summex_payments
    where location_id = ${loc.id}
      and check_id = ${input.checkId}
      and status = ${"captured"}
      and method = ${"card"}
    limit 1
  `;
  if (prior[0]?.processor_payment_id) {
    return { ok: true, duplicate: true, transferId: String(prior[0].processor_payment_id) };
  }
  const id = newId("zpay");
  const last4 = input.last4 ? String(input.last4).replace(/\D/g, "").slice(-4) || null : null;
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, client_mutation_id
    ) values (
      ${id},
      ${loc.org_id},
      ${loc.id},
      ${input.merchantId},
      ${Math.max(0, Math.round(input.amountCents))},
      ${"usd"},
      ${"captured"},
      ${"card"},
      ${last4},
      ${"quantum_payments"},
      ${transferId},
      ${"sandbox"},
      ${input.checkId},
      ${input.readerId},
      ${`pax:${input.checkId}`.slice(0, 80)}
    )
  `;
  return { ok: true, duplicate: false, transferId };
}
