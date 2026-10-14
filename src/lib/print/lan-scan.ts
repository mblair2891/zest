import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";
import { isPrintLanHost } from "./lan-hosts.ts";
import {
  PRINTER_DNS_SD_TYPES,
  ipv4HostsForScan,
  mdnsQuery,
  mergeDiscoveredPrinters,
  parseDnsSdPrinters,
  type DiscoveredPrinter,
} from "./printer-discover.ts";

const MDNS_ADDR = "224.0.0.251";
const MDNS_PORT = 5353;

function cloudHost(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function probePort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}

async function probeAll(hosts: string[], timeoutMs: number): Promise<DiscoveredPrinter[]> {
  const found: DiscoveredPrinter[] = [];
  let cursor = 0;
  const workers = Math.min(64, hosts.length);
  async function worker() {
    while (cursor < hosts.length) {
      const host = hosts[cursor];
      cursor += 1;
      if (!host) continue;
      if (await probePort(host, 9100, timeoutMs)) {
        found.push({ ip: host, port: 9100, name: "", via: "9100" });
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return found;
}

function browseMdns(timeoutMs: number): Promise<DiscoveredPrinter[]> {
  return new Promise((resolve) => {
    const packets: Uint8Array[] = [];
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      try {
        sock.close();
      } catch {
        /* already closed */
      }
      const rows: DiscoveredPrinter[] = [];
      for (const packet of packets) rows.push(...parseDnsSdPrinters(packet));
      resolve(mergeDiscoveredPrinters(rows));
    };
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const timer = setTimeout(done, timeoutMs);
    sock.on("error", () => {
      clearTimeout(timer);
      done();
    });
    sock.on("message", (msg) => {
      packets.push(Uint8Array.from(msg));
    });
    sock.bind(0, () => {
      try {
        sock.addMembership(MDNS_ADDR);
      } catch {
        /* port 9100 scan still runs when multicast is closed */
      }
      try {
        sock.setMulticastTTL(255);
      } catch {
        /* */
      }
      PRINTER_DNS_SD_TYPES.forEach((type, i) => {
        const query = mdnsQuery(type, i + 1);
        sock.send(query, MDNS_PORT, MDNS_ADDR);
      });
    });
  });
}

function localSubnets(): { address: string; hosts: string[] }[] {
  const nets = os.networkInterfaces();
  const out: { address: string; hosts: string[] }[] = [];
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs ?? []) {
      const family = String(addr.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (addr.internal || !isPrintLanHost(addr.address)) continue;
      const prefix = Number(String(addr.cidr ?? "").split("/")[1]);
      out.push({ address: addr.address, hosts: ipv4HostsForScan(addr.address, prefix) });
    }
  }
  return out;
}

/**
 * Printers on this computer's staff subnet.
 * A cloud host does not scan — it cannot see the venue Wi-Fi.
 */
export async function scanLocalPrinters(): Promise<{ printers: DiscoveredPrinter[]; error?: string }> {
  if (cloudHost()) {
    return { printers: [], error: "Scan from a station on the staff Wi-Fi." };
  }
  const subnets = localSubnets();
  const hosts = [...new Set(subnets.flatMap((s) => s.hosts))].slice(0, 512);
  if (!hosts.length) {
    return { printers: [], error: "This computer is not on the staff Wi-Fi." };
  }
  const [open, advertised] = await Promise.all([
    probeAll(hosts, 450),
    browseMdns(1400),
  ]);
  return { printers: mergeDiscoveredPrinters([...open, ...advertised]) };
}
