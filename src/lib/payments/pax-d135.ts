/**
 * PAX D135 card-present decisions for a paired Android station.
 * The Finix Android SDK runs in the station app. This module never
 * opens Web Bluetooth and never calls Stripe.
 */

export const PAX_NAME_PREFIX = "PAX D135_";
export const PAX_MODEL = "PAX_D135" as const;
export const PAX_SDK_ENV = "SB" as const;

export type PaxReaderEnv = "sandbox" | "live";

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
  serialTaken: "This reader already belongs to another selling entity.",
  nameRequired: "Enter a name for the reader.",
  nameTaken: "That name is already on a reader.",
  /** Only when the serial is empty or the selling entity is missing. */
  notSaved: "The reader was not registered.",
} as const;

const capturedChecks = new Set<string>();

export function resetPaxSaleGuards(): void {
  capturedChecks.clear();
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
    const finixDeviceId = String(o.finixDeviceId ?? "").trim().slice(0, 80);
    const finixMerchantId = String(o.finixMerchantId ?? "").trim().slice(0, 80);
    if (!serial || !entityId || !finixDeviceId.startsWith("DV")) continue;
    out.push({
      id: String(o.id ?? `pax_${serial}`).slice(0, 80),
      name: normalizeReaderName(String(o.name ?? "")) || serial,
      serial,
      entityId,
      entityName: String(o.entityName ?? "").trim().slice(0, 80),
      finixDeviceId,
      finixMerchantId,
      model: PAX_MODEL,
      env: o.env === "live" ? "live" : "sandbox",
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

export function checkSellingEntityId(
  lines: { entityId?: string; vendorId?: string; voided?: boolean }[],
): string | null {
  const ids = new Set<string>();
  for (const line of lines) {
    if (line.voided) continue;
    const id = String(line.entityId || line.vendorId || "").trim();
    if (id) ids.add(id);
  }
  if (ids.size === 1) return [...ids][0] ?? null;
  if (ids.size === 0) return "host";
  return null;
}

export function checkAlreadyCaptured(input: {
  checkId?: string;
  status?: string;
  payments?: { method?: string; finixTransferId?: string }[];
}): boolean {
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
  locationLive: boolean;
}): { ok: true; reader: PaxReader } | { ok: false; message: string } {
  const reader = readerForSerial(input.readers, input.row.serial);
  if (!input.row.registered || !reader) {
    return { ok: false, message: PAX_MSG.notRegistered };
  }
  const blocked = envBlock(input.locationLive, reader.env);
  if (blocked) return { ok: false, message: blocked };
  if (!input.sellingEntityId || reader.entityId !== input.sellingEntityId) {
    return { ok: false, message: PAX_MSG.wrongEntity };
  }
  return { ok: true, reader };
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
  const blocked = envBlock(input.locationLive, reader.env);
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
 * Status while a selected D135 is linking.
 * Connecting, then Reader ready. Setting up reader is only the first key download.
 * The disconnect line is only after Reader ready, when that link drops.
 */
export function presentPaxHold(input: {
  event: "select" | "processing" | "accepted" | "failed" | "dropped";
  wasReady: boolean;
  message?: string;
}): { message: string; hold: boolean } {
  if (input.event === "select") return { message: PAX_MSG.connecting, hold: true };
  if (input.event === "processing") return { message: PAX_MSG.settingUp, hold: true };
  if (input.event === "accepted") return { message: PAX_MSG.ready, hold: true };
  if (input.event === "dropped" && input.wasReady) return { message: PAX_MSG.disconnect, hold: false };
  const text = String(input.message ?? "").trim();
  if (!text || text === PAX_MSG.disconnect) return { message: PAX_MSG.notConnected, hold: false };
  return { message: text, hold: false };
}

/** Shown on the device screen and on Pay. Reader ready stays until the link drops. */
export function paxLinkStatusText(link: { phase: string; message: string }): string {
  if (link.phase === "connected") return PAX_MSG.ready;
  if (link.phase === "connecting") return PAX_MSG.connecting;
  if (link.phase === "setting_up") return link.message || PAX_MSG.settingUp;
  return link.message;
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
    finixMerchantId: input.merchantId,
    model: PAX_MODEL,
    env: "sandbox",
  };
  return { ok: true, readers: [...input.readers, reader], reader };
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

export function classifyPaxError(code: string, raw?: string): { message: string; leaveOpen: true } {
  const text = `${code} ${raw ?? ""}`.toLowerCase();
  if (code === "already_captured" || text.includes("already paid") || text.includes("second")) {
    return { message: PAX_MSG.alreadyPaid, leaveOpen: true };
  }
  if (code === "setting_up" || text.includes("setting up")) {
    return { message: PAX_MSG.stillSettingUp, leaveOpen: true };
  }
  if (code === "declined" || text.includes("declin")) {
    return { message: PAX_MSG.declined, leaveOpen: true };
  }
  if (code === "cancelled" || text.includes("cancel")) {
    return { message: PAX_MSG.cancelled, leaveOpen: true };
  }
  if (code === "chip" || text.includes("chip") || text.includes("emv") || text.includes("icc")) {
    return { message: PAX_MSG.chip, leaveOpen: true };
  }
  if (code === "timeout" || text.includes("timeout") || text.includes("timed out")) {
    return { message: PAX_MSG.timeout, leaveOpen: true };
  }
  if (code === "disconnect" || text.includes("disconnect") || text.includes("bluetooth")) {
    return { message: PAX_MSG.disconnect, leaveOpen: true };
  }
  return { message: PAX_MSG.unread, leaveOpen: true };
}

export type PaxBridge = {
  sale: (input: { amountCents: number; checkId: string; tipCents: number }) => Promise<{
    ok: boolean;
    code?: string;
    transferId?: string;
    last4?: string | null;
    message?: string;
  }>;
};

export async function runAndroidPaxSale(input: {
  checkId: string;
  amountCents: number;
  tipCents?: number;
  locationLive: boolean;
  reader: PaxReader | null;
  sellingEntityId: string | null;
  alreadyCaptured: boolean;
  settingUp: boolean;
  connected: boolean;
  bluetoothOff?: boolean;
  bridge: PaxBridge;
}): Promise<
  | { ok: true; transferId: string; last4: string | null }
  | { ok: false; message: string; charged: false }
> {
  if (input.alreadyCaptured || checkCapturedLocally(input.checkId)) {
    return { ok: false, message: PAX_MSG.alreadyPaid, charged: false };
  }
  if (input.locationLive) {
    const message = input.reader
      ? envBlock(true, input.reader.env) || PAX_MSG.liveBuild
      : PAX_MSG.liveBuild;
    return { ok: false, message, charged: false };
  }
  if (input.reader && input.reader.env === "live") {
    return { ok: false, message: PAX_MSG.liveOnSandbox, charged: false };
  }
  if (input.bluetoothOff) {
    return { ok: false, message: PAX_MSG.bluetooth, charged: false };
  }
  if (input.settingUp) {
    return { ok: false, message: PAX_MSG.stillSettingUp, charged: false };
  }
  if (!input.reader) {
    return { ok: false, message: PAX_MSG.notConnected, charged: false };
  }
  if (input.sellingEntityId == null || input.reader.entityId !== input.sellingEntityId) {
    return { ok: false, message: PAX_MSG.wrongEntity, charged: false };
  }
  if (!input.connected) {
    return { ok: false, message: PAX_MSG.notConnected, charged: false };
  }
  const result = await input.bridge.sale({
    amountCents: input.amountCents,
    checkId: input.checkId,
    tipCents: input.tipCents ?? 0,
  });
  if (!result.ok || !result.transferId) {
    const classified = classifyPaxError(result.code || "error", result.message);
    return { ok: false, message: classified.message, charged: false };
  }
  rememberCapturedCheck(input.checkId);
  const last4 = result.last4 ? String(result.last4).replace(/\D/g, "").slice(-4) || null : null;
  return { ok: true, transferId: result.transferId, last4 };
}
