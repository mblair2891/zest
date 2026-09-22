/**
 * Location mark vs selling-entity mark.
 * The 80mm guest-check header is the building name in text.
 * Entity rasters are Epson-only, and only when the receipt version is readable.
 */

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const SCREEN_MAX_CHARS = 180_000;
export const RECEIPT_MIN_W = 192;
export const RECEIPT_MAX_W = 384;

export const LOGO_MIMES = ["image/png", "image/jpeg", "image/svg+xml"] as const;
export type LogoMime = (typeof LOGO_MIMES)[number];

export type ReceiptRaster = {
  width: number;
  height: number;
  /** Packed MSB-first rows. One bit per pixel, black = 1. */
  rowsBase64: string;
};

export type StoredLogo = {
  mime: LogoMime;
  /** Screen file: PNG or SVG data URL. Transparent-friendly. Header size. */
  screenUrl: string;
  /** Thermal 1-bit. Null when the raster is blank or failed. */
  receipt: ReceiptRaster | null;
};

export type BrandLogoMap = {
  location: StoredLogo | null;
  entities: Record<string, StoredLogo | null>;
};

export type LogoActor = "platform" | "location" | "entity" | "none";

export function normalizeLogoMime(raw: string): LogoMime | null {
  const s = raw.trim().toLowerCase();
  if (s === "image/jpg" || s === "image/jpeg") return "image/jpeg";
  if (s === "image/png") return "image/png";
  if (s === "image/svg+xml") return "image/svg+xml";
  return null;
}

export function acceptUpload(opts: { mime: string; byteLength: number }): { ok: true } | { ok: false; error: string } {
  if (!normalizeLogoMime(opts.mime)) return { ok: false, error: "Use a PNG, JPG, or SVG" };
  if (!Number.isFinite(opts.byteLength) || opts.byteLength <= 0) {
    return { ok: false, error: "That file is empty" };
  }
  if (opts.byteLength > LOGO_MAX_BYTES) return { ok: false, error: "Logo must be 2MB or smaller" };
  return { ok: true };
}

export function logoActor(opts: {
  isPlatformAdmin?: boolean;
  membershipRole?: string | null;
  operatorId?: string | null;
}): LogoActor {
  if (opts.isPlatformAdmin) return "platform";
  const op = String(opts.operatorId || "").trim();
  const role = String(opts.membershipRole || "").trim().toLowerCase();
  if ((role === "owner" || role === "manager") && (!op || op === "host")) return "location";
  if (op && op !== "host" && (role === "vendor" || role === "owner" || role === "manager")) return "entity";
  return "none";
}

/** Location admin: building slot. Entity admin: that entity. Platform: any slot. */
export function canWriteLogoSlot(
  actor: LogoActor,
  actorOperatorId: string | null | undefined,
  slotOperatorId: string,
): boolean {
  const slot = String(slotOperatorId || "").trim();
  if (actor === "platform") return true;
  if (actor === "location") return slot === "";
  if (actor === "entity") {
    const mine = String(actorOperatorId || "").trim();
    return Boolean(slot && mine && slot === mine);
  }
  return false;
}

export function emptyBrandLogoMap(): BrandLogoMap {
  return { location: null, entities: {} };
}

function asObj(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export function decodeBase64(b64: string): Uint8Array | null {
  try {
    const clean = b64.replace(/\s/g, "");
    if (!clean || clean.length > 80_000) return null;
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function receiptRasterReadable(raster: ReceiptRaster | null | undefined): boolean {
  if (!raster) return false;
  const width = Math.round(Number(raster.width));
  const height = Math.round(Number(raster.height));
  if (width < RECEIPT_MIN_W || width > RECEIPT_MAX_W) return false;
  if (height < 8 || height > 200) return false;
  const rowBytes = Math.ceil(width / 8);
  const bytes = decodeBase64(String(raster.rowsBase64 || ""));
  if (!bytes || bytes.length !== rowBytes * height) return false;
  let black = 0;
  const total = width * height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = bytes[y * rowBytes + (x >> 3)] ?? 0;
      if (byte & (0x80 >> (x & 7))) black += 1;
    }
  }
  const ratio = black / total;
  return ratio >= 0.01 && ratio <= 0.82;
}

export function parseStoredLogo(raw: unknown): StoredLogo | null {
  const o = asObj(raw);
  if (!o) return null;
  const mime = normalizeLogoMime(String(o.mime || ""));
  const screenUrl = String(o.screenUrl || "");
  if (!mime || !screenUrl.startsWith("data:image/") || screenUrl.length > SCREEN_MAX_CHARS) return null;
  const rec = asObj(o.receipt);
  let receipt: ReceiptRaster | null = null;
  if (rec) {
    const candidate: ReceiptRaster = {
      width: Math.round(Number(rec.width)),
      height: Math.round(Number(rec.height)),
      rowsBase64: String(rec.rowsBase64 || ""),
    };
    if (receiptRasterReadable(candidate)) receipt = candidate;
  }
  return { mime, screenUrl, receipt };
}

export function parseBrandLogoMap(raw: unknown): BrandLogoMap {
  const o = asObj(raw);
  const map = emptyBrandLogoMap();
  if (!o) return map;
  map.location = parseStoredLogo(o.location);
  const entities = asObj(o.entities);
  if (entities) {
    for (const [id, value] of Object.entries(entities)) {
      const key = id.trim().slice(0, 80);
      if (!key) continue;
      map.entities[key] = parseStoredLogo(value);
    }
  }
  return map;
}

/** Slip header is always the building name. Never a house graphic. */
export function guestCheckHeader(locationName: string): { text: string; graphic: null } {
  const text = locationName.trim() || "Location";
  return { text, graphic: null };
}

export function entitySlipMark(
  raster: ReceiptRaster | null | undefined,
  entityName: string,
): { kind: "raster"; raster: ReceiptRaster; name: string } | { kind: "name"; name: string } {
  const name = entityName.trim() || "Entity";
  if (receiptRasterReadable(raster)) return { kind: "raster", raster: raster!, name };
  return { kind: "name", name };
}

export function entityMarksForPrint(
  map: BrandLogoMap | null | undefined,
): Record<string, ReceiptRaster> {
  const out: Record<string, ReceiptRaster> = {};
  if (!map) return out;
  for (const [id, slot] of Object.entries(map.entities)) {
    if (slot?.receipt && receiptRasterReadable(slot.receipt)) out[id] = slot.receipt;
  }
  return out;
}

/** GS v 0 raster. Null when the mark should be skipped. */
export function escposRasterBytes(raster: ReceiptRaster | null | undefined): Uint8Array | null {
  if (!receiptRasterReadable(raster) || !raster) return null;
  const bytes = decodeBase64(raster.rowsBase64);
  if (!bytes) return null;
  const x = Math.ceil(raster.width / 8);
  const y = raster.height;
  const header = new Uint8Array(8);
  header[0] = 0x1d;
  header[1] = 0x76;
  header[2] = 0x30;
  header[3] = 0x00;
  header[4] = x & 0xff;
  header[5] = (x >> 8) & 0xff;
  header[6] = y & 0xff;
  header[7] = (y >> 8) & 0xff;
  const out = new Uint8Array(header.length + bytes.length);
  out.set(header, 0);
  out.set(bytes, header.length);
  return out;
}

export function screenUrlFromSetup(raw: unknown): string | null {
  const map = parseBrandLogoMap(asObj(raw)?.brandLogos ?? raw);
  const url = map.location?.screenUrl;
  return url && url.startsWith("data:image/") ? url : null;
}

/** Location email / quote HTML. Building mark when present, otherwise the name. */
export function locationMessageHtml(opts: {
  subject: string;
  text: string;
  locationName: string;
  screenUrl?: string | null;
}): string {
  const name = opts.locationName.trim() || "Location";
  const paras = opts.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br/>")}</p>`)
    .join("");
  const logo =
    opts.screenUrl && opts.screenUrl.startsWith("data:image/")
      ? `<img src="${escapeHtml(opts.screenUrl)}" alt="" width="180" style="display:block;margin:0 0 12px;max-width:180px;height:auto"/>`
      : "";
  return `<!doctype html><html><body style="font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;background:#f7f6f3;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:12px;padding:24px">
    ${logo}
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5c5c5c">${escapeHtml(name)}</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(opts.subject)}</h1>
    ${paras}
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Order and host tablets. ODS / kitchen / expo do not show the house file. */
export function tabletShowsHouseLogo(mode: string | null | undefined): boolean {
  return mode === "floor_pos" || mode === "host_stand" || mode === "cashier" || mode === "bar_pos";
}
