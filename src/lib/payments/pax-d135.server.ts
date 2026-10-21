/**
 * Register a sandbox PAX D135 and journal the chip sale.
 * The chip read is started by the Android SDK. This file does not call Stripe.
 * An authorized sale stores the sale idempotency id on the Transfer, then journals
 * that Transfer. A captured close journals the same sale and does not start another charge.
 */
import { readServerEnv } from "@/lib/database-url";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { parseLocationDevices, type LocationDevice } from "@/lib/pos/location-devices";
import { locationLifecycleStatus } from "./mode";
import { finixAttemptIdempotencyId } from "./idempotency";
import { settleSdkCardPresentTransfer } from "./finix";
import {
  PAX_MSG,
  envBlock,
  normalizePaxSerial,
  normalizeFinixDeviceId,
  parsePaxReaders,
  finixStationEnv,
  paxSdkDeviceId,
  normalizePaxLink,
  placePaxReader,
  readerForSerial,
  readerMerchantMismatchMessage,
  reassignPaxReader,
  removePaxReader,
  renamePaxReader,
  replacePaxReader,
  setPaxDeviceId,
  setPaxReaderLink,
  type PaxReader,
  type PaxReaderLink,
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
  input: {
    locationId: string;
    name: string;
    serial: string;
    entityId: string;
    entityName: string;
    deviceId: string;
    link?: PaxReaderLink;
  },
): Promise<{ ok: true; reader: PaxReader } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const live = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  if (live) return { ok: false, error: PAX_MSG.liveRegister };
  const entityId = input.entityId.trim().slice(0, 80);
  if (loc.operating_model === "peer_venue" && entityId === HOST_SCOPE) {
    return { ok: false, error: PAX_PEER_HOST };
  }
  const serial = normalizePaxSerial(input.serial);
  if (!serial || !entityId) return { ok: false, error: PAX_MSG.notSaved };
  const deviceId = normalizeFinixDeviceId(input.deviceId);
  if (!deviceId.startsWith("DV")) return { ok: false, error: PAX_MSG.deviceIdRequired };
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
    // The id the operator typed is what the station reads. The create call does not replace it.
    deviceId,
    merchantId,
    id: newId("pax"),
    link: normalizePaxLink(input.link),
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

/** Bluetooth, Network, or USB. Does not call Finix and does not change the serial. */
export async function setPaxReaderLinkRecord(
  userId: string,
  input: { locationId: string; id: string; link: PaxReaderLink },
): Promise<{ ok: true; reader: PaxReader } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const saved = setPaxReaderLink({
    readers: parsePaxReaders(setup.paxReaders),
    id: input.id,
    link: normalizePaxLink(input.link),
  });
  if (!saved.ok) return { ok: false, error: saved.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: saved.readers },
  });
  return { ok: true, reader: saved.reader };
}

/** Store the Finix device ID on an existing reader. Does not call Finix and does not change the serial. */
export async function setPaxDeviceIdRecord(
  userId: string,
  input: { locationId: string; id: string; deviceId: string },
): Promise<{ ok: true; reader: PaxReader } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const saved = setPaxDeviceId({
    readers: parsePaxReaders(setup.paxReaders),
    id: input.id,
    deviceId: input.deviceId,
  });
  if (!saved.ok) return { ok: false, error: saved.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: saved.readers },
  });
  return { ok: true, reader: saved.reader };
}

/** Delete the reader and clear any station that was assigned to its serial. Does not call Finix. */
export async function removePaxReaderRecord(
  userId: string,
  input: { locationId: string; id: string },
): Promise<{ ok: true; removed: PaxReader; devices: LocationDevice[] } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const removed = removePaxReader({
    readers: parsePaxReaders(setup.paxReaders),
    devices: parseLocationDevices(setup.locationDevices),
    id: input.id,
  });
  if (!removed.ok) return { ok: false, error: removed.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: removed.readers, locationDevices: removed.devices },
  });
  return { ok: true, removed: removed.removed, devices: removed.devices };
}

/**
 * Keep this reader and its station assignment.
 * The serial and the Finix device ID change together. Does not call Finix.
 */
export async function replacePaxReaderRecord(
  userId: string,
  input: { locationId: string; id: string; serial: string; deviceId: string },
): Promise<{ ok: true; reader: PaxReader; devices: LocationDevice[] } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const replaced = replacePaxReader({
    readers: parsePaxReaders(setup.paxReaders),
    devices: parseLocationDevices(setup.locationDevices),
    id: input.id,
    serial: input.serial,
    deviceId: input.deviceId,
  });
  if (!replaced.ok) return { ok: false, error: replaced.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: replaced.readers, locationDevices: replaced.devices },
  });
  return { ok: true, reader: replaced.reader, devices: replaced.devices };
}

/** Merchant id and MID stored on the payment account for this reader’s entity. */
async function venueFinixMerchantId(
  locationId: string,
  entityId: string,
): Promise<{ merchantId: string; mid: string }> {
  const sql = await getSql();
  const entity = entityId.trim();
  const rows =
    entity === HOST_SCOPE
      ? await sql<{ finix_merchant_id: string | null; finix_mid: string | null }>`
          select finix_merchant_id, finix_mid
          from payment_accounts
          where location_id = ${locationId} and kind = ${"host"}
          limit 1
        `
      : await sql<{ finix_merchant_id: string | null; finix_mid: string | null }>`
          select finix_merchant_id, finix_mid
          from payment_accounts
          where operator_id = ${entity} and kind = ${"operator"}
          limit 1
        `;
  return {
    merchantId: String(rows[0]?.finix_merchant_id ?? "").trim(),
    mid: String(rows[0]?.finix_mid ?? "").trim(),
  };
}

type PaxSessionInput = {
  locationId: string;
  serial: string;
  entityId: string;
  /** Display name for the check entity. The merchant decision does not use it. */
  entityName?: string;
};

const PAX_NO_MERCHANT =
  "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.";
const PAX_PEER_HOST = "The venue is not a selling entity. Pick the operator on the check.";

type PaxSessionResult =
  | {
      ok: true;
      merchantId: string;
      deviceId: string;
      userId: string;
      password: string;
      mid: string;
      env: "SB" | "LIVE";
    }
  | { ok: false; error: string };

export async function paxReaderSession(
  userId: string,
  input: PaxSessionInput,
): Promise<PaxSessionResult> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  return paxReaderCredentials(loc, input);
}

/**
 * Paired tablet. The PIN already entered on that station loads the same
 * saved merchant id and MID. The PIN is not returned.
 */
export async function paxReaderSessionForStation(
  input: PaxSessionInput & { stationDeviceId: string; stationPin: string },
): Promise<PaxSessionResult> {
  const { authorizeStationFloor } = await import("@/lib/pos/station-pin-auth.server");
  const granted = await authorizeStationFloor({
    pin: input.stationPin,
    deviceId: input.stationDeviceId,
    locationId: input.locationId,
  });
  if (!granted.ok) return { ok: false, error: granted.error };
  const loc = await loadLoc(granted.grant.locationId);
  return paxReaderCredentials(loc, {
    locationId: granted.grant.locationId,
    serial: input.serial,
    entityId: input.entityId,
    entityName: input.entityName,
  });
}

async function paxReaderCredentials(
  loc: Awaited<ReturnType<typeof loadLoc>>,
  input: PaxSessionInput,
): Promise<PaxSessionResult> {
  const setup = setupOf(loc.setup);
  const live = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  const reader = readerForSerial(parsePaxReaders(setup.paxReaders), input.serial);
  if (!reader) return { ok: false, error: PAX_MSG.notRegistered };
  const paymentEntity = input.entityId.trim();
  if (loc.operating_model === "peer_venue" && paymentEntity === HOST_SCOPE) {
    return { ok: false, error: PAX_PEER_HOST };
  }
  const blocked = envBlock(live, reader.env);
  if (blocked) return { ok: false, error: blocked };
  // Username and password stay on the server. Merchant id and MID are the saved
  // payment-account values for the check entity, not a stored reader merchant
  // and not a hardcoded id. A different entity is allowed only when both
  // merchants exist and are the same.
  const readerAccount = await venueFinixMerchantId(loc.id, reader.entityId);
  const paymentAccount =
    paymentEntity === reader.entityId.trim()
      ? readerAccount
      : await venueFinixMerchantId(loc.id, paymentEntity);
  if (paymentEntity !== reader.entityId.trim()) {
    const readerMu = readerAccount.merchantId.startsWith("MU") ? readerAccount.merchantId : "";
    const paymentMu = paymentAccount.merchantId.startsWith("MU") ? paymentAccount.merchantId : "";
    if (!paymentMu) return { ok: false, error: PAX_NO_MERCHANT };
    if (!readerMu || readerMu !== paymentMu) {
      return {
        ok: false,
        error: readerMerchantMismatchMessage(
          reader.entityName || reader.entityId,
          input.entityName?.trim() || paymentEntity,
        ),
      };
    }
  }
  const account = paymentAccount;
  const merchantId = account.merchantId.startsWith("MU") ? account.merchantId : "";
  return {
    ok: true,
    merchantId,
    deviceId: paxSdkDeviceId(reader.finixDeviceId),
    userId: String(readServerEnv("FINIX_USERNAME") ?? ""),
    password: String(readServerEnv("FINIX_PASSWORD") ?? ""),
    mid: account.mid,
    env: finixStationEnv(readServerEnv("FINIX_ENVIRONMENT")),
  };
}

export type FinixConnectAuthResult =
  | {
      ok: true;
      environment: string;
      usernamePresent: "yes" | "no";
      passwordPresent: "yes" | "no";
      applicationId: string;
      merchantId: string;
      deviceId: string;
      response: string;
    }
  | {
      ok: false;
      error: string;
      environment?: string;
      usernamePresent?: "yes" | "no";
      passwordPresent?: "yes" | "no";
      applicationId?: string;
      merchantId?: string;
      deviceId?: string;
      response?: string;
    };

/**
 * Ask Finix whether the sandbox login MPOSFinix will use is accepted.
 * Returns the application id, merchant, and device sent with that login, and the raw body.
 * Does not return the password. A network miss is not an Unauthorized result.
 */
export async function finixConnectAuth(
  userId: string | null,
  input: PaxSessionInput & { stationDeviceId?: string; stationPin?: string },
): Promise<FinixConnectAuthResult> {
  const session = userId
    ? await paxReaderSession(userId, input)
    : await paxReaderSessionForStation({
        locationId: input.locationId,
        serial: input.serial,
        entityId: input.entityId,
        entityName: input.entityName,
        stationDeviceId: input.stationDeviceId ?? "",
        stationPin: input.stationPin ?? "",
      });
  if (!session.ok) return session;
  const { finixSandboxAuthProbe } = await import("./finix");
  const probe = await finixSandboxAuthProbe();
  const trace = {
    environment: session.env,
    usernamePresent: probe.usernamePresent,
    passwordPresent: probe.passwordPresent,
    applicationId: probe.applicationId,
    merchantId: session.merchantId,
    deviceId: session.deviceId,
    response: probe.response,
  };
  if (!probe.failure) return { ok: true, ...trace };
  return { ok: false, error: probe.failure, ...trace };
}

/**
 * Move a reader to another selling entity at this location.
 * The serial stays, so the tablet assignment stays.
 * A different Finix merchant re-enrolls the serial. The saved device id stays.
 */
export async function reassignPaxReaderRecord(
  userId: string,
  input: { locationId: string; id: string; entityId: string; entityName: string },
): Promise<{ ok: true; reader: PaxReader; reenrolled: boolean } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const setup = setupOf(loc.setup);
  const live = locationLifecycleStatus(setup, loc.lifecycle_status) === "live";
  if (live) return { ok: false, error: PAX_MSG.liveRegister };
  const entityId = input.entityId.trim().slice(0, 80);
  if (loc.operating_model === "peer_venue" && entityId === HOST_SCOPE) {
    return { ok: false, error: PAX_PEER_HOST };
  }
  if (!entityId) return { ok: false, error: PAX_MSG.notSaved };
  const readers = parsePaxReaders(setup.paxReaders);
  const current = readers.find((row) => row.id === input.id);
  if (!current) return { ok: false, error: PAX_MSG.notRegistered };
  if (current.entityId === entityId) return { ok: true, reader: current, reenrolled: false };

  const { ensureEntityPaymentAccount } = await import("./onboarding.server");
  const account = await ensureEntityPaymentAccount({
    orgId: loc.org_id,
    locationId: loc.id,
    entityId,
    displayName: input.entityName || entityId,
  });
  const merchantId = String(account.finix_merchant_id ?? "").trim();
  if (!merchantId.startsWith("MU")) return { ok: false, error: PAX_NO_MERCHANT };

  const previous = await venueFinixMerchantId(loc.id, current.entityId);
  const previousMu = previous.merchantId.startsWith("MU") ? previous.merchantId : "";
  let reenrolled = false;
  if (previousMu !== merchantId) {
    const { createPaxD135Device } = await import("./finix");
    const created = await createPaxD135Device({
      merchantId,
      serial: current.serial,
      name: `${input.entityName || "Reader"} ${current.serial}`.trim(),
    });
    if (!created.ok) return { ok: false, error: created.error };
    reenrolled = true;
  }

  const moved = reassignPaxReader({
    readers,
    id: current.id,
    entityId,
    entityName: input.entityName,
    merchantId,
  });
  if (!moved.ok) return { ok: false, error: moved.message };
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId: loc.org_id,
    locationId: loc.id,
    setup: { ...setup, paxReaders: moved.readers },
  });
  return { ok: true, reader: moved.reader, reenrolled };
}

/** Store the sale idempotency id on the chip Transfer. A captured close is not a second charge. */
async function readerTransferId(input: {
  status?: "authorized" | "captured";
  transferId: string;
  idempotencyId: string | null;
  merchantId: string;
  amountCents: number;
  checkId: string;
}): Promise<string | null> {
  if (input.status !== "authorized" || !input.idempotencyId) return input.transferId;
  try {
    const settled = await settleSdkCardPresentTransfer({
      mode: "sandbox",
      sdkId: input.transferId,
      idempotencyId: input.idempotencyId,
      merchantId: input.merchantId,
      amountCents: Math.max(0, Math.round(input.amountCents)),
      checkId: input.checkId,
    });
    return settled.ok ? settled.transferId : null;
  } catch {
    return null;
  }
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
    status?: "authorized" | "captured";
    idempotencyId?: string | null;
  },
): Promise<{ ok: true; duplicate: boolean; transferId: string } | { ok: false; error: string }> {
  const loc = await loadLoc(input.locationId);
  if (loc.org_id !== input.orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(userId, loc.org_id, undefined, input.locationId);
  const transferId = input.transferId.trim();
  if (!transferId) return { ok: false, error: PAX_MSG.unread };
  const idempotencyId = finixAttemptIdempotencyId(input.idempotencyId);
  if (idempotencyId) console.info(`pax sale record idempotency_id=${idempotencyId}`);
  const sql = await getSql();
  const prior = await sql<{ processor_payment_id: string | null }>`
    select processor_payment_id from summex_payments
    where location_id = ${loc.id}
      and check_id = ${input.checkId}
      and method = ${"card"}
      and status in (${"authorized"}, ${"captured"})
    limit 1
  `;
  if (prior[0]?.processor_payment_id) {
    let processorPaymentId = String(prior[0].processor_payment_id);
    if (idempotencyId) {
      await sql`
        update summex_payments
        set idempotency_id = ${idempotencyId}
        where location_id = ${loc.id}
          and check_id = ${input.checkId}
          and method = ${"card"}
          and status in (${"authorized"}, ${"captured"})
          and (idempotency_id is null or btrim(idempotency_id) = '')
      `;
    }
    if (input.status === "authorized" && idempotencyId) {
      const settledId = await readerTransferId({
        status: "authorized",
        transferId,
        idempotencyId,
        merchantId: input.merchantId,
        amountCents: input.amountCents,
        checkId: input.checkId,
      });
      if (settledId && settledId !== processorPaymentId) {
        await sql`
          update summex_payments
          set processor_payment_id = ${settledId}
          where location_id = ${loc.id}
            and check_id = ${input.checkId}
            and method = ${"card"}
            and status in (${"authorized"}, ${"captured"})
            and processor_payment_id = ${processorPaymentId}
        `;
        processorPaymentId = settledId;
      }
    }
    return { ok: true, duplicate: true, transferId: processorPaymentId };
  }
  const processorPaymentId = await readerTransferId({
    status: input.status,
    transferId,
    idempotencyId,
    merchantId: input.merchantId,
    amountCents: input.amountCents,
    checkId: input.checkId,
  });
  if (!processorPaymentId) return { ok: false, error: PAX_MSG.notCharged };
  const id = newId("zpay");
  const last4 = input.last4 ? String(input.last4).replace(/\D/g, "").slice(-4) || null : null;
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, client_mutation_id,
      idempotency_id
    ) values (
      ${id},
      ${loc.org_id},
      ${loc.id},
      ${input.merchantId},
      ${Math.max(0, Math.round(input.amountCents))},
      ${"usd"},
      ${input.status === "authorized" ? "authorized" : "captured"},
      ${"card"},
      ${last4},
      ${"quantum_payments"},
      ${processorPaymentId},
      ${"sandbox"},
      ${input.checkId},
      ${input.readerId},
      ${`pax:${input.checkId}`.slice(0, 80)},
      ${idempotencyId}
    )
  `;
  return { ok: true, duplicate: false, transferId: processorPaymentId };
}
