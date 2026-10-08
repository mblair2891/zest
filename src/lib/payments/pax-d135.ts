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
  notRegistered: "This reader is not registered to this location.",
  wrongEntity: "This reader is registered to another selling entity.",
  settingUp: "Setting up reader",
  stillSettingUp: "The reader is still setting up. No charge was sent.",
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

export function serialFromPaxName(name: string): string | null {
  const trimmed = String(name ?? "").trim();
  if (!trimmed.startsWith(PAX_NAME_PREFIX)) return null;
  const serial = normalizePaxSerial(trimmed.slice(PAX_NAME_PREFIX.length));
  return serial || null;
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

export function placePaxReader(input: {
  readers: PaxReader[];
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
  if (!serial) return { ok: false, message: "Enter the reader serial." };
  if (!entityId) return { ok: false, message: "Pick the selling entity." };
  if (!input.deviceId.startsWith("DV")) {
    return { ok: false, message: "The reader was not registered." };
  }
  const existing = readerForSerial(input.readers, serial);
  if (existing && existing.entityId !== entityId) {
    return { ok: false, message: PAX_MSG.serialTaken };
  }
  if (existing) return { ok: true, readers: input.readers, reader: existing };
  const reader: PaxReader = {
    id: input.id.slice(0, 80),
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
    return { ok: false, message: PAX_MSG.bluetooth, charged: false };
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
