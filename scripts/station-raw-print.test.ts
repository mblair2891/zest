import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPrintLanHost } from "../src/lib/print/lan-hosts.ts";

test("print plugin only allows house LAN IPs", () => {
  assert.equal(isPrintLanHost("192.168.0.105"), true);
  assert.equal(isPrintLanHost("10.0.0.8"), true);
  assert.equal(isPrintLanHost("8.8.8.8"), false);
  assert.equal(isPrintLanHost("app.summex.app"), false);
});

test("Capacitor RawPrint sendBytes is registered; dispatch never window.print", () => {
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/RawPrintPlugin.java", "utf8");
  assert.match(plugin, /@CapacitorPlugin\(name = "RawPrint"\)/);
  assert.match(plugin, /sendBytes/);
  assert.match(plugin, /192/);
  assert.match(plugin, /9100/);
  const main = readFileSync("android/app/src/main/java/app/summex/pos/MainActivity.java", "utf8");
  assert.match(main, /registerPlugin\(RawPrintPlugin\.class\)/);
  const js = readFileSync("src/lib/print/capacitor-raw-print.ts", "utf8");
  assert.match(js, /registerPlugin<RawPrintPlugin>\("RawPrint"\)/);
  assert.match(js, /sendBytes/);
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(dispatch, /sendNativeBytes/);
  assert.match(dispatch, /Use a paired station or print agent/);
  assert.doesNotMatch(dispatch, /window\.print\(/);
  assert.doesNotMatch(dispatch, /printHtml/);
  assert.match(dispatch, /Kitchen|prep|window/);
  const fromStore = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.doesNotMatch(fromStore, /forceBrowser/);
  const nsc = readFileSync("android/app/src/main/res/xml/network_security_config.xml", "utf8");
  assert.match(nsc, /cleartextTrafficPermitted="false"/);
  assert.match(nsc, /RawPrint/);
});
