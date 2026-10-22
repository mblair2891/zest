/**
 * Elo side-mounted magnetic stripe reader.
 * The reader is a keyboard wedge on the linked tablet. Tracks are parsed here.
 * Full track data and bank card numbers are not stored.
 */

export const MSR_ROLES = ["gift", "loyalty", "general"] as const;
export type MsrRole = (typeof MSR_ROLES)[number];

export const MSR_SWIPE_KINDS = [
  "gift_load",
  "gift_redeem",
  "gift_balance",
  "loyalty",
  "general",
  "unreadable",
] as const;
export type MsrSwipeKind = (typeof MSR_SWIPE_KINDS)[number];

export type MsrGiftAction = "load" | "redeem" | "balance";

/** A swipe stays "online" for a shift. The reader has no separate heartbeat. */
export const MSR_ONLINE_MS = 8 * 60 * 60 * 1000;

/** House gift track used by Test swipe. Not a bank card. */
export const TEST_MSR_TRACK = ";SUMMEX-MSR1-1001?";

export const MSR_ROLE_LABEL: Record<MsrRole, string> = {
  gift: "Gift card load / redeem",
  loyalty: "Loyalty",
  general: "General swipe",
};

export const MSR_KIND_LABEL: Record<MsrSwipeKind, string> = {
  gift_load: "Gift load",
  gift_redeem: "Gift redeem",
  gift_balance: "Balance",
  loyalty: "Loyalty",
  general: "Swipe",
  unreadable: "Unreadable",
};

export type MsrSwipeEvent = {
  id: string;
  at: number;
  deviceId: string;
  stationId: string;
  kind: MsrSwipeKind;
  /** House gift code when the stripe is a gift card. Never a bank number. */
  code?: string;
  summary: string;
};

export type MsrMount = "side" | "slot";
/** Slot reader on the station USB port. No network address and no Bluetooth. */
export type MsrConnection = "usb";

export type MsrConfig = {
  mount: MsrMount;
  role: MsrRole;
  /** Station that receives swipe events. */
  stationId: string | null;
  /** Present on a USB gift-card reader. Absent on the side-mounted wedge. */
  connection?: MsrConnection;
  lastSwipeAt?: number;
  lastSwipeKind?: MsrSwipeKind;
  lastSwipeSummary?: string;
  /** One undelivered swipe for the linked station. */
  pending?: MsrSwipeEvent | null;
};

type SwipeDevice = {
  id: string;
  type: string;
  label: string;
  status?: "online" | "offline" | "pending" | "inactive";
  lastSeenAt?: number;
  msr?: MsrConfig;
};

const STATION_TYPES = new Set(["tablet_pos", "host_stand", "kds", "kiosk"]);

export function isMsrStationType(type: string): boolean {
  return STATION_TYPES.has(type);
}

/** Side-mounted Elo wedge or a USB gift-card magstripe reader. */
export function isStripeReaderType(type: string): boolean {
  return type === "elo_msr" || type === "gift_msr";
}

export function isUsbGiftMsrType(type: string): boolean {
  return type === "gift_msr";
}

export function defaultMsrConfig(): MsrConfig {
  return { mount: "side", role: "gift", stationId: null, pending: null };
}

export function maskMsrAccount(account: string): string {
  const compact = String(account ?? "").replace(/[\s-]/g, "");
  const tail = compact.slice(-4);
  return tail ? `••••${tail}` : "••••";
}

/** 13–19 digits with no letters is a bank card, not a house gift code. */
export function looksLikeBankPan(account: string): boolean {
  const compact = String(account ?? "").replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(compact);
}

export function parseMsrWedge(raw: string): { account: string } | null {
  const s = String(raw ?? "").replace(/[\r\n]/g, "").trim();
  if (!s) return null;
  const track2 = s.match(/;([A-Za-z0-9-]{4,40})[=?]/);
  if (track2?.[1]) return { account: track2[1] };
  const track1 = s.match(/%B([A-Za-z0-9-]{4,40})\^/i);
  if (track1?.[1]) return { account: track1[1] };
  if (/^[A-Za-z0-9-]{4,40}$/.test(s)) return { account: s };
  return null;
}

function roleOf(raw: unknown): MsrRole {
  const role = String(raw ?? "");
  return (MSR_ROLES as readonly string[]).includes(role) ? (role as MsrRole) : "gift";
}

function kindOf(raw: unknown): MsrSwipeKind | undefined {
  const kind = String(raw ?? "");
  return (MSR_SWIPE_KINDS as readonly string[]).includes(kind) ? (kind as MsrSwipeKind) : undefined;
}

function parsePending(raw: unknown): MsrSwipeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = kindOf(o.kind);
  const id = String(o.id ?? "").trim().slice(0, 80);
  const stationId = String(o.stationId ?? "").trim().slice(0, 80);
  const deviceId = String(o.deviceId ?? "").trim().slice(0, 80);
  if (!kind || !id || !stationId || !deviceId) return null;
  const codeRaw = o.code ? String(o.code).replace(/[\s-]/g, "").slice(0, 40) : "";
  const code = codeRaw && !looksLikeBankPan(codeRaw) ? codeRaw : undefined;
  return {
    id,
    at: Number(o.at) > 0 ? Math.round(Number(o.at)) : Date.now(),
    deviceId,
    stationId,
    kind,
    code,
    summary: String(o.summary ?? MSR_KIND_LABEL[kind]).slice(0, 80),
  };
}

export function parseMsrConfig(raw: unknown): MsrConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const station = String(o.stationId ?? "").trim().slice(0, 80);
  const kind = kindOf(o.lastSwipeKind);
  const at = Number(o.lastSwipeAt) > 0 ? Math.round(Number(o.lastSwipeAt)) : undefined;
  const connection = o.connection === "usb" ? "usb" : undefined;
  return {
    mount: connection === "usb" ? "slot" : "side",
    role: roleOf(o.role),
    stationId: station || null,
    ...(connection ? { connection } : {}),
    lastSwipeAt: at,
    lastSwipeKind: kind,
    lastSwipeSummary: o.lastSwipeSummary ? String(o.lastSwipeSummary).slice(0, 80) : undefined,
    pending: parsePending(o.pending),
  };
}

function keptSwipe(existing?: MsrConfig): Pick<
  MsrConfig,
  "lastSwipeAt" | "lastSwipeKind" | "lastSwipeSummary" | "pending"
> {
  return {
    lastSwipeAt: existing?.lastSwipeAt,
    lastSwipeKind: existing?.lastSwipeKind,
    lastSwipeSummary: existing?.lastSwipeSummary,
    pending: existing?.pending ?? null,
  };
}

/** Read path. A USB gift reader is always USB and gift-only. A side reader stays a wedge. */
export function msrConfigForDeviceType(type: string, raw: unknown): MsrConfig | undefined {
  if (!isStripeReaderType(type)) return undefined;
  const parsed = parseMsrConfig(raw);
  if (type === "gift_msr") {
    return {
      mount: "slot",
      role: "gift",
      connection: "usb",
      stationId: parsed?.stationId ?? null,
      lastSwipeAt: parsed?.lastSwipeAt,
      lastSwipeKind: parsed?.lastSwipeKind,
      lastSwipeSummary: parsed?.lastSwipeSummary,
      pending: parsed?.pending ?? null,
    };
  }
  if (!parsed) return undefined;
  return {
    mount: "side",
    role: parsed.role,
    stationId: parsed.stationId,
    lastSwipeAt: parsed.lastSwipeAt,
    lastSwipeKind: parsed.lastSwipeKind,
    lastSwipeSummary: parsed.lastSwipeSummary,
    pending: parsed.pending,
  };
}

/** Form save keeps the last swipe. A non-reader drops the config. */
export function msrForSavedDevice(
  type: string,
  incoming: unknown,
  existing?: MsrConfig,
): MsrConfig | undefined {
  if (type === "gift_msr") {
    const parsed = parseMsrConfig(incoming);
    const stationId = parsed ? parsed.stationId : (existing?.stationId ?? null);
    return {
      mount: "slot",
      role: "gift",
      connection: "usb",
      stationId,
      ...keptSwipe(existing),
    };
  }
  if (type !== "elo_msr") return undefined;
  const parsed = parseMsrConfig(incoming);
  const role = parsed?.role ?? existing?.role ?? "gift";
  const stationId = parsed ? parsed.stationId : (existing?.stationId ?? null);
  return {
    mount: "side",
    role,
    stationId,
    ...keptSwipe(existing),
  };
}

/**
 * Reader a gift load or redeem on this station should use.
 * A USB gift reader assigned here wins for load and redeem.
 * Another station does not see it.
 */
export function selectStationStripeReader<T extends SwipeDevice>(
  devices: T[],
  stationId: string,
  giftAction?: MsrGiftAction,
): T | undefined {
  const sid = String(stationId ?? "").trim();
  if (!sid) return undefined;
  const usb = devices.find(
    (d) => d.type === "gift_msr" && d.msr?.connection === "usb" && d.msr.stationId === sid,
  );
  const elo = devices.find((d) => d.type === "elo_msr" && d.msr?.stationId === sid);
  if (usb && (giftAction === "load" || giftAction === "redeem" || !elo)) return usb;
  return elo;
}

export function eloMsrPresence(
  d: { status?: string; msr?: MsrConfig | null },
  now = Date.now(),
): "online" | "offline" | "pending" | "inactive" {
  if (d.status === "inactive") return "inactive";
  const at = Number(d.msr?.lastSwipeAt ?? 0);
  if (at > 0 && now - at < MSR_ONLINE_MS) return "online";
  if (d.msr?.stationId) return "offline";
  return "pending";
}

export function swipeKindFor(role: MsrRole, giftAction?: MsrGiftAction): MsrSwipeKind {
  if (role === "loyalty") return "loyalty";
  if (role === "general") return "general";
  if (giftAction === "load") return "gift_load";
  if (giftAction === "redeem") return "gift_redeem";
  return "gift_balance";
}

/** What the existing gift ledger should do with a delivered swipe. */
export function giftLedgerIntent(
  event: MsrSwipeEvent,
): { op: "lookup" | "issue" | "redeem"; code: string } | { op: "none"; reason: string } {
  if (!event.code) {
    if (event.kind === "unreadable") return { op: "none", reason: "Unreadable swipe" };
    if (event.kind === "loyalty" || event.kind === "general") {
      return { op: "none", reason: event.summary };
    }
    return { op: "none", reason: "Not a gift card" };
  }
  if (event.kind === "gift_load") return { op: "issue", code: event.code };
  if (event.kind === "gift_redeem") return { op: "redeem", code: event.code };
  if (event.kind === "gift_balance") return { op: "lookup", code: event.code };
  return { op: "none", reason: event.summary };
}

function eventId(now: number, explicit?: string): string {
  const given = String(explicit ?? "").trim().slice(0, 80);
  if (given) return given;
  return `msr_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function applyEloMsrSwipe<T extends SwipeDevice>(
  devices: T[],
  deviceId: string,
  raw: string,
  opts?: { now?: number; giftAction?: MsrGiftAction; eventId?: string; handled?: boolean },
): { devices: T[]; event: MsrSwipeEvent | null; error?: string } {
  const id = String(deviceId ?? "").trim();
  const index = devices.findIndex((d) => d.id === id);
  const device = index >= 0 ? devices[index] : undefined;
  if (!device || !isStripeReaderType(device.type)) {
    return { devices, event: null, error: "Elo reader not found" };
  }
  const usb = device.type === "gift_msr";
  const stationId = device.msr?.stationId ?? null;
  if (!stationId) {
    return {
      devices,
      event: null,
      error: usb ? "Assign this reader to a station first." : "Link this reader to a tablet first.",
    };
  }
  const station = devices.find((d) => d.id === stationId && isMsrStationType(d.type));
  if (!station) {
    return { devices, event: null, error: "That tablet is not on this location." };
  }
  const now = opts?.now ?? Date.now();
  const role = usb ? "gift" : (device.msr?.role ?? "gift");
  const parsed = parseMsrWedge(raw);
  let kind = swipeKindFor(role, opts?.giftAction);
  let code: string | undefined;
  if (!parsed) kind = "unreadable";
  else if (looksLikeBankPan(parsed.account)) {
    kind = "unreadable";
  } else if (role === "gift") {
    code = parsed.account.replace(/[\s-]/g, "").toUpperCase().slice(0, 40);
  }
  const masked = parsed ? maskMsrAccount(parsed.account) : "";
  const summary =
    kind === "unreadable"
      ? parsed && looksLikeBankPan(parsed.account)
        ? `Not a gift card · ${masked}`
        : "Unreadable swipe"
      : `${MSR_KIND_LABEL[kind]} · ${masked}`;
  const event: MsrSwipeEvent = {
    id: eventId(now, opts?.eventId),
    at: now,
    deviceId: device.id,
    stationId,
    kind,
    code,
    summary: summary.slice(0, 80),
  };
  const next: T = {
    ...device,
    status: "online",
    lastSeenAt: now,
    msr: {
      mount: usb ? "slot" : "side",
      ...(usb ? { connection: "usb" as const } : {}),
      role,
      stationId,
      lastSwipeAt: now,
      lastSwipeKind: kind,
      lastSwipeSummary: event.summary,
      pending: opts?.handled ? null : event,
    },
  };
  const copy = devices.slice();
  copy[index] = next;
  return { devices: copy, event };
}

/** The linked tablet takes one pending swipe. Later polls do not see it again. */
export function takeEloMsrSwipe<T extends SwipeDevice>(
  devices: T[],
  stationId: string,
): { devices: T[]; event: MsrSwipeEvent | null } {
  const station = String(stationId ?? "").trim();
  if (!station) return { devices, event: null };
  const usbIndex = devices.findIndex(
    (d) => d.type === "gift_msr" && d.msr?.pending && d.msr.pending.stationId === station,
  );
  const index =
    usbIndex >= 0
      ? usbIndex
      : devices.findIndex(
          (d) => d.type === "elo_msr" && d.msr?.pending && d.msr.pending.stationId === station,
        );
  if (index < 0) return { devices, event: null };
  const device = devices[index]!;
  const event = device.msr?.pending ?? null;
  const next: T = {
    ...device,
    msr: device.msr ? { ...device.msr, pending: null } : undefined,
  };
  const copy = devices.slice();
  copy[index] = next;
  return { devices: copy, event };
}

export type WedgeBuffer = { buf: string; at: number };

let preferredGiftAction: MsrGiftAction = "balance";

/** The open Gift job tells the next wedge swipe whether to load or redeem. */
export function setPreferredMsrGiftAction(action: MsrGiftAction): void {
  preferredGiftAction = action;
}

export function preferredMsrGiftAction(): MsrGiftAction {
  return preferredGiftAction;
}

export function pushWedgeKey(
  state: WedgeBuffer,
  key: string,
  now: number,
): { state: WedgeBuffer; done?: string } {
  if (key === "Enter") {
    const buf = state.buf;
    return { state: { buf: "", at: 0 }, done: buf.length >= 4 ? buf : undefined };
  }
  if (key.length !== 1) return { state };
  const stale = state.buf.length > 0 && now - state.at > 80;
  const armed = state.buf.startsWith(";") || state.buf.startsWith("%");
  if (stale && !armed) return { state: { buf: key, at: now } };
  return { state: { buf: state.buf + key, at: now } };
}
