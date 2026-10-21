/**
 * PAX D135 card-present decisions for a paired Android station.
 * The Finix Android SDK runs in the station app. This module never
 * opens Web Bluetooth and never calls Stripe.
 */
import {
  DECLINE_AVS,
  DECLINE_CANCELED,
  DECLINE_CVV,
  DECLINE_GENERIC,
  DECLINE_INSUFFICIENT,
  DECLINE_INVALID_NUMBER,
  displayCardDecline,
} from "./card-decline.ts";

export const PAX_NAME_PREFIX = "PAX D135_";
export const PAX_MODEL = "PAX_D135" as const;
/** Station activity text when the Finix connect callback succeeds. */
export const PAX_ACTIVITY_CONNECTED = "Connected";
export const PAX_SDK_ENV = "SB" as const;
/** Pay status when the selected USB reader is unplugged. */
export const CARD_READER_USB_NOT_CONNECTED = "Card reader not connected";

export type PaxReaderEnv = "sandbox" | "live";
/** How this station reaches the reader. A missing value stays Bluetooth. */
export type PaxReaderLink = "bluetooth" | "network" | "usb";
export type CardReaderStep = "authorize" | "capture" | "void";

export const PAX_READER_LINKS: { id: PaxReaderLink; label: string }[] = [
  { id: "bluetooth", label: "Bluetooth" },
  { id: "network", label: "Network" },
  { id: "usb", label: "USB" },
];

export type PaxReader = {
  id: string;
  /** Operator name, for example Bar 1. The Finix device id stays put when this changes. */
  name: string;
  serial: string;
  entityId: string;
  entityName: string;
  finixDeviceId: string;
  finixMerchantId: string;
  model: typeof PAX_MODEL;
  env: PaxReaderEnv;
  /** Absent on older rows. Those stay on the Bluetooth path. */
  link?: PaxReaderLink;
  /** Device id enrolled under the sandbox merchant. It is not sent while the location is live. */
  sandboxDeviceId?: string;
  /** Device id enrolled under the live merchant. It is not sent while the location is in sandbox. */
  liveDeviceId?: string;
  /** Set when this reader was enrolled in sandbox and the location is now live. */
  needsLiveReenroll?: boolean;
};

export type PaxScanRow = {
  name: string;
  address: string;
  serial: string;
  registered: boolean;
  entityId: string | null;
};

export const PAX_MSG = {
  bluetooth: "Bluetooth is off, or no reader is in range.",
  permissions: "Allow Nearby devices and Location, then scan again.",
  notRegistered: "This reader is not registered to this location.",
  wrongEntity: "This reader is registered to another selling entity.",
  connecting: "Connecting",
  settingUp: "Setting up reader",
  stillSettingUp: "The reader is still setting up. No charge was sent.",
  ready: "Reader ready",
  connectTimeout: "The connection timed out.",
  connectRejected: "The reader rejected the connection.",
  connectNoResponse: "The reader did not respond.",
  disconnect: "The reader disconnected. The check is not paid. Try again.",
  timeout: "The card read timed out. The check is not paid. Try again.",
  alreadyPaid: "This check is already paid. No second charge was sent.",
  declined: "The card was declined. The check stays open.",
  cancelled: "The card was cancelled. The check stays open.",
  chip: "The chip could not be read. The check stays open.",
  liveBuild: "Live cards are not available in this build. Take cash or keep the check open.",
  sandboxOnLive: "A sandbox reader cannot take a card at a live location. No charge was sent.",
  liveOnSandbox: "A live reader cannot take a card while this location is in sandbox. No charge was sent.",
  connected: "Connected",
  notConnected: "Scan for the reader, then pick the registered PAX D135.",
  unread: "The card could not be read. The check stays open.",
  liveRegister: "Live card readers are not available in this build.",
  needsLiveReenroll:
    "This reader needs re-enrollment for the live merchant. Open Devices and choose Re-enroll for live. Cash and gift still work.",
  connectAgain:
    "This reader was re-enrolled for the live merchant. Connect the reader again, then take the card. Cash and gift still work.",
  liveDeviceSame: "That device id belongs to the sandbox merchant.",
  serialTaken: "This reader already belongs to another selling entity.",
  serialOnReader: "That serial is already on another reader.",
  serialRequired: "Enter the reader serial.",
  nameRequired: "Enter a name for the reader.",
  nameTaken: "That name is already on a reader.",
  /** Only when the serial is empty or the selling entity is missing. */
  notSaved: "The reader was not registered.",
  /** New PAX D135, and when saving the id on an open reader. */
  deviceIdRequired: "Enter the Finix device ID.",
  usbNotConnected: CARD_READER_USB_NOT_CONNECTED,
  /** The reader sale had no idempotency id, so no charge was sent. */
  saleNotStarted: "The sale could not start. No charge was sent.",
  /** Finix already accepted this sale id. A retry must not create another transfer. */
  alreadySent: "This sale was already sent. The check stays open.",
  /** The reader charge was released because its Transfer had no idempotency id. */
  notCharged: "The card was not charged. The check stays open.",
} as const;

const CARD_SALE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const saleIdempotencyIds = new Map<string, string>();

/** Keep a saved UUID. Mint a new one only when the check does not have one yet. */
export function reuseCardSaleIdempotencyId(existing: string | null | undefined): string {
  const id = String(existing ?? "").trim();
  if (CARD_SALE_UUID.test(id)) return id;
  return crypto.randomUUID();
}

/**
 * Id for this check's in-flight reader sale.
 * A caller-supplied UUID wins. Otherwise the id from the last attempt on this check is reused.
 * The station stores that UUID on the check. runAndroidPaxSale sends it as idempotency_id.
 */
export function cardSaleIdempotencyFor(checkId: string, existing?: string | null): string {
  const given = String(existing ?? "").trim();
  if (CARD_SALE_UUID.test(given)) {
    saleIdempotencyIds.set(checkId, given);
    return given;
  }
  const prior = saleIdempotencyIds.get(checkId);
  if (prior && CARD_SALE_UUID.test(prior)) return prior;
  const minted = crypto.randomUUID();
  saleIdempotencyIds.set(checkId, minted);
  return minted;
}

export function clearCardSaleIdempotency(checkId: string): void {
  saleIdempotencyIds.delete(checkId.trim());
}

function shortCardDecline(message: string): boolean {
  return (
    message === DECLINE_INSUFFICIENT ||
    message === DECLINE_INVALID_NUMBER ||
    message === DECLINE_GENERIC ||
    message === DECLINE_CANCELED ||
    message === DECLINE_AVS ||
    message === DECLINE_CVV
  );
}

function duplicateSaleId(raw: string): boolean {
  const text = raw.toLowerCase();
  return text.includes("idempotency") || text.includes("already been used");
}

/** Bluetooth when the saved row has no connection, or an unknown one. */
export function normalizePaxLink(raw: unknown): PaxReaderLink {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "usb" || text === "network") return text;
  return "bluetooth";
}

export function readerLink(reader: { link?: PaxReaderLink | null } | null | undefined): PaxReaderLink {
  return normalizePaxLink(reader?.link);
}

/**
 * USB authorize, capture, and void wait for the cable.
 * Bluetooth and Network ignore a missing USB cable.
 */
export function usbCardStep(input: {
  link?: PaxReaderLink | null;
  usbAttached?: boolean | null;
  step: CardReaderStep;
}): { ok: true; transport: "usb" | "existing" } | { ok: false; message: typeof CARD_READER_USB_NOT_CONNECTED } {
  void input.step;
  if (normalizePaxLink(input.link) !== "usb") return { ok: true, transport: "existing" };
  if (input.usbAttached === true) return { ok: true, transport: "usb" };
  return { ok: false, message: CARD_READER_USB_NOT_CONNECTED };
}

/**
 * Pay line for the selected connection.
 * USB unplugged is the fixed status. Bluetooth and Network keep their own lines.
 */
export function payReaderStatusText(input: {
  link?: PaxReaderLink | null;
  usbAttached?: boolean | null;
  phase: string;
  message: string;
}): string {
  if (normalizePaxLink(input.link) !== "usb") return paxLinkStatusText(input);
  if (input.usbAttached !== true) return CARD_READER_USB_NOT_CONNECTED;
  if (input.phase === "connected") return PAX_MSG.ready;
  return paxLinkStatusText(input);
}

const capturedChecks = new Set<string>();

export function resetPaxSaleGuards(): void {
  capturedChecks.clear();
  saleIdempotencyIds.clear();
}

export function rememberCapturedCheck(checkId: string): void {
  const id = checkId.trim();
  if (id) capturedChecks.add(id);
}

export function checkCapturedLocally(checkId: string): boolean {
  return capturedChecks.has(checkId.trim());
}

export function normalizePaxSerial(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, "").trim();
}

/** Display name on Devices. Not the Finix device name. */
export function normalizeReaderName(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Finix device id on the reader record. DVxxxxx. Blank stays blank. */
export function normalizeFinixDeviceId(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, "").trim().slice(0, 80);
}

/**
 * Serial from a Bluetooth name.
 * PAX D135_1890297422, PAX D135-1890297422, and D135_1890297422 all match.
 * A reader already paired in Android settings uses one of those names.
 */
export function serialFromPaxName(name: string): string | null {
  const trimmed = String(name ?? "").trim();
  const mark = PAX_NAME_PREFIX.replace(/_+$/, "");
  if (trimmed.startsWith(mark)) {
    const rest = trimmed.slice(mark.length);
    if (rest && /^[\s_\-:]/.test(rest)) {
      const serial = normalizePaxSerial(rest.replace(/^[\s_\-:]+/, ""));
      if (serial) return serial;
    }
  }
  const loose = trimmed.match(/(?:^|[\s_\-:])D135[\s_\-:]+([A-Za-z0-9]+)\s*$/i);
  if (loose?.[1]) return normalizePaxSerial(loose[1]);
  return null;
}

/**
 * Status after Scan for reader.
 * The Bluetooth-off line is only for an adapter that is off, or a finished scan with no D135.
 */
export function paxScanPresentation(
  scanned: { ok: boolean; message?: string; devices?: { name: string; address: string }[] },
  readers: PaxReader[],
): { phase: "idle" | "bluetooth"; message: string; rows: PaxScanRow[] } {
  const rows = paxScanRows(scanned.devices ?? [], readers);
  if (rows.length > 0) {
    return { phase: "idle", message: PAX_MSG.notConnected, rows };
  }
  if (scanned.message && scanned.message !== PAX_MSG.bluetooth) {
    return { phase: "idle", message: scanned.message, rows: [] };
  }
  return { phase: "bluetooth", message: PAX_MSG.bluetooth, rows: [] };
}

export function isPaxD135Name(name: string): boolean {
  return serialFromPaxName(name) != null;
}

export function parsePaxReaders(raw: unknown): PaxReader[] {
  if (!Array.isArray(raw)) return [];
  const out: PaxReader[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const serial = normalizePaxSerial(String(o.serial ?? ""));
    const entityId = String(o.entityId ?? "").trim().slice(0, 80);
    const finixDeviceId = normalizeFinixDeviceId(String(o.finixDeviceId ?? ""));
    const finixMerchantId = String(o.finixMerchantId ?? "").trim().slice(0, 80);
    const env: PaxReaderEnv = o.env === "live" ? "live" : "sandbox";
    const activeId = finixDeviceId.startsWith("DV") ? finixDeviceId : "";
    const sandboxDeviceId = storedDeviceId(o.sandboxDeviceId) || (env === "sandbox" ? activeId : "");
    const liveDeviceId = storedDeviceId(o.liveDeviceId) || (env === "live" ? activeId : "");
    // A serial without a Finix device id stays listed until that id is saved.
    if (!serial || !entityId) continue;
    out.push({
      id: String(o.id ?? `pax_${serial}`).slice(0, 80),
      name: normalizeReaderName(String(o.name ?? "")) || serial,
      serial,
      entityId,
      entityName: String(o.entityName ?? "").trim().slice(0, 80),
      finixDeviceId: activeId,
      finixMerchantId,
      model: PAX_MODEL,
      env,
      link: normalizePaxLink(o.link),
      ...(sandboxDeviceId ? { sandboxDeviceId } : {}),
      ...(liveDeviceId ? { liveDeviceId } : {}),
      ...(o.needsLiveReenroll === true ? { needsLiveReenroll: true } : {}),
    });
  }
  return out;
}

export function paxDeviceRequest(serial: string, name: string): {
  model: typeof PAX_MODEL;
  serial_number: string;
  name: string;
  description: string;
  integration_mode: "PAYMENT_APP";
} {
  const clean = normalizePaxSerial(serial);
  return {
    model: PAX_MODEL,
    serial_number: clean,
    name: name.trim().slice(0, 80) || `PAX D135 ${clean}`,
    description: `PAX D135 ${clean}`,
    integration_mode: "PAYMENT_APP",
  };
}

/**
 * Device id from the reader row, passed through to MPOSFinix.
 * A blank id stays blank. The station does not substitute another device.
 */
export function paxSdkDeviceId(stored?: string | null): string {
  return normalizeFinixDeviceId(String(stored ?? ""));
}

/**
 * EnvEnum.SB when FINIX_ENVIRONMENT is sandbox or unset.
 * live / production maps to LIVE. A re-enrolled reader sends LIVE.
 */
export function finixStationEnv(environment: string | null | undefined): "SB" | "LIVE" {
  const raw = String(environment ?? "").trim().toLowerCase();
  if (raw === "live" || raw === "production" || raw === "prod") return "LIVE";
  return "SB";
}

/** First eight characters of the merchant username for the pre-connect station line. */
export function finixUserIdPreview(userId: string): string {
  return String(userId ?? "").trim().slice(0, 8);
}

/**
 * MerchantData values written before connect.
 * The username is the first eight characters. mid is present or not.
 * The password and the merchant number are not included.
 * The userId label has no colon, so the activity log keeps the eight characters.
 */
export function finixMerchantDataPreview(input: {
  merchantId: string;
  deviceId: string;
  userId: string;
  env: string;
  mid?: string;
}): string {
  const merchant = String(input.merchantId ?? "").trim() || "missing";
  const device = String(input.deviceId ?? "").trim() || "missing";
  const user = finixUserIdPreview(input.userId) || "missing";
  const env = String(input.env ?? "").trim() || "missing";
  const midPresent = String(input.mid ?? "").trim() ? "yes" : "no";
  return `merchantId ${merchant}. deviceId ${device}. userId prefix ${user}. mid present ${midPresent}. env ${env}.`;
}

/**
 * Required MerchantData fields. An empty mid is named and connect is not called.
 */
export function finixMerchantDataGap(input: {
  merchantId: string;
  deviceId: string;
  userId: string;
  password: string;
  env: string;
  mid?: string;
}): string | null {
  if (!String(input.merchantId ?? "").trim()) return "missing merchantId";
  if (!String(input.userId ?? "").trim()) return "missing userId";
  if (!String(input.password ?? "").trim()) return "missing password";
  if (!String(input.deviceId ?? "").trim()) return "missing deviceId";
  if (!String(input.mid ?? "").trim()) return "missing mid";
  if (!String(input.env ?? "").trim()) return "missing env";
  return null;
}

/**
 * Station activity result for one SDK connect callback.
 * Success is Connected. A failure is the SDK text plus any code the SDK returned.
 */
export function paxSdkConnectActivityResult(input: {
  ok: boolean;
  message?: string | null;
  sdkMessage?: string | null;
  sdkCode?: string | null;
}): string {
  if (input.ok) return PAX_ACTIVITY_CONNECTED;
  const message = String(input.sdkMessage || input.message || "")
    .replace(/\s+/g, " ")
    .trim();
  const code = String(input.sdkCode ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!code || code === "none") return message;
  if (message.includes(`code ${code}`)) return message;
  return `${message} code ${code}`.trim();
}

/** Values written beside the callback result. The password and username are presence only. */
export function paxConnectActivityTrace(input: {
  env: string;
  userId: string;
  password: string;
  merchantId: string;
  deviceId: string;
  applicationId?: string;
}): {
  environment: string;
  usernamePresent: "yes" | "no";
  passwordPresent: "yes" | "no";
  merchantId: string;
  deviceId: string;
  applicationId?: string;
} {
  const applicationId = String(input.applicationId ?? "").trim();
  return {
    environment: finixInitEnvironment(input.env),
    usernamePresent: String(input.userId ?? "").trim() ? "yes" : "no",
    passwordPresent: String(input.password ?? "").trim() ? "yes" : "no",
    merchantId: String(input.merchantId ?? "").trim(),
    deviceId: paxSdkDeviceId(input.deviceId),
    ...(applicationId ? { applicationId } : {}),
  };
}

export function readerForSerial(readers: PaxReader[], serial: string): PaxReader | null {
  const want = normalizePaxSerial(serial);
  if (!want) return null;
  return readers.find((r) => r.serial === want) ?? null;
}

/** Names that start with PAX D135_. A registered serial is marked on its row. */
export function paxScanRows(
  found: { name: string; address: string }[],
  readers: PaxReader[],
): PaxScanRow[] {
  const rows: PaxScanRow[] = [];
  const seen = new Set<string>();
  for (const device of found) {
    const serial = serialFromPaxName(device.name);
    if (!serial || seen.has(serial)) continue;
    seen.add(serial);
    const reader = readerForSerial(readers, serial);
    rows.push({
      name: device.name.trim(),
      address: String(device.address ?? "").trim(),
      serial,
      registered: Boolean(reader),
      entityId: reader?.entityId ?? null,
    });
  }
  return rows;
}

export function envBlock(locationLive: boolean, readerEnv: PaxReaderEnv): string | null {
  if (locationLive && readerEnv === "sandbox") return PAX_MSG.sandboxOnLive;
  if (!locationLive && readerEnv === "live") return PAX_MSG.liveOnSandbox;
  if (locationLive) return PAX_MSG.liveBuild;
  return null;
}

function storedDeviceId(value: unknown): string {
  const id = normalizeFinixDeviceId(String(value ?? ""));
  return id.startsWith("DV") ? id : "";
}

/** Sandbox enrollment id. A live-only row has none. */
export function readerSandboxDeviceId(reader: PaxReader): string {
  return storedDeviceId(reader.sandboxDeviceId) || (reader.env !== "live" ? storedDeviceId(reader.finixDeviceId) : "");
}

/** Live enrollment id. A sandbox row has none until re-enrollment. */
export function readerLiveDeviceId(reader: PaxReader): string {
  return storedDeviceId(reader.liveDeviceId) || (reader.env === "live" ? storedDeviceId(reader.finixDeviceId) : "");
}

export function readerNeedsLiveReenroll(reader: PaxReader): boolean {
  return reader.needsLiveReenroll === true;
}

/**
 * A live card can run only after re-enrollment stored a live device id
 * that is not the sandbox device id.
 */
export function readerReadyForLiveCard(reader: PaxReader): boolean {
  if (reader.needsLiveReenroll) return false;
  if (reader.env !== "live") return false;
  const liveId = storedDeviceId(reader.liveDeviceId);
  const sandboxId = storedDeviceId(reader.sandboxDeviceId);
  if (!liveId || liveId === sandboxId) return false;
  return storedDeviceId(reader.finixDeviceId) === liveId;
}

/** Pay and connect. A flagged reader asks for re-enrollment before any other environment line. */
export function readerEnvironmentBlock(locationLive: boolean, reader: PaxReader): string | null {
  if (reader.needsLiveReenroll) return PAX_MSG.needsLiveReenroll;
  if (locationLive && readerReadyForLiveCard(reader)) return null;
  return envBlock(locationLive, reader.env);
}

/** Keep a device slot only when it holds an id. A false re-enroll flag is omitted. */
function readerWithSlots(
  reader: PaxReader,
  slots: {
    sandboxDeviceId: string;
    liveDeviceId: string;
    finixDeviceId: string;
    env: PaxReaderEnv;
    needsLiveReenroll: boolean;
    finixMerchantId?: string;
  },
): PaxReader {
  const next: PaxReader = {
    ...reader,
    finixDeviceId: slots.finixDeviceId,
    env: slots.env,
    finixMerchantId: slots.finixMerchantId ?? reader.finixMerchantId,
  };
  delete next.sandboxDeviceId;
  delete next.liveDeviceId;
  delete next.needsLiveReenroll;
  if (slots.sandboxDeviceId) next.sandboxDeviceId = slots.sandboxDeviceId;
  if (slots.liveDeviceId) next.liveDeviceId = slots.liveDeviceId;
  if (slots.needsLiveReenroll) next.needsLiveReenroll = true;
  return next;
}

/**
 * Location just became live, or live keys were activated.
 * A sandbox device id stays in the sandbox slot. It is not copied into the live slot.
 * A reader that already has its own live device id uses that id.
 */
export function markPaxReadersForLiveSwitch(readers: PaxReader[]): PaxReader[] {
  return readers.map((reader) => {
    const sandboxId = readerSandboxDeviceId(reader);
    const liveId = storedDeviceId(reader.liveDeviceId);
    const distinctLive = liveId && liveId !== sandboxId ? liveId : "";
    if (distinctLive) {
      return readerWithSlots(reader, {
        sandboxDeviceId: sandboxId,
        liveDeviceId: distinctLive,
        finixDeviceId: distinctLive,
        env: "live",
        needsLiveReenroll: false,
      });
    }
    const sandboxDeviceId = sandboxId || storedDeviceId(reader.finixDeviceId);
    return readerWithSlots(reader, {
      sandboxDeviceId,
      liveDeviceId: "",
      finixDeviceId: sandboxDeviceId,
      env: "sandbox",
      needsLiveReenroll: true,
    });
  });
}

/**
 * Location left live. The live device id stays stored and is not sent.
 * The sandbox device id becomes the active id.
 */
export function restorePaxReadersForSandbox(readers: PaxReader[]): PaxReader[] {
  return readers.map((reader) => {
    const sandboxId = storedDeviceId(reader.sandboxDeviceId);
    const liveId =
      reader.env === "live"
        ? storedDeviceId(reader.liveDeviceId) || storedDeviceId(reader.finixDeviceId)
        : storedDeviceId(reader.liveDeviceId);
    return readerWithSlots(reader, {
      sandboxDeviceId: sandboxId,
      liveDeviceId: liveId,
      finixDeviceId: sandboxId,
      env: "sandbox",
      needsLiveReenroll: false,
    });
  });
}

/** Store the live device id. The sandbox device id stays. */
export function bindPaxReaderLiveEnrollment(input: {
  readers: PaxReader[];
  id: string;
  deviceId: string;
  merchantId: string;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  const deviceId = storedDeviceId(input.deviceId);
  if (!deviceId) return { ok: false, message: PAX_MSG.deviceIdRequired };
  const current = input.readers.find((row) => row.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  const sandboxId = readerSandboxDeviceId(current);
  if (sandboxId && deviceId === sandboxId) return { ok: false, message: PAX_MSG.liveDeviceSame };
  const merchantId = input.merchantId.trim().slice(0, 80);
  const reader = readerWithSlots(current, {
    sandboxDeviceId: sandboxId,
    liveDeviceId: deviceId,
    finixDeviceId: deviceId,
    env: "live",
    needsLiveReenroll: false,
    finixMerchantId: merchantId || current.finixMerchantId,
  });
  return {
    ok: true,
    readers: input.readers.map((row) => (row.id === current.id ? reader : row)),
    reader,
  };
}

/** Selling entities that own items on the check. The building is not one of them. */
export function checkSellingEntityIds(
  lines: { entityId?: string; vendorId?: string; voided?: boolean }[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.voided) continue;
    const id = String(line.entityId || line.vendorId || "").trim();
    if (!id || id === "host" || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function checkSellingEntityId(
  lines: { entityId?: string; vendorId?: string; voided?: boolean }[],
): string | null {
  const ids = checkSellingEntityIds(lines);
  if (ids.length === 1) return ids[0] ?? null;
  if (ids.length === 0) return "host";
  return null;
}

/** A reader matches when its selling entity owns items on the check. */
export function readerMatchesSellingEntities(input: {
  readerEntityId: string;
  sellingEntityId: string | null;
  sellingEntityIds?: string[];
}): boolean {
  const readerId = String(input.readerEntityId ?? "").trim();
  if (!readerId) return false;
  const listed = (input.sellingEntityIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== "host");
  if (listed.length) return listed.includes(readerId);
  if (!input.sellingEntityId) return false;
  return readerId === input.sellingEntityId;
}

/** Operators at this location. A hosted venue also includes the host account. */
export function stationLocationEntityIds(input: {
  vendors: { id: string }[];
  peerVenue?: boolean;
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const vendor of input.vendors) {
    const id = String(vendor.id ?? "").trim();
    if (!id || id === "host" || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!input.peerVenue) ids.push("host");
  return ids;
}

/**
 * Entity this card payment must use.
 * A single line entity wins. An empty check at a one-entity location uses that entity.
 * A mixed check uses the reader entity when that entity is on the check.
 */
export function paymentEntityForCardSale(input: {
  sellingEntityId: string | null;
  sellingEntityIds?: string[];
  readerEntityId: string;
  selectedEntityId?: string | null;
  locationEntityIds?: string[];
  peerVenue?: boolean;
}): string | null {
  const listed = (input.sellingEntityIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== "host");
  const selected = String(input.selectedEntityId ?? "").trim();
  if (selected && selected !== "host") {
    if (listed.length === 0 || listed.includes(selected)) return selected;
    return null;
  }
  if (listed.length === 1) return listed[0]!;
  if (listed.length > 1) {
    const readerId = String(input.readerEntityId ?? "").trim();
    if (readerId && listed.includes(readerId)) return readerId;
    return null;
  }
  const explicit = String(input.sellingEntityId ?? "").trim();
  if (explicit && explicit !== "host") return explicit;
  const operators = (input.locationEntityIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== "host");
  if (!input.peerVenue && operators.length === 1) return operators[0]!;
  return "host";
}

/** Pay and the server use this when the Finix merchants differ. */
export function readerMerchantMismatchMessage(readerEntity: string, checkEntity: string): string {
  const reader = cleanEntityLabel(readerEntity) || "the registered entity";
  const check = cleanEntityLabel(checkEntity) || "the check entity";
  return `This reader is registered to ${reader}. This payment is for ${check}. The Finix merchants do not match. Open Devices, select this reader, and choose Reassign. The tablet stays paired.`;
}

export function readerNeedsEntityChoiceMessage(entities: string): string {
  const named = cleanEntityLabel(entities);
  const which = named ? ` (${named})` : "";
  return `This check has more than one selling entity${which}. Pick the entity for this payment. Open Devices and choose Reassign if this reader must move. The tablet stays paired.`;
}

/**
 * Same entity always proceeds.
 * Another entity at this location proceeds so the server can compare Finix merchants.
 * A merchant mismatch is named before any charge.
 */
export function cardSaleEntityAllowed(input: {
  readerEntityId: string;
  readerLabel?: string;
  checkLabel?: string;
  sellingEntityId: string | null;
  sellingEntityIds?: string[];
  locationEntityIds?: string[];
  peerVenue?: boolean;
  selectedEntityId?: string | null;
}): { ok: true; paymentEntityId: string } | { ok: false; message: string } {
  const readerId = String(input.readerEntityId ?? "").trim();
  const listed = (input.sellingEntityIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== "host");
  const paymentEntityId = paymentEntityForCardSale({
    sellingEntityId: input.sellingEntityId,
    sellingEntityIds: input.sellingEntityIds,
    readerEntityId: readerId,
    selectedEntityId: input.selectedEntityId,
    locationEntityIds: input.locationEntityIds,
    peerVenue: input.peerVenue,
  });
  if (!paymentEntityId) {
    return { ok: false, message: readerNeedsEntityChoiceMessage(listed.join(", ")) };
  }
  if (input.peerVenue && paymentEntityId === "host") {
    return {
      ok: false,
      message: "The venue is not a selling entity. Pick the operator on the check.",
    };
  }
  if (readerId && readerId === paymentEntityId) return { ok: true, paymentEntityId };
  const allowed = new Set(
    (input.locationEntityIds ?? []).map((id) => id.trim()).filter((id) => id),
  );
  if (allowed.has(paymentEntityId)) return { ok: true, paymentEntityId };
  return {
    ok: false,
    message: readerMerchantMismatchMessage(
      input.readerLabel || readerId,
      input.checkLabel || paymentEntityId,
    ),
  };
}

function cleanEntityLabel(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** Display name for a selling entity id. Host uses the venue name. */
export function sellingEntityLabel(
  entityId: string | null | undefined,
  names: { id: string; name: string }[],
  hostName?: string,
): string {
  const id = cleanEntityLabel(String(entityId ?? ""));
  if (!id) return "Unknown";
  if (id === "host") return cleanEntityLabel(hostName ?? "") || "Host";
  const found = names.find((row) => row.id === id);
  return cleanEntityLabel(found?.name ?? "") || id;
}

/** Selling entity on the open check, named for the Pay banner. */
export function checkEntityBannerLabel(input: {
  lines: { entityId?: string; vendorId?: string; voided?: boolean }[];
  names: { id: string; name: string }[];
  hostName?: string;
}): { id: string | null; label: string } {
  const id = checkSellingEntityId(input.lines);
  if (id) return { id, label: sellingEntityLabel(id, input.names, input.hostName) };
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (line.voided) continue;
    const lineId = cleanEntityLabel(String(line.entityId || line.vendorId || ""));
    if (!lineId || seen.has(lineId)) continue;
    seen.add(lineId);
    ids.push(lineId);
  }
  const label = ids.map((lineId) => sellingEntityLabel(lineId, input.names, input.hostName)).join(" and ");
  return { id: null, label: label || "Unknown" };
}

export function readerEntityLabel(
  reader: { entityId: string; entityName?: string },
  names: { id: string; name: string }[],
  hostName?: string,
): string {
  const named = cleanEntityLabel(reader.entityName ?? "");
  if (named) return named;
  return sellingEntityLabel(reader.entityId, names, hostName);
}

/**
 * Check side of the pay banner.
 * A reader that owns items uses that selling entity. A mismatch names the entities on the check.
 */
export function checkEntityLabelForReader(input: {
  lines: { entityId?: string; vendorId?: string; voided?: boolean }[];
  readerEntityId: string;
  names: { id: string; name: string }[];
  hostName?: string;
}): string {
  const ids = checkSellingEntityIds(input.lines);
  const readerId = String(input.readerEntityId ?? "").trim();
  if (readerId && ids.includes(readerId)) {
    return sellingEntityLabel(readerId, input.names, input.hostName);
  }
  if (ids.length) {
    return ids.map((id) => sellingEntityLabel(id, input.names, input.hostName)).join(" and ");
  }
  return checkEntityBannerLabel({
    lines: input.lines,
    names: input.names,
    hostName: input.hostName,
  }).label;
}

/** Pay banner. It names the reader entity and the check entity. */
export function readerCheckEntityBanner(readerEntity: string, checkEntity: string): string {
  const reader = cleanEntityLabel(readerEntity) || "Unknown";
  const check = cleanEntityLabel(checkEntity) || "Unknown";
  return `Reader entity ${reader}. Check entity ${check}.`;
}

export function isReaderCheckEntityBanner(message: string): boolean {
  const text = String(message ?? "").trim();
  return text.startsWith("Reader entity ") && text.includes(". Check entity ") && text.endsWith(".");
}

export function checkAlreadyCaptured(input: {
  checkId?: string;
  status?: string;
  payments?: { method?: string; finixTransferId?: string }[];
  /** An open check already has a card authorization waiting for the tip. */
  cardAuth?: boolean;
}): boolean {
  if (input.cardAuth) return true;
  if (input.checkId && checkCapturedLocally(input.checkId)) return true;
  if (input.status === "closed" || input.status === "voided" || input.status === "cancelled") {
    return true;
  }
  return (input.payments ?? []).some(
    (p) => p.method === "card" && Boolean(String(p.finixTransferId ?? "").trim()),
  );
}

export function decidePaxPick(input: {
  row: PaxScanRow;
  readers: PaxReader[];
  sellingEntityId: string | null;
  /** Item selling entities. When present, the building name is not the match. */
  sellingEntityIds?: string[];
  /** Selling entities at this location. A match here waits for the merchant check. */
  locationEntityIds?: string[];
  peerVenue?: boolean;
  /** Staff picked this entity for the payment. */
  paymentEntityId?: string | null;
  locationLive: boolean;
}): { ok: true; reader: PaxReader; paymentEntityId: string } | { ok: false; message: string } {
  const reader = readerForSerial(input.readers, input.row.serial);
  if (!input.row.registered || !reader) {
    return { ok: false, message: PAX_MSG.notRegistered };
  }
  const blocked = readerEnvironmentBlock(input.locationLive, reader);
  if (blocked) return { ok: false, message: blocked };
  const gate = cardSaleEntityAllowed({
    readerEntityId: reader.entityId,
    readerLabel: reader.entityName || reader.entityId,
    sellingEntityId: input.sellingEntityId,
    sellingEntityIds: input.sellingEntityIds,
    locationEntityIds: input.locationEntityIds,
    peerVenue: input.peerVenue,
    selectedEntityId: input.paymentEntityId,
  });
  if (!gate.ok) return gate;
  return { ok: true, reader, paymentEntityId: gate.paymentEntityId };
}

/**
 * Connect a registered reader from the station device screen, before a check is open.
 * The slot serial wins. An empty slot may claim the reader for this station.
 */
export function decideStationReaderConnect(input: {
  row: PaxScanRow;
  readers: PaxReader[];
  locationLive: boolean;
  assignedSerial: string | null;
}): { ok: true; reader: PaxReader; claimSlot: boolean } | { ok: false; message: string } {
  const reader = readerForSerial(input.readers, input.row.serial);
  if (!input.row.registered || !reader) {
    return { ok: false, message: PAX_MSG.notRegistered };
  }
  const blocked = readerEnvironmentBlock(input.locationLive, reader);
  if (blocked) return { ok: false, message: blocked };
  const slot = normalizePaxSerial(String(input.assignedSerial ?? ""));
  if (slot && slot !== reader.serial) {
    const assigned = readerForSerial(input.readers, slot);
    const name = assigned?.name || slot;
    return { ok: false, message: `This station is assigned to ${name}.` };
  }
  return { ok: true, reader, claimSlot: !slot };
}

/**
 * Same reader, already accepted, Bluetooth still up.
 * Selecting it again keeps that link. It does not open a second connection.
 */
export function reuseHeldPaxLink(input: {
  heldReady: boolean;
  heldConnected: boolean;
  heldSerial: string | null;
  serial: string;
}): boolean {
  const serial = normalizePaxSerial(input.serial);
  const held = normalizePaxSerial(String(input.heldSerial ?? ""));
  return Boolean(input.heldReady && input.heldConnected && serial && held === serial);
}

/**
 * Connect result from the Finix Bluetooth path.
 * The callback text stays as written. A blank result is the 15 second wait.
 */
export function paxConnectFailureReason(message?: string | null): string {
  const text = String(message ?? "").trim();
  if (!text) return PAX_MSG.connectTimeout;
  return text;
}

/**
 * Tablet line for an SDK connect failure.
 * The callback text is kept, including a code when the SDK returned one separately.
 * A blank callback is the 15 second wait. The password is not added here.
 */
export function paxTabletCallback(input: {
  message?: string | null;
  sdkMessage?: string | null;
  sdkCode?: string | null;
}): string {
  const message = String(input.sdkMessage || input.message || "")
    .replace(/\s+/g, " ")
    .trim();
  const code = String(input.sdkCode ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!message && (!code || code === "none" || code === "missing")) return PAX_MSG.connectTimeout;
  if (!code || code === "none" || code === "missing") return message;
  if (message.toLowerCase().includes(code.toLowerCase())) return message;
  return `${message} code ${code}`.trim();
}

/** Saved reader name on a scan row. The Bluetooth name stays the connect key. */
export function paxScanRowLabel(row: PaxScanRow, readers: PaxReader[]): string {
  const stored = readerForSerial(readers, row.serial)?.name.trim();
  return stored || row.name;
}

/**
 * The credential or environment MPOSFinix was given.
 * The password value is never included. Environment SB is the station default.
 */
export function finixFailedCredential(input: {
  userId: string;
  password: string;
  merchantId: string;
  deviceId: string;
  env: string;
}): string {
  const env = String(input.env ?? "").trim() || "SB";
  const userId = String(input.userId ?? "").trim();
  const merchantId = String(input.merchantId ?? "").trim();
  const deviceId = String(input.deviceId ?? "").trim();
  if (env !== "SB") return `Environment ${env}.`;
  if (!userId.startsWith("US")) return "Finix sandbox username.";
  if (!String(input.password ?? "").trim()) return "Finix sandbox password.";
  if (!merchantId.startsWith("MU")) return "merchant ID.";
  if (!deviceId.startsWith("DV")) return deviceId ? `device ID ${deviceId}.` : "device ID.";
  return "Finix sandbox password.";
}

/** Keep the exact Finix Unauthorized text and name the credential or environment. */
export function finixUnauthorizedBanner(input: {
  message?: string | null;
  userId: string;
  password: string;
  merchantId: string;
  deviceId: string;
  env: string;
}): string | null {
  const text = String(input.message ?? "").replace(/\s+/g, " ").trim();
  if (!/unauthorized/i.test(text)) return null;
  if (
    /Finix sandbox username|Finix sandbox password|merchant ID|device ID|Environment /.test(text)
  ) {
    return text;
  }
  const head = /[.!?]$/.test(text) ? text : `${text}.`;
  return `${head} ${finixFailedCredential(input)}`;
}

/** Connect failure for the station banner. Unauthorized names the credential. Other results stay. */
export function presentFinixConnectFailure(input: {
  message?: string | null;
  userId: string;
  password: string;
  merchantId: string;
  deviceId: string;
  env: string;
}): string {
  return finixUnauthorizedBanner(input) ?? paxConnectFailureReason(input.message);
}

/** SB or LIVE. A blank or sandbox value is the Environment.SB passed to MPOSFinix. */
export function finixInitEnvironment(env: string): "SB" | "LIVE" {
  const raw = String(env ?? "").trim().toUpperCase();
  if (raw === "LIVE" || raw === "PROD") return "LIVE";
  return "SB";
}

/**
 * Values passed to MPOSFinix. Username and password are present or missing.
 * The secret values are not included.
 */
export function finixConnectDiagnostic(input: {
  userId: string;
  password: string;
  merchantId: string;
  deviceId: string;
  env: string;
}): string {
  const env = finixInitEnvironment(input.env);
  const merchant = String(input.merchantId ?? "").trim() || "missing";
  const device = paxSdkDeviceId(input.deviceId) || "missing";
  const username = String(input.userId ?? "").trim() ? "yes" : "no";
  const password = String(input.password ?? "").trim() ? "yes" : "no";
  return `Environment ${env}. Username present ${username}. Password present ${password}. Merchant ${merchant}. Device ${device}.`;
}

/** Diagnostic, then Reader ready or the Finix result. A result that already starts with it stays. */
export function finixConnectBanner(diagnostic: string, result: string): string {
  const head = String(diagnostic ?? "").trim();
  const tail = String(result ?? "").replace(/\s+/g, " ").trim();
  if (!head) return tail;
  if (!tail) return head;
  if (tail.startsWith(head)) return tail;
  return `${head} ${tail}`;
}

/** Station log of the init line. The line has no username or password value. */
export function logFinixConnectDiagnostic(diagnostic: string): void {
  const line = String(diagnostic ?? "").trim();
  if (line) console.info(line);
}

/** Retry once when the first open did not get a Finix answer. A named Finix error is the result. */
export function paxConnectShouldRetry(message?: string | null): boolean {
  const text = String(message ?? "").trim();
  const lower = text.toLowerCase();
  if (text === PAX_MSG.permissions || text === PAX_MSG.bluetooth) return false;
  if (/unauthorized/i.test(text)) return false;
  if (
    !text ||
    lower === "timeout" ||
    text === PAX_MSG.connectTimeout ||
    text === PAX_MSG.connectNoResponse ||
    text === PAX_MSG.notConnected
  ) {
    return true;
  }
  return (
    text === "Disconnecting — try again shortly." ||
    text === "Connection already in progress." ||
    text === "Exception during connection"
  );
}

export type PaxConnectCallResult = {
  ok: boolean;
  message?: string;
  batteryPercent?: number | null;
  merchantId?: string;
  deviceId?: string;
  usernamePrefix?: string;
  environment?: string;
  sdkMessage?: string;
  sdkCode?: string;
};

/** First six characters of the merchant username passed to MerchantData. The rest is not recorded. */
export function finixUsernamePrefix(userId: string): string {
  return String(userId ?? "").slice(0, 6);
}

/** Drop a stuffed username or password from an SDK message. Presence words stay. */
function redactSdkMessage(message: string): string {
  return String(message ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(password|username|userId|user_id)\b\s*[:=]\s*\S+/gi, "$1 present")
    .slice(0, 800);
}

/**
 * MerchantData values passed into the Finix Android SDK, plus the SDK exception.
 * The password is not included. The username is only the first six characters.
 */
export function finixSdkConnectActivity(input: {
  merchantId?: string;
  deviceId?: string;
  usernamePrefix?: string;
  environment?: string;
  sdkMessage?: string;
  sdkCode?: string;
}): string {
  const merchant = String(input.merchantId ?? "").trim() || "missing";
  const device = String(input.deviceId ?? "").trim() || "missing";
  const prefix = String(input.usernamePrefix ?? "").slice(0, 6) || "missing";
  const env = String(input.environment ?? "").trim() || "missing";
  const message = redactSdkMessage(String(input.sdkMessage ?? "")) || "missing";
  const code = String(input.sdkCode ?? "").trim().slice(0, 80) || "missing";
  return `MerchantData merchantId ${merchant}. deviceId ${device}. username prefix ${prefix}. environment ${env}. SDK message ${message}. code ${code}.`;
}

/** Fields the Android plugin returns after it calls MPOSFinix.connect. Absent on a web pre-check. */
export function finixSdkTraceFromConnect(result: PaxConnectCallResult | null | undefined): {
  merchantId: string;
  deviceId: string;
  usernamePrefix: string;
  environment: string;
  sdkMessage: string;
  sdkCode: string;
} | null {
  if (!result) return null;
  const merchantId = String(result.merchantId ?? "").trim();
  const deviceId = String(result.deviceId ?? "").trim();
  const usernamePrefix = String(result.usernamePrefix ?? "").slice(0, 6);
  const environment = String(result.environment ?? "").trim();
  const sdkMessage = String(result.sdkMessage ?? "").trim();
  const sdkCode = String(result.sdkCode ?? "").trim();
  if (!merchantId && !deviceId && !usernamePrefix && !sdkMessage && !sdkCode) return null;
  return { merchantId, deviceId, usernamePrefix, environment, sdkMessage, sdkCode };
}

/**
 * One connect, then one retry when the first open did not get a Finix answer.
 * A named Finix error is the result. The retry still allows the D135 its key download.
 */
export async function runPaxConnect(
  connect: () => Promise<PaxConnectCallResult>,
): Promise<PaxConnectCallResult> {
  let last: PaxConnectCallResult = { ok: false, message: PAX_MSG.connectTimeout, batteryPercent: null };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await connect();
      if (result.ok) return result;
      const text = String(result.message ?? "").replace(/\s+/g, " ").trim();
      const message = text || PAX_MSG.connectTimeout;
      last = { ...result, ok: false, message, batteryPercent: result.batteryPercent ?? null };
      if (!paxConnectShouldRetry(result.message)) return last;
    } catch (err) {
      const detail = err instanceof Error ? err.message.trim() : "";
      const message = detail || "Exception during connection";
      last = {
        ok: false,
        message,
        batteryPercent: null,
        sdkMessage: message,
        sdkCode: "Exception",
      };
      if (!paxConnectShouldRetry(message)) break;
    }
  }
  return last;
}

/**
 * Status while a selected D135 is linking.
 * Connecting, then Reader ready. Key download shows each Finix progress line.
 * A failure shows the Finix callback. It does not say the reader did not respond.
 * The disconnect line is only after Reader ready, when that link drops.
 */
export function presentPaxHold(input: {
  event: "select" | "processing" | "accepted" | "failed" | "dropped";
  wasReady: boolean;
  message?: string;
}): { message: string; hold: boolean } {
  if (input.event === "select") return { message: PAX_MSG.connecting, hold: true };
  if (input.event === "processing") {
    const progress = String(input.message ?? "").trim();
    return { message: progress || PAX_MSG.settingUp, hold: true };
  }
  if (input.event === "accepted") return { message: PAX_MSG.ready, hold: true };
  if (input.event === "dropped" && input.wasReady) return { message: PAX_MSG.disconnect, hold: false };
  return { message: paxConnectFailureReason(input.message), hold: false };
}

/**
 * Shown on the device screen and on Pay.
 * A Finix init banner stays up through the call and until the next connect attempt.
 */
export function paxLinkStatusText(link: { phase: string; message: string }): string {
  const message = String(link.message ?? "");
  if (message.startsWith("Environment ")) return message;
  if (isReaderCheckEntityBanner(message)) return message;
  if (link.phase === "connected") return PAX_MSG.ready;
  if (link.phase === "connecting") return PAX_MSG.connecting;
  if (link.phase === "setting_up") return message || PAX_MSG.settingUp;
  return message;
}

/** Last Bluetooth name and address for an assigned reader. Keyed by serial. */
export const PAX_READER_LINK_KEY = "summex.pax.reader-link";

export type PaxBluetoothMemory = {
  serial: string;
  address: string;
  name: string;
};

function readPaxBluetoothStore(): Record<string, PaxBluetoothMemory> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PAX_READER_LINK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, PaxBluetoothMemory> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const serial = normalizePaxSerial(String(row.serial ?? key));
      const address = String(row.address ?? "").trim().slice(0, 80);
      const name = String(row.name ?? "").trim().slice(0, 80);
      if (!serial || !address || address.toLowerCase() === "usb") continue;
      out[serial] = { serial, address, name };
    }
    return out;
  } catch {
    return {};
  }
}

/** Address saved after the last successful Bluetooth connect for this serial. */
export function rememberedPaxBluetooth(serial: string): PaxBluetoothMemory | null {
  const key = normalizePaxSerial(serial);
  if (!key) return null;
  return readPaxBluetoothStore()[key] ?? null;
}

/** Keep the Bluetooth address so the next launch can connect without a scan. */
export function rememberPaxBluetooth(input: PaxBluetoothMemory): void {
  if (typeof localStorage === "undefined") return;
  const serial = normalizePaxSerial(input.serial);
  const address = String(input.address ?? "").trim().slice(0, 80);
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!serial || !address || address.toLowerCase() === "usb") return;
  const all = readPaxBluetoothStore();
  all[serial] = { serial, address, name };
  try {
    localStorage.setItem(PAX_READER_LINK_KEY, JSON.stringify(all));
  } catch {
    /* the next scan can still connect */
  }
}

/**
 * Station Devices face. Connected only when the assigned reader is up.
 * Pay still uses Reader ready. This line is the Devices screen only.
 */
export function stationDeviceFaceStatus(input: {
  phase: string;
  connectedSerial?: string | null;
  assignedSerial?: string | null;
  usb?: boolean;
  usbAttached?: boolean | null;
}): { label: "Connected" | "Not connected"; connected: boolean } {
  const assigned = normalizePaxSerial(String(input.assignedSerial ?? ""));
  const connectedSerial = normalizePaxSerial(String(input.connectedSerial ?? ""));
  const phaseUp = input.phase === "connected";
  const serialOk = !assigned || connectedSerial === assigned;
  if (input.usb) {
    const up = phaseUp && input.usbAttached === true && serialOk;
    return { label: up ? "Connected" : "Not connected", connected: up };
  }
  const up = phaseUp && serialOk;
  return { label: up ? "Connected" : "Not connected", connected: up };
}

export type PaxAutoConnectPlan = "skip" | "direct" | "scan" | "usb";

/**
 * One automatic attempt for the reader assigned to this station.
 * A saved Bluetooth address connects directly. Otherwise the station scans.
 * USB uses the cable. Network stays off this path.
 */
export function paxAutoConnectPlan(input: {
  phase: string;
  connectedSerial?: string | null;
  assigned: PaxReader | null;
  rememberedAddress?: string | null;
  usbAttached?: boolean | null;
  inFlight?: boolean;
}): PaxAutoConnectPlan {
  const assigned = input.assigned;
  if (!assigned || input.inFlight) return "skip";
  if (input.phase === "scanning" || input.phase === "connecting" || input.phase === "setting_up") {
    return "skip";
  }
  const held = normalizePaxSerial(String(input.connectedSerial ?? ""));
  if (input.phase === "connected" && held === assigned.serial) return "skip";
  const link = normalizePaxLink(assigned.link);
  if (link === "network") return "skip";
  if (link === "usb") return input.usbAttached === true ? "usb" : "skip";
  if (String(input.rememberedAddress ?? "").trim()) return "direct";
  return "scan";
}

/**
 * Pay status. The reader entity and the check entity stay on the banner.
 * A match then continues into the Finix connect line.
 */
export function payEntityStatusText(
  link: { phase: string; message: string },
  entityBanner: string | null,
): string {
  const status = paxLinkStatusText(link);
  const banner = String(entityBanner ?? "").trim();
  if (!banner) return status;
  if (status === banner || status.startsWith(`${banner} `)) return status;
  return `${banner} ${status}`;
}

/** Pay uses the reader that is already connected. Opening Pay does not clear it. */
export function connectedReaderForPayment(link: {
  phase: string;
  reader: PaxReader | null;
}): PaxReader | null {
  if (link.phase === "connected" && link.reader) return link.reader;
  return null;
}

export function paymentUsesConnectedReader(link: {
  phase: string;
  reader: PaxReader | null;
}): boolean {
  return connectedReaderForPayment(link) != null;
}

export function placePaxReader(input: {
  readers: PaxReader[];
  name: string;
  serial: string;
  entityId: string;
  entityName: string;
  locationLive: boolean;
  deviceId: string;
  merchantId: string;
  id: string;
  link?: PaxReaderLink;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  if (input.locationLive) return { ok: false, message: PAX_MSG.liveRegister };
  const serial = normalizePaxSerial(input.serial);
  const entityId = input.entityId.trim();
  const name = normalizeReaderName(input.name);
  if (!serial || !entityId) return { ok: false, message: PAX_MSG.notSaved };
  if (!name) return { ok: false, message: PAX_MSG.nameRequired };
  if (!input.deviceId.startsWith("DV")) {
    return { ok: false, message: "The reader could not be saved." };
  }
  const nameTaken = input.readers.some(
    (r) => r.serial !== serial && r.name.toLowerCase() === name.toLowerCase(),
  );
  if (nameTaken) return { ok: false, message: PAX_MSG.nameTaken };
  const existing = readerForSerial(input.readers, serial);
  if (existing && existing.entityId !== entityId) {
    return { ok: false, message: PAX_MSG.serialTaken };
  }
  if (existing) return { ok: true, readers: input.readers, reader: existing };
  const reader: PaxReader = {
    id: input.id.slice(0, 80),
    name,
    serial,
    entityId,
    entityName: input.entityName.trim().slice(0, 80),
    finixDeviceId: input.deviceId,
    sandboxDeviceId: input.deviceId,
    finixMerchantId: input.merchantId,
    model: PAX_MODEL,
    env: "sandbox",
    link: normalizePaxLink(input.link),
  };
  return { ok: true, readers: [...input.readers, reader], reader };
}

/** Change Bluetooth, Network, or USB. The serial and the Finix device id stay. */
export function setPaxReaderLink(input: {
  readers: PaxReader[];
  id: string;
  link: PaxReaderLink;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  const link = normalizePaxLink(input.link);
  const reader: PaxReader = { ...current, link };
  if (readerLink(current) === link) return { ok: true, readers: input.readers, reader };
  return {
    ok: true,
    readers: input.readers.map((r) => (r.id === current.id ? reader : r)),
    reader,
  };
}

/**
 * Save the Finix device ID on an existing reader.
 * The name and the serial stay. A blank id is refused. A serial-only reader stays listed until this succeeds.
 */
export function setPaxDeviceId(input: {
  readers: PaxReader[];
  id: string;
  deviceId: string;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  const deviceId = normalizeFinixDeviceId(input.deviceId);
  if (!deviceId.startsWith("DV")) return { ok: false, message: PAX_MSG.deviceIdRequired };
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  if (current.finixDeviceId === deviceId) return { ok: true, readers: input.readers, reader: current };
  const reader: PaxReader = {
    ...current,
    finixDeviceId: deviceId,
    sandboxDeviceId: current.env === "live" ? current.sandboxDeviceId : deviceId,
    liveDeviceId: current.env === "live" ? deviceId : current.liveDeviceId,
    serial: current.serial,
    name: current.name,
  };
  return {
    ok: true,
    readers: input.readers.map((r) => (r.id === current.id ? reader : r)),
    reader,
  };
}

/** Change the Devices name. The Finix device id and the serial stay. */
export function renamePaxReader(input: {
  readers: PaxReader[];
  id: string;
  name: string;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  const name = normalizeReaderName(input.name);
  if (!name) return { ok: false, message: PAX_MSG.nameRequired };
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  const nameTaken = input.readers.some(
    (r) => r.id !== current.id && r.name.toLowerCase() === name.toLowerCase(),
  );
  if (nameTaken) return { ok: false, message: PAX_MSG.nameTaken };
  if (current.name === name) return { ok: true, readers: input.readers, reader: current };
  const reader: PaxReader = { ...current, name, finixDeviceId: current.finixDeviceId, serial: current.serial };
  return {
    ok: true,
    readers: input.readers.map((r) => (r.id === current.id ? reader : r)),
    reader,
  };
}

type AssignedStation = { id: string; cardReaderId?: string | null };

function stationsForSerial<T extends AssignedStation>(
  devices: readonly T[],
  serial: string,
  next: string | null,
): T[] {
  const target = normalizePaxSerial(serial);
  const assigned = next ? normalizePaxSerial(next) : "";
  return devices.map((device) => {
    if (normalizePaxSerial(String(device.cardReaderId ?? "")) !== target) return device;
    return { ...device, cardReaderId: assigned || null };
  });
}

/** Drop the reader. Stations that pointed at its serial lose that assignment. */
export function removePaxReader<T extends AssignedStation>(input: {
  readers: PaxReader[];
  devices: readonly T[];
  id: string;
}):
  | { ok: true; readers: PaxReader[]; devices: T[]; removed: PaxReader }
  | { ok: false; message: string } {
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  return {
    ok: true,
    readers: input.readers.filter((r) => r.id !== current.id),
    devices: stationsForSerial(input.devices, current.serial, null),
    removed: current,
  };
}

/**
 * Move this reader to another selling entity at the location.
 * The serial and the Finix device ID stay, so the tablet assignment stays.
 */
export function reassignPaxReader(input: {
  readers: PaxReader[];
  id: string;
  entityId: string;
  entityName: string;
  merchantId: string;
}): { ok: true; readers: PaxReader[]; reader: PaxReader } | { ok: false; message: string } {
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  const entityId = input.entityId.trim().slice(0, 80);
  if (!entityId) return { ok: false, message: PAX_MSG.notSaved };
  const entityName = cleanEntityLabel(input.entityName).slice(0, 80) || entityId;
  const merchantId = input.merchantId.trim().slice(0, 80);
  const reader: PaxReader = {
    ...current,
    entityId,
    entityName,
    finixMerchantId: merchantId || current.finixMerchantId,
    serial: current.serial,
    finixDeviceId: current.finixDeviceId,
  };
  return {
    ok: true,
    readers: input.readers.map((r) => (r.id === current.id ? reader : r)),
    reader,
  };
}

/**
 * Keep the same reader and any station that uses it.
 * The serial and the Finix device ID can change. The name and the selling entity stay.
 * The reader stays listed, so payment can still use it.
 */
export function replacePaxReader<T extends AssignedStation>(input: {
  readers: PaxReader[];
  devices: readonly T[];
  id: string;
  serial: string;
  deviceId: string;
}):
  | { ok: true; readers: PaxReader[]; devices: T[]; reader: PaxReader }
  | { ok: false; message: string } {
  const current = input.readers.find((r) => r.id === input.id);
  if (!current) return { ok: false, message: PAX_MSG.notRegistered };
  const serial = normalizePaxSerial(input.serial);
  if (!serial) return { ok: false, message: PAX_MSG.serialRequired };
  const deviceId = normalizeFinixDeviceId(input.deviceId);
  if (!deviceId.startsWith("DV")) return { ok: false, message: PAX_MSG.deviceIdRequired };
  const taken = input.readers.some((r) => r.id !== current.id && r.serial === serial);
  if (taken) return { ok: false, message: PAX_MSG.serialOnReader };
  const reader: PaxReader = {
    ...current,
    serial,
    finixDeviceId: deviceId,
    name: current.name,
    entityId: current.entityId,
    entityName: current.entityName,
  };
  return {
    ok: true,
    readers: input.readers.map((r) => (r.id === current.id ? reader : r)),
    devices:
      serial === current.serial ? input.devices.map((device) => device) : stationsForSerial(input.devices, current.serial, serial),
    reader,
  };
}

export function readerAssignOptions(input: {
  readers: PaxReader[];
  devices: { id: string; label?: string; cardReaderId?: string | null }[];
  tabletId: string | null;
}): { serial: string; name: string }[] {
  const taken = new Set<string>();
  for (const device of input.devices) {
    if (input.tabletId && device.id === input.tabletId) continue;
    const serial = normalizePaxSerial(String(device.cardReaderId ?? ""));
    if (serial) taken.add(serial);
  }
  return input.readers
    .filter((reader) => !taken.has(reader.serial))
    .map((reader) => ({ serial: reader.serial, name: reader.name }));
}

/** One reader on one tablet. Empty when this tablet may keep the serial. */
export function readerAssignmentBlock(input: {
  readers: PaxReader[];
  devices: { id: string; label?: string; cardReaderId?: string | null }[];
  tabletId: string;
  serial: string;
}): string | null {
  const serial = normalizePaxSerial(input.serial);
  if (!serial) return null;
  const other = input.devices.find(
    (device) =>
      device.id !== input.tabletId && normalizePaxSerial(String(device.cardReaderId ?? "")) === serial,
  );
  if (!other) return null;
  const reader = readerForSerial(input.readers, serial);
  const name = reader?.name || serial;
  return `${name} is already assigned to ${other.label || "another tablet"}.`;
}

export type PaxSdkCode =
  | "ok"
  | "declined"
  | "cancelled"
  | "chip"
  | "timeout"
  | "disconnect"
  | "setting_up"
  | "already_captured"
  | "error";

export function classifyPaxError(
  code: string,
  raw?: string,
  opts?: { amountCents?: number; training?: boolean },
): { message: string; leaveOpen: true } {
  const sdk = String(raw ?? "").replace(/\s+/g, " ").trim();
  const text = `${code} ${sdk}`.toLowerCase();
  if (code === "already_captured" || text.includes("already paid") || text.includes("second charge")) {
    return { message: PAX_MSG.alreadyPaid, leaveOpen: true };
  }
  if (code === "setting_up" || text.includes("setting up")) {
    return { message: PAX_MSG.stillSettingUp, leaveOpen: true };
  }
  if (code === "chip" || text.includes("chip") || text.includes("emv") || /\bicc\b/.test(text)) {
    return { message: PAX_MSG.chip, leaveOpen: true };
  }
  if (code === "timeout" || text.includes("timeout") || text.includes("timed out")) {
    return { message: PAX_MSG.timeout, leaveOpen: true };
  }
  if (code === "disconnect" || text.includes("disconnect") || text.includes("bluetooth")) {
    return { message: PAX_MSG.disconnect, leaveOpen: true };
  }
  const known = (Object.values(PAX_MSG) as string[]).find(
    (line) => sdk === line && line !== PAX_MSG.declined && line !== PAX_MSG.cancelled,
  );
  if (known) return { message: known, leaveOpen: true };
  const short = displayCardDecline({
    message: sdk,
    code,
    amountCents: opts?.amountCents,
    training: opts?.training === true,
  });
  if (short) return { message: short, leaveOpen: true };
  if (!sdk) return { message: PAX_MSG.unread, leaveOpen: true };
  return { message: DECLINE_GENERIC, leaveOpen: true };
}

/**
 * Parameters passed to the Finix Android SDK card-present sale.
 * The key is the check's stored attempt UUID. PaxD135Plugin.saleOnWorker logs this
 * same line, then passes it as the last startTransaction argument (idempotencyId).
 * SDK 3.8.0 writes that value on the card_reader body as idempotency_id.
 * The plugin also copies it onto the Idempotency-Key header of that post.
 * A card_reader sale whose body has no idempotency id is not sent.
 * The card_reader response has no payment instrument, so the sale does not
 * create a second transfer.
 */
export type AndroidSdkSaleRequest = {
  amountCents: number;
  transactionType: "AUTHORIZATION";
  buyerIdentityId: null;
  tags: { check: string };
  promptForSignature: "Never";
  idempotency_id: string;
};

/** Refuse a sale payload whose idempotency_id is missing or not a UUID v4. */
export function androidSdkSaleRequest(input: {
  amountCents: number;
  checkId: string;
  idempotencyId: string;
}): AndroidSdkSaleRequest {
  const idempotency_id = String(input.idempotencyId ?? "").trim();
  if (!CARD_SALE_UUID.test(idempotency_id)) {
    throw new Error("SDK sale request missing idempotency_id");
  }
  return {
    amountCents: input.amountCents,
    transactionType: "AUTHORIZATION",
    buyerIdentityId: null,
    tags: { check: input.checkId },
    promptForSignature: "Never",
    idempotency_id,
  };
}

/** Log line for the SDK sale parameters. No card number, password, or merchant id. */
export function androidSdkSaleRequestLog(request: AndroidSdkSaleRequest): string {
  return (
    `SDK sale request amountCents=${request.amountCents}` +
    ` transactionType=${request.transactionType}` +
    ` buyerIdentityId=null` +
    ` tags.check=${request.tags.check}` +
    ` promptForSignature=${request.promptForSignature}` +
    ` idempotencyId=${request.idempotency_id}` +
    ` idempotency_id=${request.idempotency_id}`
  );
}

export type PaxBridge = {
  sale: (input: {
    amountCents: number;
    checkId: string;
    tipCents: number;
    idempotencyId: string;
  }) => Promise<{
    ok: boolean;
    code?: string;
    transferId?: string;
    last4?: string | null;
    message?: string;
    idempotencyId?: string;
  }>;
  capture?: (input: { transferId: string; amountCents: number }) => Promise<{
    ok: boolean;
    message?: string;
    skipped?: boolean;
  }>;
  voidSale?: (input: { transferId: string; amountCents: number }) => Promise<{
    ok: boolean;
    message?: string;
    skipped?: boolean;
  }>;
};

export async function runAndroidPaxSale(input: {
  checkId: string;
  amountCents: number;
  tipCents?: number;
  locationLive: boolean;
  reader: PaxReader | null;
  sellingEntityId: string | null;
  sellingEntityIds?: string[];
  /** Selling entities at this location. Included so a matching merchant is not blocked here. */
  locationEntityIds?: string[];
  peerVenue?: boolean;
  alreadyCaptured: boolean;
  settingUp: boolean;
  connected: boolean;
  bluetoothOff?: boolean;
  /** Selected connection. A missing value follows the reader, then Bluetooth. */
  link?: PaxReaderLink;
  /** True only while the USB reader is plugged in. Bluetooth and Network ignore it. */
  usbAttached?: boolean;
  /** Saved on the check. A retry of this sale passes the same id. */
  idempotencyId?: string | null;
  bridge: PaxBridge;
}): Promise<
  | { ok: true; transferId: string; last4: string | null; idempotencyId: string }
  | { ok: false; message: string; charged: false; keepIdempotency: boolean }
> {
  if (input.alreadyCaptured || checkCapturedLocally(input.checkId)) {
    return { ok: false, message: PAX_MSG.alreadyPaid, charged: false, keepIdempotency: true };
  }
  if (input.reader?.needsLiveReenroll) {
    return { ok: false, message: PAX_MSG.needsLiveReenroll, charged: false, keepIdempotency: true };
  }
  if (input.locationLive && !(input.reader && readerReadyForLiveCard(input.reader))) {
    const message = input.reader
      ? envBlock(true, input.reader.env) || PAX_MSG.liveBuild
      : PAX_MSG.liveBuild;
    return { ok: false, message, charged: false, keepIdempotency: true };
  }
  if (!input.locationLive && input.reader && input.reader.env === "live") {
    return { ok: false, message: PAX_MSG.liveOnSandbox, charged: false, keepIdempotency: true };
  }
  const link = normalizePaxLink(input.link ?? input.reader?.link);
  const usb = usbCardStep({ link, usbAttached: input.usbAttached, step: "authorize" });
  if (!usb.ok) return { ok: false, message: usb.message, charged: false, keepIdempotency: true };
  if (link !== "usb" && input.bluetoothOff) {
    return { ok: false, message: PAX_MSG.bluetooth, charged: false, keepIdempotency: true };
  }
  if (input.settingUp) {
    return { ok: false, message: PAX_MSG.stillSettingUp, charged: false, keepIdempotency: true };
  }
  if (!input.reader) {
    return {
      ok: false,
      message: link === "usb" ? CARD_READER_USB_NOT_CONNECTED : PAX_MSG.notConnected,
      charged: false,
      keepIdempotency: true,
    };
  }
  const gate = cardSaleEntityAllowed({
    readerEntityId: input.reader.entityId,
    readerLabel: input.reader.entityName || input.reader.entityId,
    sellingEntityId: input.sellingEntityId,
    sellingEntityIds: input.sellingEntityIds,
    locationEntityIds: input.locationEntityIds,
    peerVenue: input.peerVenue,
  });
  if (!gate.ok) {
    return { ok: false, message: gate.message, charged: false, keepIdempotency: true };
  }
  if (!input.connected) {
    return {
      ok: false,
      message: link === "usb" ? CARD_READER_USB_NOT_CONNECTED : PAX_MSG.notConnected,
      charged: false,
      keepIdempotency: true,
    };
  }
  const idempotencyId = cardSaleIdempotencyFor(input.checkId, input.idempotencyId);
  const request = androidSdkSaleRequest({
    amountCents: input.amountCents,
    checkId: input.checkId,
    idempotencyId,
  });
  console.info(androidSdkSaleRequestLog(request));
  const result = await input.bridge.sale({
    amountCents: request.amountCents,
    checkId: request.tags.check,
    tipCents: input.tipCents ?? 0,
    idempotencyId: request.idempotency_id,
  });
  if (!result.ok || !result.transferId) {
    const raw = `${result.code || ""} ${result.message || ""}`;
    if (duplicateSaleId(raw)) {
      return {
        ok: false,
        message: PAX_MSG.alreadySent,
        charged: false,
        keepIdempotency: true,
      };
    }
    const classified = classifyPaxError(result.code || "error", result.message, {
      amountCents: input.amountCents,
      training: true,
    });
    const keepIdempotency = !shortCardDecline(classified.message);
    if (!keepIdempotency) clearCardSaleIdempotency(input.checkId);
    return { ok: false, message: classified.message, charged: false, keepIdempotency };
  }
  rememberCapturedCheck(input.checkId);
  const last4 = result.last4 ? String(result.last4).replace(/\D/g, "").slice(-4) || null : null;
  const echoed = String(result.idempotencyId ?? "").trim();
  return {
    ok: true,
    transferId: result.transferId,
    last4,
    idempotencyId: CARD_SALE_UUID.test(echoed) ? echoed : idempotencyId,
  };
}

/**
 * Capture after a USB authorization. The tip is not a second charge.
 * Bluetooth and Network keep the closeout that is already on the check.
 */
export async function runAndroidPaxCapture(input: {
  link?: PaxReaderLink | null;
  usbAttached?: boolean | null;
  transferId: string;
  amountCents: number;
  bridge?: PaxBridge;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; message: string }> {
  const step = usbCardStep({ link: input.link, usbAttached: input.usbAttached, step: "capture" });
  if (!step.ok) return step;
  if (step.transport !== "usb") return { ok: true, skipped: true };
  const capture = input.bridge?.capture;
  if (!capture) return { ok: false, message: CARD_READER_USB_NOT_CONNECTED };
  const result = await capture({
    transferId: input.transferId,
    amountCents: input.amountCents,
  });
  if (!result.ok) return { ok: false, message: result.message || CARD_READER_USB_NOT_CONNECTED };
  return { ok: true };
}

/**
 * Void an authorized USB card. The check stays open and no second charge is sent.
 * Bluetooth and Network do not require the USB cable.
 */
export async function runAndroidPaxVoid(input: {
  link?: PaxReaderLink | null;
  usbAttached?: boolean | null;
  transferId: string;
  amountCents: number;
  bridge?: PaxBridge;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; message: string }> {
  const step = usbCardStep({ link: input.link, usbAttached: input.usbAttached, step: "void" });
  if (!step.ok) return step;
  if (step.transport !== "usb") return { ok: true, skipped: true };
  const voidSale = input.bridge?.voidSale;
  if (!voidSale) return { ok: false, message: CARD_READER_USB_NOT_CONNECTED };
  const result = await voidSale({
    transferId: input.transferId,
    amountCents: input.amountCents,
  });
  if (!result.ok) return { ok: false, message: result.message || CARD_READER_USB_NOT_CONNECTED };
  return { ok: true };
}
