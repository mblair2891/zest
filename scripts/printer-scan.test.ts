import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ipv4HostsForScan,
  mdnsQuery,
  mergeDiscoveredPrinters,
  parseDnsSdPrinters,
} from "../src/lib/print/printer-discover.ts";

test("scan stays on the station /24 and skips the station itself", () => {
  const hosts = ipv4HostsForScan("192.168.1.20", 24);
  assert.ok(hosts.includes("192.168.1.50"));
  assert.equal(hosts.includes("192.168.1.20"), false);
  assert.equal(hosts.includes("192.168.1.0"), false);
  assert.equal(hosts.includes("192.168.1.255"), false);
  assert.equal(hosts.some((h) => h.startsWith("10.")), false);
  assert.equal(hosts.length, 253);

  const wide = ipv4HostsForScan("10.1.2.3", 16);
  assert.ok(wide.includes("10.1.2.50"));
  assert.equal(wide.some((h) => h.startsWith("10.1.3.")), false);
  assert.ok(wide.length <= 254);

  assert.deepEqual(ipv4HostsForScan("8.8.8.8", 24), []);
});

test("9100 and an advertised name collapse to one printer", () => {
  const merged = mergeDiscoveredPrinters([
    { ip: "192.168.4.40", port: 9100, name: "", via: "9100" },
    { ip: "192.168.4.40", port: 631, name: "Expo", via: "advertised" },
    { ip: "8.8.8.8", port: 9100, name: "Public", via: "9100" },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.ip, "192.168.4.40");
  assert.equal(merged[0]?.name, "Expo");
  assert.equal(merged[0]?.port, 9100);
  assert.equal(merged[0]?.via, "advertised");
});

function nameBytes(name: string): number[] {
  const out: number[] = [];
  for (const label of name.split(".").filter(Boolean)) {
    const bytes = [...Buffer.from(label)];
    out.push(bytes.length, ...bytes);
  }
  out.push(0);
  return out;
}

function answer(owner: string, type: number, rdata: number[]): number[] {
  const body = [...nameBytes(owner), 0, type, 0, 1, 0, 0, 0, 120, (rdata.length >> 8) & 255, rdata.length & 255, ...rdata];
  return body;
}

test("an advertised printer keeps its name and address", () => {
  const ptr = answer("_pdl-datastream._tcp.local", 12, nameBytes("Expo._pdl-datastream._tcp.local"));
  const srv = answer("Expo._pdl-datastream._tcp.local", 33, [
    0, 0, 0, 0, 0x23, 0x8c, ...nameBytes("expo.local"),
  ]);
  const a = answer("expo.local", 1, [192, 168, 4, 40]);
  const header = [0, 1, 0x84, 0, 0, 0, 0, 3, 0, 0, 0, 0];
  const packet = Uint8Array.from([...header, ...ptr, ...srv, ...a]);
  const found = parseDnsSdPrinters(packet);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.ip, "192.168.4.40");
  assert.equal(found[0]?.name, "Expo");
  assert.equal(found[0]?.port, 9100);
  assert.equal(found[0]?.via, "advertised");
  const query = mdnsQuery("_pdl-datastream._tcp.local");
  assert.ok(query.length > 12);
  assert.equal(query[5], 1);
});

test("Devices scan fills the same printer save path", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /data-scan-printers/);
  assert.match(ui, /Scan for printers/);
  assert.match(ui, /data-printer-scan-ip/);
  assert.match(ui, /data-printer-food-groups/);
  assert.match(ui, /saveLocationDeviceFn/);
  assert.match(ui, /Floor sections/);
  assert.match(ui, /Menu groups/);
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/PrinterScanPlugin.java", "utf8");
  assert.match(plugin, /9100/);
  assert.match(plugin, /_pdl-datastream\._tcp/);
  assert.match(plugin, /_printer\._tcp/);
  const main = readFileSync("android/app/src/main/java/app/summex/pos/MainActivity.java", "utf8");
  assert.match(main, /registerPlugin\(PrinterScanPlugin\.class\)/);
  const agent = readFileSync("scripts/print-agent.mjs", "utf8");
  assert.match(agent, /\/scan/);
  const guide = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(guide, /2026\.10\.271/);
  assert.match(guide, /Order printers from the station/);
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /Scan for printers/);
  assert.match(devices, /Order printers this station sends to/);
});
