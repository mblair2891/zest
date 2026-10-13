import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAX_MODEL,
  PAX_MSG,
  checkAlreadyCaptured,
  classifyPaxError,
  checkEntityBannerLabel,
  checkEntityLabelForReader,
  checkSellingEntityIds,
  decidePaxPick,
  envBlock,
  payEntityStatusText,
  readerCheckEntityBanner,
  readerEntityLabel,
  paxDeviceRequest,
  paxScanPresentation,
  paxScanRows,
  paxSdkDeviceId,
  parsePaxReaders,
  placePaxReader,
  readerAssignOptions,
  readerAssignmentBlock,
  rememberCapturedCheck,
  removePaxReader,
  renamePaxReader,
  replacePaxReader,
  resetPaxSaleGuards,
  setPaxDeviceId,
  runAndroidPaxSale,
  type PaxReader,
} from "../src/lib/payments/pax-d135.ts";

const reader: PaxReader = {
  id: "pax_1",
  name: "Bar 1",
  serial: "ABC123",
  entityId: "ent_bbq",
  entityName: "BBQ",
  finixDeviceId: "DVsandbox1",
  finixMerchantId: "MUabc",
  model: PAX_MODEL,
  env: "sandbox",
};

function bridge(sales: { n: number }, result: { ok: boolean; code?: string; transferId?: string; last4?: string; message?: string }) {
  return {
    sale: async () => {
      sales.n += 1;
      return result;
    },
  };
}

test("registered D135 appears in the scan list", () => {
  const rows = paxScanRows(
    [
      { name: "PAX D135_ABC123", address: "00:11" },
      { name: "Headphones", address: "00:22" },
      { name: "D135", address: "00:33" },
    ],
    [reader],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.serial, "ABC123");
  assert.equal(rows[0]?.registered, true);
  assert.equal(rows[0]?.name, "PAX D135_ABC123");
});

test("a paired D135 is listed and a denied permission is not called Bluetooth off", () => {
  const paired = paxScanPresentation(
    {
      ok: true,
      devices: [
        { name: "PAX D135_ABC123", address: "00:11" },
        { name: "D135", address: "00:33" },
        { name: "Headphones", address: "00:22" },
      ],
    },
    [reader],
  );
  assert.equal(paired.rows.length, 1);
  assert.equal(paired.rows[0]?.serial, "ABC123");
  assert.equal(paired.phase, "idle");
  assert.notEqual(paired.message, PAX_MSG.bluetooth);

  const denied = paxScanPresentation(
    { ok: false, message: PAX_MSG.permissions, devices: [] },
    [reader],
  );
  assert.equal(denied.phase, "idle");
  assert.equal(denied.message, PAX_MSG.permissions);
  assert.equal(denied.rows.length, 0);

  const off = paxScanPresentation({ ok: false, message: PAX_MSG.bluetooth, devices: [] }, [reader]);
  assert.equal(off.phase, "bluetooth");
  assert.equal(off.message, PAX_MSG.bluetooth);

  const none = paxScanPresentation(
    { ok: false, devices: [{ name: "Headphones", address: "aa" }] },
    [reader],
  );
  assert.equal(none.rows.length, 0);
  assert.equal(none.phase, "bluetooth");
  assert.equal(none.message, PAX_MSG.bluetooth);
});

test("pay names the reader entity and the check entity", () => {
  const names = [
    { id: "ent_bar", name: "Copper Bar" },
    { id: "ent_kitchen", name: "Hearth Kitchen" },
  ];
  const readerName = readerEntityLabel(
    { entityId: "ent_bar", entityName: "Copper Bar" },
    names,
    "Summit Hall",
  );
  const match = checkEntityBannerLabel({
    lines: [{ entityId: "ent_bar", vendorId: "ent_bar" }],
    names,
    hostName: "Summit Hall",
  });
  const differ = checkEntityBannerLabel({
    lines: [{ vendorId: "ent_kitchen" }],
    names,
    hostName: "Summit Hall",
  });
  assert.equal(readerName, "Copper Bar");
  assert.equal(match.id, "ent_bar");
  assert.equal(match.label, "Copper Bar");
  assert.equal(differ.label, "Hearth Kitchen");
  const same = readerCheckEntityBanner(readerName, match.label);
  const other = readerCheckEntityBanner(readerName, differ.label);
  assert.equal(same, "Reader entity Copper Bar. Check entity Copper Bar.");
  assert.equal(other, "Reader entity Copper Bar. Check entity Hearth Kitchen.");
  assert.equal(other.includes("Copper Bar"), true);
  assert.equal(other.includes("Hearth Kitchen"), true);
  assert.equal(payEntityStatusText({ phase: "idle", message: other }, other), other);
  assert.equal(other.includes("Environment"), false);
  const finix = "Environment SB. Username present yes. Password present yes. Merchant MUabc. Device DV9.";
  const proceeded = payEntityStatusText({ phase: "connecting", message: finix }, same);
  assert.equal(proceeded.startsWith(same), true);
  assert.equal(proceeded.includes("Environment SB"), true);
  assert.equal(proceeded.includes("Copper Bar"), true);
  const host = checkEntityBannerLabel({ lines: [], names, hostName: "Summit Hall" });
  assert.equal(host.id, "host");
  assert.equal(host.label, "Summit Hall");
});

test("peer mixed check matches the selling entity on the items", () => {
  const names = [
    { id: "opr_summit_hearth", name: "Hearth Kitchen" },
    { id: "opr_summit_copper", name: "Copper Bar" },
  ];
  const lines = [
    { entityId: "opr_summit_hearth", vendorId: "opr_summit_hearth" },
    { entityId: "opr_summit_copper", vendorId: "opr_summit_copper" },
  ];
  const ids = checkSellingEntityIds(lines);
  assert.deepEqual(ids, ["opr_summit_hearth", "opr_summit_copper"]);
  const copper: PaxReader = {
    ...reader,
    entityId: "opr_summit_copper",
    entityName: "Copper Bar",
    serial: "1890297422",
  };
  const rows = paxScanRows([{ name: "PAX D135_1890297422", address: "aa" }], [copper]);
  const pick = decidePaxPick({
    row: rows[0]!,
    readers: [copper],
    sellingEntityId: null,
    sellingEntityIds: ids,
    locationLive: false,
  });
  assert.equal(pick.ok, true);
  const label = checkEntityLabelForReader({
    lines,
    readerEntityId: "opr_summit_copper",
    names,
    hostName: "Summit Hall",
  });
  assert.equal(label, "Copper Bar");
  assert.equal(label.includes("Summit Hall"), false);
  const banner = readerCheckEntityBanner("Copper Bar", label);
  assert.equal(banner, "Reader entity Copper Bar. Check entity Copper Bar.");
  const other = checkEntityLabelForReader({
    lines: [{ entityId: "opr_summit_hearth", vendorId: "opr_summit_hearth" }],
    readerEntityId: "opr_summit_copper",
    names,
    hostName: "Summit Hall",
  });
  assert.equal(readerCheckEntityBanner("Copper Bar", other), "Reader entity Copper Bar. Check entity Hearth Kitchen.");
  const refused = decidePaxPick({
    row: rows[0]!,
    readers: [copper],
    sellingEntityId: "opr_summit_hearth",
    sellingEntityIds: ["opr_summit_hearth"],
    locationLive: false,
  });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.message, PAX_MSG.wrongEntity);
});

test("unregistered serial is refused", () => {
  const rows = paxScanRows([{ name: "PAX D135_ZZZ", address: "aa" }], [reader]);
  assert.equal(rows[0]?.registered, false);
  const pick = decidePaxPick({
    row: rows[0]!,
    readers: [reader],
    sellingEntityId: "ent_bbq",
    locationLive: false,
  });
  assert.equal(pick.ok, false);
  if (!pick.ok) assert.equal(pick.message, PAX_MSG.notRegistered);
});

test("decline leaves the check open", async () => {
  resetPaxSaleGuards();
  const sales = { n: 0 };
  const result = await runAndroidPaxSale({
    checkId: "chk_1",
    amountCents: 1200,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bbq",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bridge: bridge(sales, { ok: false, code: "declined", message: "DECLINED" }),
  });
  assert.equal(sales.n, 1);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.charged, false);
    assert.equal(result.message, "DECLINED");
  }
  assert.equal(checkAlreadyCaptured({ checkId: "chk_1", status: "open", payments: [] }), false);
});

test("a second tap on a paid check does not create another transfer", async () => {
  resetPaxSaleGuards();
  const sales = { n: 0 };
  const paid = bridge(sales, { ok: true, transferId: "TRabc", last4: "4242" });
  const first = await runAndroidPaxSale({
    checkId: "chk_2",
    amountCents: 500,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bbq",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bridge: paid,
  });
  assert.equal(first.ok, true);
  const second = await runAndroidPaxSale({
    checkId: "chk_2",
    amountCents: 500,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bbq",
    alreadyCaptured: checkAlreadyCaptured({
      checkId: "chk_2",
      status: "open",
      payments: [{ method: "card", finixTransferId: "TRabc" }],
    }),
    settingUp: false,
    connected: true,
    bridge: paid,
  });
  assert.equal(sales.n, 1);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.message, PAX_MSG.alreadyPaid);

  resetPaxSaleGuards();
  rememberCapturedCheck("chk_3");
  const again = { n: 0 };
  const third = await runAndroidPaxSale({
    checkId: "chk_3",
    amountCents: 500,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bbq",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bridge: bridge(again, { ok: true, transferId: "TRother", last4: "1111" }),
  });
  assert.equal(again.n, 0);
  assert.equal(third.ok, false);
  if (!third.ok) assert.equal(third.message, PAX_MSG.alreadyPaid);
});

test("failsafes do not charge", async () => {
  resetPaxSaleGuards();
  const sales = { n: 0 };
  const paid = bridge(sales, { ok: true, transferId: "TRx", last4: "4242" });
  const base = {
    amountCents: 100,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bbq",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bridge: paid,
  };
  const offline = await runAndroidPaxSale({ ...base, checkId: "chk_bt", connected: false, bluetoothOff: true });
  assert.equal(offline.ok, false);
  if (!offline.ok) assert.equal(offline.message, PAX_MSG.bluetooth);
  const setup = await runAndroidPaxSale({ ...base, checkId: "chk_s", settingUp: true });
  assert.equal(setup.ok, false);
  if (!setup.ok) assert.equal(setup.message, PAX_MSG.stillSettingUp);
  const live = await runAndroidPaxSale({ ...base, checkId: "chk_l", locationLive: true });
  assert.equal(live.ok, false);
  if (!live.ok) assert.equal(live.message, PAX_MSG.sandboxOnLive);
  const reverse = await runAndroidPaxSale({
    ...base,
    checkId: "chk_r",
    reader: { ...reader, env: "live" },
  });
  assert.equal(reverse.ok, false);
  if (!reverse.ok) assert.equal(reverse.message, PAX_MSG.liveOnSandbox);
  const wrong = await runAndroidPaxSale({ ...base, checkId: "chk_w", sellingEntityId: "other" });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.message, PAX_MSG.wrongEntity);
  assert.equal(sales.n, 0);
  assert.equal(classifyPaxError("timeout").message, PAX_MSG.timeout);
  assert.equal(classifyPaxError("chip").message, PAX_MSG.chip);
  assert.equal(classifyPaxError("cancelled").message, PAX_MSG.cancelled);
  assert.equal(
    classifyPaxError("error", "Host response 51 Insufficient funds").message,
    "Host response 51 Insufficient funds",
  );
  assert.equal(classifyPaxError("declined", "DECLINED").leaveOpen, true);
  assert.equal(envBlock(true, "sandbox"), PAX_MSG.sandboxOnLive);
  assert.equal(envBlock(false, "live"), PAX_MSG.liveOnSandbox);
});

test("device body is PAX_D135 and a reader belongs to one entity", () => {
  const body = paxDeviceRequest("ABC 123", "BBQ");
  assert.equal(body.model, "PAX_D135");
  assert.equal(body.serial_number, "ABC123");
  assert.equal(body.integration_mode, "PAYMENT_APP");
  const placed = placePaxReader({
    readers: [],
    name: "Bar 1",
    serial: "ABC123",
    entityId: "ent_bbq",
    entityName: "BBQ",
    locationLive: false,
    deviceId: "DV1",
    merchantId: "MU1",
    id: "pax_1",
  });
  assert.equal(placed.ok, true);
  if (placed.ok) {
    const taken = placePaxReader({
      readers: placed.readers,
      name: "Patio",
      serial: "ABC123",
      entityId: "other",
      entityName: "Other",
      locationLive: false,
      deviceId: "DV2",
      merchantId: "MU2",
      id: "pax_2",
    });
    assert.equal(taken.ok, false);
    if (!taken.ok) assert.equal(taken.message, PAX_MSG.serialTaken);
  }
  const live = placePaxReader({
    readers: [],
    name: "Bar 1",
    serial: "ABC123",
    entityId: "ent_bbq",
    entityName: "BBQ",
    locationLive: true,
    deviceId: "DV1",
    merchantId: "MU1",
    id: "pax_1",
  });
  assert.equal(live.ok, false);
  if (!live.ok) assert.equal(live.message, PAX_MSG.liveRegister);
});

test("the PAX path does not use Web Bluetooth or Stripe", () => {
  const files = [
    "src/lib/payments/pax-d135.ts",
    "src/lib/payments/pax-d135-native.ts",
    "src/lib/payments/pax-d135.server.ts",
    "android/app/src/main/java/app/summex/pos/PaxD135Plugin.java",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /navigator\.bluetooth|requestDevice|api\.stripe\.com|StripeTerminal/);
  }
  const server = readFileSync("src/lib/payments/pax-d135.server.ts", "utf8");
  assert.doesNotMatch(server, /\/transfers|authorizeCardPresent|captureCardPresent/);
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/PaxD135Plugin.java", "utf8");
  assert.match(plugin, /PAX D135_/);
  assert.match(plugin, /MPOSFinix\.Companion\.invoke\(getContext\(\), data\)/);
  assert.match(plugin, /scanForDevices\(serialOf\(name\)\)/);
  assert.match(plugin, /takingDevice\.invoke\(finix, device, connectionCallback\)/);
  assert.match(plugin, /published\.invoke\(finix, bluetoothLabel\(device\), bluetoothAddress\(device\), connectionCallback\)/);
  assert.doesNotMatch(plugin, /finix\.connect\(deviceName, deviceAddress/);
  assert.match(plugin, /EnvEnum\.SB/);
  assert.match(plugin, /"Connected"/);
  assert.doesNotMatch(plugin, /DVt7ZpgavajgoPUHCX967Ser/);
  assert.doesNotMatch(plugin, /DVbAt1JESzPRXVN7MAoN4hHF/);
  assert.doesNotMatch(plugin, /MUdpkz77QV2XnH45t7fpURa1/);
  assert.doesNotMatch(plugin, /EnvEnum\.PROD/);
  assert.match(plugin, /requestPermissionForAliases/);
  assert.match(plugin, /ACCESS_FINE_LOCATION/);
  assert.match(plugin, /BLUETOOTH_CONNECT/);
  assert.match(plugin, /getBondedDevices/);
  assert.match(plugin, /Allow Nearby devices and Location/);
  assert.match(plugin, /FIRST_RESPONSE_MS = 15_000L/);
  assert.match(plugin, /CONNECT_TIMEOUT_MS = 4L \* 60L \* 1000L/);
  const sale = plugin.slice(plugin.indexOf("void saleOnWorker"), plugin.indexOf("void doScan"));
  assert.match(sale, /Log\.i\("PaxD135", "SDK sale " \+ shown\)/);
  assert.match(sale, /Log\.i\("PaxD135", "SDK sale processing " \+ shown\)/);
  assert.match(sale, /tags\.put\("check", checkId\)/);
  assert.match(sale, /The check id is metadata\. It is not a Finix buyer identity\./);
  const args = sale.slice(sale.indexOf("},\n                null,"), sale.indexOf("PromptForSignature.Never.INSTANCE"));
  assert.match(args, /tags/);
  assert.doesNotMatch(args, /checkId/);
  assert.match(sale, /resolveSaleFailure\(call, errorMessage\)/);
  assert.match(sale, /saleFailureText\(result\)/);
  const failureText = plugin.slice(plugin.indexOf("String saleFailureText"), plugin.indexOf("void appendSalePart"));
  assert.doesNotMatch(failureText, /getMaskedAccountNumber|getCryptogram/);
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(manifest, /BLUETOOTH_SCAN"/);
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(manifest, /neverForLocation/);
  const dialog = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(dialog, /Scan for reader/);
  assert.match(dialog, /paxScanPresentation/);
  assert.match(dialog, /runAndroidPaxSale/);
  assert.match(dialog, /data-pax-serial/);
  assert.match(dialog, /startSquareCheckoutFn/);
  assert.doesNotMatch(dialog, /navigator\.bluetooth/);
  const devices = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(devices, /Add card reader/);
  assert.match(devices, /data-pax-add/);
  assert.match(devices, /data-pax-name=""/);
  assert.match(devices, /Finix device ID/);
  assert.match(devices, /data-pax-open=""/);
  assert.match(devices, /data-pax-remove=""/);
  assert.match(devices, /data-pax-replace=""/);
  assert.match(devices, /data-pax-replace-form=""/);
  assert.match(devices, /data-pax-replace-serial=""/);
  assert.match(devices, /data-pax-replace-device-id=""/);
  assert.match(devices, /data-pax-replace-save=""/);
  assert.match(devices, /data-station-reader/);
  assert.match(devices, /data-pax-device-id=""/);
  assert.match(devices, /data-pax-save-device=""/);
  assert.match(devices, /data-pax-new-device-id=""/);
  assert.match(devices, /data-pax-assign=""/);
  assert.match(devices, /data-pax-reader-name=""/);
  assert.match(devices, /data-pax-reader-entity=/);
  assert.match(devices, /\{option\.name\}/);
  assert.doesNotMatch(devices, /placeholder="Finix \/ Quantum reader"/);
  const renameBody = server.slice(
    server.indexOf("export async function renamePaxReaderRecord"),
    server.indexOf("export async function setPaxDeviceIdRecord"),
  );
  assert.doesNotMatch(renameBody, /createPaxD135Device|finixFetch/);
  const deviceBody = server.slice(
    server.indexOf("export async function setPaxDeviceIdRecord"),
    server.indexOf("export async function paxReaderSession"),
  );
  assert.doesNotMatch(deviceBody, /createPaxD135Device|finixFetch/);
  const removeBody = server.slice(
    server.indexOf("export async function removePaxReaderRecord"),
    server.indexOf("export async function replacePaxReaderRecord"),
  );
  assert.doesNotMatch(removeBody, /createPaxD135Device|finixFetch/);
  const replaceBody = server.slice(
    server.indexOf("export async function replacePaxReaderRecord"),
    server.indexOf("export async function paxReaderSession"),
  );
  assert.doesNotMatch(replaceBody, /createPaxD135Device|finixFetch/);
  const sessionBody = server.slice(
    server.indexOf("export async function paxReaderSession"),
    server.indexOf("export type FinixConnectAuthResult"),
  );
  assert.match(sessionBody, /readServerEnv\("FINIX_USERNAME"\)/);
  assert.match(sessionBody, /readServerEnv\("FINIX_PASSWORD"\)/);
  assert.match(sessionBody, /venueFinixMerchantId/);
  assert.match(sessionBody, /account\.mid/);
  assert.match(sessionBody, /authorizeStationFloor/);
  assert.match(sessionBody, /paxReaderSessionForStation/);
  assert.doesNotMatch(sessionBody, /readServerEnv\("FINIX_MID"\)/);
  const authBlock = dialog.slice(
    dialog.indexOf("if (!paxReaderOnThisStation())"),
    dialog.indexOf("const connected = await runPaxConnect"),
  );
  assert.match(authBlock, /paxReaderSessionData/);
  assert.doesNotMatch(authBlock, /return;/);
  const merchantFn = server.slice(
    server.indexOf("async function venueFinixMerchantId"),
    server.indexOf("export async function paxReaderSession"),
  );
  assert.match(merchantFn, /finix_mid/);
  assert.doesNotMatch(sessionBody, /reader\.finixMerchantId/);
  assert.doesNotMatch(sessionBody, /finixSandboxLogin\(/);
  const registerBody = server.slice(
    server.indexOf("export async function registerPaxReader"),
    server.indexOf("export async function renamePaxReaderRecord"),
  );
  assert.match(registerBody, /normalizeFinixDeviceId\(input\.deviceId\)/);
  assert.match(registerBody, /deviceId,/);
  assert.doesNotMatch(registerBody, /deviceId: created\.id/);
  const guideDevices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  const guidePay = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guideDevices, /can be renamed, removed, or replaced/);
  assert.match(guideDevices, /clears any station assignment/);
  assert.match(guideDevices, /keeps the station assignment/);
  assert.match(guideDevices, /usable for payment until it is removed/);
  assert.match(guidePay, /can be renamed, removed, or replaced/);
  assert.match(guideDevices, /Finix device ID/);
  assert.match(guideDevices, /stays listed until the id is added/);
  assert.match(guidePay, /Finix device ID/);
  assert.match(guidePay, /stays listed until the id is added/);
  assert.match(guideDevices, /Scan for reader/);
  assert.match(guideDevices, /Nearby devices and Location/);
  assert.match(guideDevices, /for example Bar 1/);
  assert.match(guideDevices, /FINIX_WEBHOOK_SECRET does not block the add/);
  assert.match(guideDevices, /appears in the list immediately/);
  assert.match(guideDevices, /already paired over Bluetooth/);
  assert.match(guideDevices, /not registered only when the serial is empty/);
  assert.match(guidePay, /FINIX_WEBHOOK_SECRET does not block the add/);
  assert.match(guidePay, /marked for the chosen entity/);
  assert.match(guidePay, /webhook secret before a charge can settle/);
  assert.match(guideDevices, /dropdown of those names/);
  assert.match(guideDevices, /One reader is assigned to one tablet/);
  assert.match(guidePay, /Scan for reader/);
  assert.match(guidePay, /Nearby devices and Location/);
  assert.match(guidePay, /for example Bar 1/);
  assert.match(guidePay, /dropdown of those names/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /finixTransferId/);
  assert.match(store, /PAX_MSG\.alreadyPaid/);
});

test("a reader named Bar 1 shows in the assign list and keeps its serial", () => {
  const blank = placePaxReader({
    readers: [],
    name: "  ",
    serial: "SN9",
    entityId: "ent_bbq",
    entityName: "BBQ",
    locationLive: false,
    deviceId: "DV9",
    merchantId: "MU9",
    id: "pax_bar",
  });
  assert.equal(blank.ok, false);
  const placed = placePaxReader({
    readers: [],
    name: "Bar 1",
    serial: "SN9",
    entityId: "ent_bbq",
    entityName: "BBQ",
    locationLive: false,
    deviceId: "DV9",
    merchantId: "MU9",
    id: "pax_bar",
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.reader.name, "Bar 1");
  assert.equal(placed.reader.serial, "SN9");
  assert.equal(placed.reader.finixDeviceId, "DV9");
  const options = readerAssignOptions({
    readers: placed.readers,
    devices: [],
    tabletId: "tab_host",
  });
  assert.deepEqual(options, [{ serial: "SN9", name: "Bar 1" }]);
  const taken = readerAssignmentBlock({
    readers: placed.readers,
    devices: [
      { id: "tab_order", label: "Order 1", cardReaderId: "SN9" },
      { id: "tab_host", label: "Host", cardReaderId: null },
    ],
    tabletId: "tab_host",
    serial: "SN9",
  });
  assert.equal(taken, "Bar 1 is already assigned to Order 1.");
  const hidden = readerAssignOptions({
    readers: placed.readers,
    devices: [{ id: "tab_order", label: "Order 1", cardReaderId: "SN9" }],
    tabletId: "tab_host",
  });
  assert.equal(hidden.length, 0);
  const kept = readerAssignOptions({
    readers: placed.readers,
    devices: [{ id: "tab_order", label: "Order 1", cardReaderId: "SN9" }],
    tabletId: "tab_order",
  });
  assert.equal(kept[0]?.name, "Bar 1");
  const renamed = renamePaxReader({ readers: placed.readers, id: "pax_bar", name: "Patio" });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.reader.name, "Patio");
  assert.equal(renamed.reader.serial, "SN9");
  assert.equal(renamed.reader.finixDeviceId, "DV9");
});

test("a serial-only reader stays listed until the Finix device ID is saved", () => {
  const parsed = parsePaxReaders([
    {
      id: "pax_old",
      name: "Bar 1",
      serial: "SN1",
      entityId: "ent_bbq",
      entityName: "BBQ",
      finixDeviceId: "",
      finixMerchantId: "MU1",
    },
    {
      id: "pax_bad",
      name: "Patio",
      serial: "SN2",
      entityId: "ent_bbq",
      finixDeviceId: "not-a-device",
      finixMerchantId: "MU1",
    },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.finixDeviceId, "");
  assert.equal(parsed[1]?.finixDeviceId, "");
  const rows = paxScanRows([{ name: "PAX D135_SN1", address: "aa" }], parsed);
  assert.equal(rows[0]?.registered, true);
  assert.equal(paxSdkDeviceId(parsed[0]?.finixDeviceId), "");
  const missing = setPaxDeviceId({ readers: parsed, id: "pax_old", deviceId: "  " });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.message, PAX_MSG.deviceIdRequired);
  const saved = setPaxDeviceId({ readers: parsed, id: "pax_old", deviceId: " DV9summit1890 " });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.reader.finixDeviceId, "DV9summit1890");
  assert.equal(saved.reader.serial, "SN1");
  assert.equal(saved.reader.name, "Bar 1");
  assert.equal(paxSdkDeviceId(saved.reader.finixDeviceId), "DV9summit1890");
  const renamed = renamePaxReader({ readers: saved.readers, id: "pax_old", name: "Well" });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.reader.finixDeviceId, "DV9summit1890");
  assert.equal(renamed.reader.serial, "SN1");
});

test("remove deletes the reader and clears only that station assignment", () => {
  const second: PaxReader = { ...reader, id: "pax_2", name: "Patio", serial: "ZZ9" };
  const devices = [
    { id: "tab_order", cardReaderId: "ABC123" },
    { id: "tab_host", cardReaderId: "ZZ9" },
  ];
  const missing = removePaxReader({ readers: [reader, second], devices, id: "missing" });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.message, PAX_MSG.notRegistered);
  const removed = removePaxReader({ readers: [reader, second], devices, id: "pax_1" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.readers.some((row) => row.id === "pax_1"), false);
  assert.equal(removed.readers[0]?.serial, "ZZ9");
  assert.equal(removed.devices[0]?.cardReaderId, null);
  assert.equal(removed.devices[1]?.cardReaderId, "ZZ9");
  assert.equal(devices[0]?.cardReaderId, "ABC123");
});

test("replace keeps the station assignment on the new serial", () => {
  const second: PaxReader = { ...reader, id: "pax_2", name: "Patio", serial: "ZZ9" };
  const devices = [
    { id: "tab_order", cardReaderId: "ABC123" },
    { id: "tab_host", cardReaderId: "ZZ9" },
  ];
  const blankSerial = replacePaxReader({
    readers: [reader, second],
    devices,
    id: "pax_1",
    serial: "   ",
    deviceId: "DV9new",
  });
  assert.equal(blankSerial.ok, false);
  if (blankSerial.ok) return;
  assert.equal(blankSerial.message, PAX_MSG.serialRequired);
  const blankId = replacePaxReader({
    readers: [reader, second],
    devices,
    id: "pax_1",
    serial: "NEW1",
    deviceId: " ",
  });
  assert.equal(blankId.ok, false);
  if (blankId.ok) return;
  assert.equal(blankId.message, PAX_MSG.deviceIdRequired);
  const taken = replacePaxReader({
    readers: [reader, second],
    devices,
    id: "pax_1",
    serial: "ZZ9",
    deviceId: "DV9new",
  });
  assert.equal(taken.ok, false);
  if (taken.ok) return;
  assert.equal(taken.message, PAX_MSG.serialOnReader);
  assert.equal(devices[0]?.cardReaderId, "ABC123");
  const replaced = replacePaxReader({
    readers: [reader, second],
    devices,
    id: "pax_1",
    serial: " NEW1 ",
    deviceId: " DV9new ",
  });
  assert.equal(replaced.ok, true);
  if (!replaced.ok) return;
  assert.equal(replaced.reader.id, "pax_1");
  assert.equal(replaced.reader.name, "Bar 1");
  assert.equal(replaced.reader.entityId, "ent_bbq");
  assert.equal(replaced.reader.serial, "NEW1");
  assert.equal(replaced.reader.finixDeviceId, "DV9new");
  assert.equal(replaced.readers.some((row) => row.id === "pax_1"), true);
  assert.equal(replaced.devices[0]?.cardReaderId, "NEW1");
  assert.equal(replaced.devices[1]?.cardReaderId, "ZZ9");
  const same = replacePaxReader({
    readers: replaced.readers,
    devices: replaced.devices,
    id: "pax_1",
    serial: "NEW1",
    deviceId: "DV9new",
  });
  assert.equal(same.ok, true);
  if (!same.ok) return;
  assert.equal(same.reader.id, "pax_1");
  assert.equal(same.devices[0]?.cardReaderId, "NEW1");
});

test("sandbox card reader add does not require the webhook secret", async () => {
  const { createPaxD135Device, finixSandboxLogin, finixSandboxLoginError, authorizeCardPresent } =
    await import("../src/lib/payments/finix.ts");
  const { missingFinixKeyMessage, readFinixCreds } = await import("../src/lib/payments/finix-keys.ts");
  const keys = [
    "FINIX_USERNAME",
    "FINIX_PASSWORD",
    "FINIX_APPLICATION_ID",
    "FINIX_WEBHOOK_SECRET",
    "FINIX_LIVE_USERNAME",
    "FINIX_LIVE_PASSWORD",
    "FINIX_LIVE_APPLICATION_ID",
    "FINIX_LIVE_WEBHOOK_SECRET",
  ];
  const prev = new Map(keys.map((key) => [key, process.env[key]]));
  const restore = () => {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  const setApi = () => {
    for (const key of keys) delete process.env[key];
    process.env.FINIX_USERNAME = "sandbox-user";
    process.env.FINIX_PASSWORD = "sandbox-pass";
    process.env.FINIX_APPLICATION_ID = "AP_sandbox";
  };
  try {
    setApi();
    const missing = readFinixCreds("sandbox");
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missingFinixKeyMessage(missing.missing), "FINIX_WEBHOOK_SECRET is not set");
    }
    const login = finixSandboxLogin();
    assert.equal(login?.userId, "sandbox-user");
    assert.equal(finixSandboxLoginError(), "");

    let calls = 0;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    };
    try {
      const local = await createPaxD135Device({
        merchantId: "MU_sandbox_bar",
        serial: "SN240",
        name: "Bar 1",
      });
      assert.equal(local.ok, true);
      if (!local.ok) return;
      assert.match(local.id, /^DV/);
      assert.equal(calls, 0);
      const placed = placePaxReader({
        readers: [],
        name: "Bar 1",
        serial: "SN240",
        entityId: "ent_bar",
        entityName: "Bar",
        locationLive: false,
        deviceId: local.id,
        merchantId: "MU_sandbox_bar",
        id: "pax_qa",
      });
      assert.equal(placed.ok, true);
      if (!placed.ok) return;
      const rows = paxScanRows([{ name: "PAX D135_SN240", address: "aa" }], placed.readers);
      assert.equal(rows[0]?.registered, true);
      const pick = decidePaxPick({
        row: rows[0]!,
        readers: placed.readers,
        sellingEntityId: "ent_bar",
        locationLive: false,
      });
      assert.equal(pick.ok, true);
    } finally {
      globalThis.fetch = prevFetch;
    }

    const urls: string[] = [];
    globalThis.fetch = async (input, init) => {
      urls.push(String(input));
      const raw = init && typeof init === "object" && "body" in init ? init.body : undefined;
      (globalThis as { __paxBody?: string }).__paxBody = typeof raw === "string" ? raw : "";
      return new Response(JSON.stringify({ id: "DV_real_240" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const created = await createPaxD135Device({
        merchantId: "MU_bar",
        serial: "1890297422",
        name: "Bar 1",
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.equal(created.id, "DV_real_240");
      assert.equal(urls.length, 1);
      assert.match(urls[0] ?? "", /finix\.sandbox-payments-api\.com\/merchants\/MU_bar\/devices/);
      const sent = JSON.parse(String((globalThis as { __paxBody?: string }).__paxBody ?? "{}")) as {
        application?: string;
        serial_number?: string;
      };
      assert.equal(sent.application, undefined);
      assert.equal(sent.serial_number, "1890297422");
      const placed = placePaxReader({
        readers: [],
        name: "Bar 1",
        serial: "1890297422",
        entityId: "ent_bar",
        entityName: "Copper Bar",
        locationLive: false,
        deviceId: created.id,
        merchantId: "MU_bar",
        id: "pax_1890",
      });
      assert.equal(placed.ok, true);
      if (!placed.ok) return;
      assert.equal(placed.reader.entityName, "Copper Bar");
      const fromPrefix = paxScanRows(
        [{ name: "PAX D135_1890297422", address: "aa" }],
        placed.readers,
      );
      const fromShort = paxScanRows(
        [{ name: "D135_1890297422", address: "bb" }],
        placed.readers,
      );
      assert.equal(fromPrefix.length, 1);
      assert.equal(fromShort.length, 1);
      assert.equal(fromPrefix[0]?.registered, true);
      assert.equal(fromShort[0]?.registered, true);
      assert.equal(fromPrefix[0]?.entityId, "ent_bar");
      assert.equal(fromShort[0]?.serial, "1890297422");
      const pick = decidePaxPick({
        row: fromPrefix[0]!,
        readers: placed.readers,
        sellingEntityId: "ent_bar",
        locationLive: false,
      });
      assert.equal(pick.ok, true);
      const emptySerial = placePaxReader({
        readers: [],
        name: "Bar 1",
        serial: "   ",
        entityId: "ent_bar",
        entityName: "Copper Bar",
        locationLive: false,
        deviceId: "DV1",
        merchantId: "MU_bar",
        id: "pax_empty",
      });
      assert.equal(emptySerial.ok, false);
      if (emptySerial.ok) return;
      assert.equal(emptySerial.message, "The reader was not registered.");
      const missingEntity = placePaxReader({
        readers: [],
        name: "Bar 1",
        serial: "1890297422",
        entityId: "  ",
        entityName: "",
        locationLive: false,
        deviceId: "DV1",
        merchantId: "MU_bar",
        id: "pax_no_ent",
      });
      assert.equal(missingEntity.ok, false);
      if (missingEntity.ok) return;
      assert.equal(missingEntity.message, "The reader was not registered.");
    } finally {
      globalThis.fetch = prevFetch;
    }

    urls.length = 0;
    globalThis.fetch = async () => {
      urls.push("refused");
      return new Response(JSON.stringify({ _embedded: { errors: [{ message: "no" }] } }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const refused = await createPaxD135Device({
        merchantId: "MU_bar",
        serial: "1890297422",
        name: "Bar 1",
      });
      assert.equal(refused.ok, true);
      if (!refused.ok) return;
      assert.match(refused.id, /^DV/);
      assert.equal(urls.length, 2);
      assert.doesNotMatch(refused.id, /not registered/i);
    } finally {
      globalThis.fetch = prevFetch;
    }

    delete process.env.FINIX_USERNAME;
    globalThis.fetch = async () => {
      throw new Error("fetch");
    };
    try {
      const blocked = await createPaxD135Device({
        merchantId: "MU_bar",
        serial: "SN240",
        name: "Bar 1",
      });
      assert.equal(blocked.ok, false);
      if (blocked.ok) return;
      assert.equal(blocked.error, "FINIX_USERNAME is not set");
      assert.doesNotMatch(blocked.error, /FINIX_WEBHOOK_SECRET/);
    } finally {
      globalThis.fetch = prevFetch;
    }

    setApi();
    process.env.FINIX_LIVE_USERNAME = "live-user";
    process.env.FINIX_LIVE_PASSWORD = "live-pass";
    process.env.FINIX_LIVE_APPLICATION_ID = "AP_live";
    let liveCalls = 0;
    globalThis.fetch = async () => {
      liveCalls += 1;
      return new Response("no", { status: 500 });
    };
    try {
      const live = await authorizeCardPresent({
        mode: "live",
        locationLive: true,
        merchantId: "MU_live",
        amountCents: 1000,
        checkId: "chk_live",
      });
      assert.equal(live.ok, false);
      assert.equal(live.error, "FINIX_LIVE_WEBHOOK_SECRET is not set");
      assert.equal(liveCalls, 0);
    } finally {
      globalThis.fetch = prevFetch;
    }
  } finally {
    restore();
  }
});
