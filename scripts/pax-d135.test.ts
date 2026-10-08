import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAX_MODEL,
  PAX_MSG,
  checkAlreadyCaptured,
  classifyPaxError,
  decidePaxPick,
  envBlock,
  paxDeviceRequest,
  paxScanRows,
  placePaxReader,
  readerAssignOptions,
  readerAssignmentBlock,
  rememberCapturedCheck,
  renamePaxReader,
  resetPaxSaleGuards,
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
    assert.equal(result.message, PAX_MSG.declined);
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
  assert.match(plugin, /EnvEnum\.SB/);
  assert.doesNotMatch(plugin, /EnvEnum\.PROD/);
  const dialog = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(dialog, /runAndroidPaxSale/);
  assert.match(dialog, /data-pax-serial/);
  assert.match(dialog, /startSquareCheckoutFn/);
  assert.doesNotMatch(dialog, /navigator\.bluetooth/);
  const devices = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(devices, /Add card reader/);
  assert.match(devices, /data-pax-add/);
  assert.match(devices, /data-pax-name=""/);
  assert.match(devices, /data-pax-assign=""/);
  assert.match(devices, /data-pax-reader-name=""/);
  assert.match(devices, /\{option\.name\}/);
  assert.doesNotMatch(devices, /placeholder="Finix \/ Quantum reader"/);
  const renameBody = server.slice(
    server.indexOf("export async function renamePaxReaderRecord"),
    server.indexOf("export async function paxReaderSession"),
  );
  assert.doesNotMatch(renameBody, /createPaxD135Device|finixFetch/);
  const guideDevices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  const guidePay = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guideDevices, /for example Bar 1/);
  assert.match(guideDevices, /dropdown of those names/);
  assert.match(guideDevices, /One reader is assigned to one tablet/);
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
