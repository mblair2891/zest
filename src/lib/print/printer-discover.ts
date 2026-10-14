import { isPrintLanHost } from "./lan-hosts.ts";

/** A printer seen on the staff Wi-Fi. Saving it is a separate step. */
export type DiscoveredPrinter = {
  ip: string;
  port: number;
  /** Name the printer advertised. Empty when it only answered on 9100. */
  name: string;
  via: "9100" | "advertised";
};

export type PrinterScanTicket = {
  id: string;
  requestedAt: number;
  status: "pending" | "done" | "error";
  printers: DiscoveredPrinter[];
  error: string;
  finishedAt: number;
};

/** DNS-SD types hospitality printers advertise on the staff link. */
export const PRINTER_DNS_SD_TYPES = [
  "_pdl-datastream._tcp.local",
  "_printer._tcp.local",
  "_ipp._tcp.local",
  "_ipps._tcp.local",
] as const;

const SCAN_MAX = 24;

/**
 * Hosts to probe on the station's own subnet.
 * A mask wider than /24 still scans only that station's /24.
 * Network and broadcast addresses are left out. The station itself is left out.
 */
export function ipv4HostsForScan(localIp: string, prefixLength: number): string[] {
  if (!isPrintLanHost(localIp)) return [];
  const parts = localIp.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return [];
  let prefix = Math.round(Number(prefixLength));
  if (!Number.isFinite(prefix)) prefix = 24;
  if (prefix < 24) prefix = 24;
  if (prefix > 30) prefix = 30;
  const ipNum = (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
  const hostBits = 32 - prefix;
  const size = 2 ** hostBits;
  if (size < 4 || size > 256) return [];
  const mask = (0xffffffff << hostBits) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network + size - 1) >>> 0;
  const out: string[] = [];
  for (let i = network + 1; i < broadcast; i++) {
    if (i >>> 0 === ipNum) continue;
    const host = `${(i >>> 24) & 255}.${(i >>> 16) & 255}.${(i >>> 8) & 255}.${i & 255}`;
    if (!isPrintLanHost(host)) continue;
    out.push(host);
  }
  return out;
}

export function mergeDiscoveredPrinters(rows: readonly DiscoveredPrinter[]): DiscoveredPrinter[] {
  const byIp = new Map<string, DiscoveredPrinter>();
  for (const row of rows) {
    const ip = String(row.ip ?? "").trim();
    if (!isPrintLanHost(ip)) continue;
    const portNum = Math.round(Number(row.port));
    const port = portNum > 0 && portNum < 65536 ? portNum : 9100;
    const name = String(row.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const via = row.via === "advertised" ? "advertised" : "9100";
    const prev = byIp.get(ip);
    if (!prev) {
      byIp.set(ip, { ip, port: via === "9100" ? 9100 : port, name, via });
      continue;
    }
    const saw9100 = prev.via === "9100" || via === "9100" || prev.port === 9100 || port === 9100;
    const nextName = prev.name || name;
    byIp.set(ip, {
      ip,
      port: saw9100 ? 9100 : port || prev.port,
      name: nextName,
      via: nextName && (prev.via === "advertised" || via === "advertised") ? "advertised" : "9100",
    });
    if (byIp.size >= SCAN_MAX) break;
  }
  return [...byIp.values()].sort((a, b) =>
    a.ip.localeCompare(b.ip, undefined, { numeric: true }),
  );
}

export function parseDiscoveredPrinters(raw: unknown): DiscoveredPrinter[] {
  if (!Array.isArray(raw)) return [];
  const rows: DiscoveredPrinter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    rows.push({
      ip: String(rec.ip ?? ""),
      port: Number(rec.port),
      name: String(rec.name ?? ""),
      via: rec.via === "advertised" ? "advertised" : "9100",
    });
  }
  return mergeDiscoveredPrinters(rows);
}

export function parsePrinterScanTicket(raw: unknown): PrinterScanTicket | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? "").trim().slice(0, 40);
  const status = rec.status === "done" || rec.status === "error" ? rec.status : "pending";
  const requestedAt = Number(rec.requestedAt);
  if (!id || !Number.isFinite(requestedAt)) return null;
  return {
    id,
    requestedAt,
    status,
    printers: parseDiscoveredPrinters(rec.printers),
    error: String(rec.error ?? "").slice(0, 180),
    finishedAt: Number(rec.finishedAt) || 0,
  };
}

function readName(buf: Uint8Array, offset: number): { name: string; offset: number } {
  const labels: string[] = [];
  let jumped = false;
  let end = offset;
  let pos = offset;
  for (let hops = 0; hops < 20 && pos < buf.length; hops++) {
    const len = buf[pos] ?? 0;
    if (len === 0) {
      pos += 1;
      if (!jumped) end = pos;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= buf.length) break;
      if (!jumped) end = pos + 2;
      jumped = true;
      pos = ((len & 0x3f) << 8) | (buf[pos + 1] ?? 0);
      continue;
    }
    if ((len & 0xc0) !== 0 || pos + 1 + len > buf.length) break;
    pos += 1;
    labels.push(new TextDecoder().decode(buf.subarray(pos, pos + len)));
    pos += len;
    if (!jumped) end = pos;
  }
  return { name: labels.join("."), offset: end };
}

function u16(buf: Uint8Array, offset: number): number {
  return ((buf[offset] ?? 0) << 8) | (buf[offset + 1] ?? 0);
}

/** PTR / SRV / A records from a DNS-SD response. Names come from the instance label. */
export function parseDnsSdPrinters(packet: Uint8Array): DiscoveredPrinter[] {
  if (packet.length < 12) return [];
  const questions = u16(packet, 4);
  const records = u16(packet, 6) + u16(packet, 8) + u16(packet, 10);
  let pos = 12;
  for (let i = 0; i < questions && pos < packet.length; i++) {
    pos = readName(packet, pos).offset;
    pos += 4;
  }
  const ptr = new Map<string, string>();
  const srv = new Map<string, { port: number; target: string }>();
  const addr = new Map<string, string>();
  for (let i = 0; i < records && pos + 10 < packet.length; i++) {
    const owner = readName(packet, pos);
    pos = owner.offset;
    if (pos + 10 > packet.length) break;
    const type = u16(packet, pos);
    const rdlen = u16(packet, pos + 8);
    const rdata = pos + 10;
    pos = rdata + rdlen;
    if (rdata + rdlen > packet.length) break;
    if (type === 12) {
      ptr.set(owner.name.toLowerCase(), readName(packet, rdata).name);
    } else if (type === 33 && rdlen >= 6) {
      const target = readName(packet, rdata + 6).name;
      srv.set(owner.name.toLowerCase(), { port: u16(packet, rdata + 4), target });
    } else if (type === 1 && rdlen >= 4) {
      const ip = `${packet[rdata]}.${packet[rdata + 1]}.${packet[rdata + 2]}.${packet[rdata + 3]}`;
      addr.set(owner.name.toLowerCase(), ip);
    }
  }
  const rows: DiscoveredPrinter[] = [];
  for (const instanceName of ptr.values()) {
    const key = instanceName.toLowerCase();
    const service = srv.get(key);
    const ip = addr.get((service?.target ?? "").toLowerCase()) ?? "";
    if (!isPrintLanHost(ip)) continue;
    const advertised = PRINTER_DNS_SD_TYPES.some((t) => key.endsWith(t));
    if (!advertised && !key.includes("_printer") && !key.includes("_ipp") && !key.includes("_pdl-datastream")) {
      continue;
    }
    const label = instanceName.split(".")[0]?.replace(/\\(\d{3})/g, (_, oct: string) =>
      String.fromCharCode(Number(oct)),
    ) ?? "";
    rows.push({
      ip,
      port: service?.port && service.port !== 9100 ? service.port : 9100,
      name: label.replace(/\s+/g, " ").slice(0, 80),
      via: "advertised",
    });
  }
  return mergeDiscoveredPrinters(rows);
}

/** One PTR question for a DNS-SD service type. */
export function mdnsQuery(serviceType: string, id = 0): Uint8Array {
  const labels = serviceType.split(".").filter(Boolean);
  const name: number[] = [];
  for (const label of labels) {
    const bytes = new TextEncoder().encode(label);
    name.push(bytes.length, ...bytes);
  }
  name.push(0);
  const packet = new Uint8Array(12 + name.length + 4);
  packet[0] = (id >> 8) & 255;
  packet[1] = id & 255;
  packet[5] = 1;
  packet.set(name, 12);
  const q = 12 + name.length;
  packet[q] = 0;
  packet[q + 1] = 12;
  packet[q + 2] = 0;
  packet[q + 3] = 1;
  return packet;
}
