import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAX_MODEL,
  PAX_MSG,
  finixStationEnv,
  paxSdkConnectActivityResult,
  paxSdkDeviceId,
  connectedReaderForPayment,
  paxLinkStatusText,
  finixConnectBanner,
  finixConnectDiagnostic,
  finixUnauthorizedBanner,
  paxConnectFailureReason,
  paxConnectShouldRetry,
  paxScanRowLabel,
  paxTabletCallback,
  presentFinixConnectFailure,
  presentPaxHold,
  reuseHeldPaxLink,
  runPaxConnect,
  decideStationReaderConnect,
  paxScanPresentation,
  paymentUsesConnectedReader,
  type PaxReader,
  type PaxScanRow,
} from "../src/lib/payments/pax-d135.ts";
import {
  applyLoginProbe,
  assignedStationSystems,
  lanProbePath,
  loginConnectionPrinters,
  scheduleConnectionProbes,
  seedLoginProbe,
  stationHealthNotices,
} from "../src/lib/pos/station-device-health.ts";
import { parsePrinterProbeTargets } from "../src/lib/print/printer-probe-ticket.ts";

const reader: PaxReader = {
  id: "pax_1890",
  name: "Reader 1890",
  serial: "1890297422",
  entityId: "opr_summit_copper",
  entityName: "Copper Bar",
  finixDeviceId: "DVsandbox1890",
  finixMerchantId: "MUsandbox",
  model: PAX_MODEL,
  env: "sandbox",
};

const other: PaxReader = {
  ...reader,
  id: "pax_bar",
  name: "Bar 1",
  serial: "SN240QA",
  finixDeviceId: "DVsandbox240",
};

function row(serial: string, registered = true): PaxScanRow {
  return {
    name: `PAX D135_${serial}`,
    address: "00:11",
    serial,
    registered,
    entityId: registered ? reader.entityId : null,
  };
}

test("a registered reader that is not connected shows a notice", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      {
        id: "dev_summit_order",
        label: "Order tablet",
        type: "tablet",
        cardReaderId: "1890297422",
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8", port: 9100 },
      },
    ],
    readers: [reader],
  });
  const notices = stationHealthNotices({ systems, connectedSerial: null });
  assert.deepEqual(
    notices.map((n) => n.text),
    ["Reader 1890 is not connected."],
  );
});

test("a connected reader and a pending printer stay quiet", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      {
        id: "dev_summit_order",
        label: "Order tablet",
        type: "tablet",
        cardReaderId: "1890297422",
        receiptPrinterId: "dev_summit_prn_receipt",
      },
      {
        id: "dev_summit_prn_receipt",
        label: "Receipt",
        type: "receipt_printer",
        print: { target: "192.168.1.20:9100", boundStationIds: [] },
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8", boundStationIds: ["dev_summit_order"] },
      },
    ],
    readers: [reader],
  });
  const quiet = stationHealthNotices({
    systems,
    connectedSerial: "1890297422",
    probe: { dev_summit_prn_receipt: "pending", dev_summit_prn_kitchen: "up" },
  });
  assert.equal(quiet.length, 0);
  const down = stationHealthNotices({
    systems,
    connectedSerial: "1890297422",
    probe: { dev_summit_prn_receipt: "down", dev_summit_prn_kitchen: "down" },
  });
  assert.deepEqual(
    down.map((n) => n.text),
    ["Receipt is not responding.", "Kitchen is not responding."],
  );
});

test("a printer with no host is not responding before a probe, and an unbound printer is ignored", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      { id: "dev_summit_order", label: "Order tablet", type: "tablet" },
      {
        id: "dev_summit_prn_receipt",
        label: "Receipt",
        type: "receipt_printer",
        print: { boundStationIds: ["dev_summit_order"] },
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8" },
      },
    ],
    readers: [reader],
  });
  assert.deepEqual(
    systems.map((s) => s.kind),
    ["receipt_printer"],
  );
  assert.deepEqual(
    stationHealthNotices({ systems, connectedSerial: null }).map((n) => n.text),
    ["Receipt is not responding."],
  );
});

test("scan rows do not say Bluetooth is off, and an empty scan does", () => {
  const listed = paxScanPresentation(
    { ok: true, devices: [{ name: "PAX D135_1890297422", address: "AA" }] },
    [reader],
  );
  assert.equal(listed.rows[0]?.serial, "1890297422");
  assert.notEqual(listed.message, PAX_MSG.bluetooth);
  assert.equal(listed.phase, "idle");

  const missingPlugin = paxScanPresentation(
    { ok: false, message: PAX_MSG.notConnected, devices: [] },
    [reader],
  );
  assert.notEqual(missingPlugin.message, PAX_MSG.bluetooth);
  assert.equal(missingPlugin.message, PAX_MSG.notConnected);

  const denied = paxScanPresentation(
    { ok: false, message: PAX_MSG.permissions, devices: [] },
    [reader],
  );
  assert.equal(denied.message, PAX_MSG.permissions);
  assert.equal(denied.message.toLowerCase().includes("bluetooth"), false);
  assert.equal(PAX_MSG.permissions.toLowerCase().includes("bluetooth"), false);

  const off = paxScanPresentation({ ok: false, message: PAX_MSG.bluetooth, devices: [] }, [reader]);
  assert.equal(off.phase, "bluetooth");
  assert.equal(off.message, "Bluetooth is off, or no reader is in range.");

  const noneNearby = paxScanPresentation({ ok: true, devices: [] }, [reader]);
  assert.equal(noneNearby.message, "Bluetooth is off, or no reader is in range.");
});

test("the station connects the assigned serial and Pay uses that reader", () => {
  const match = decideStationReaderConnect({
    row: row("1890297422"),
    readers: [reader, other],
    locationLive: false,
    assignedSerial: "1890297422",
  });
  assert.equal(match.ok, true);
  if (match.ok) {
    assert.equal(match.reader.serial, "1890297422");
    assert.equal(match.claimSlot, false);
  }

  const emptySlot = decideStationReaderConnect({
    row: row("1890297422"),
    readers: [reader],
    locationLive: false,
    assignedSerial: null,
  });
  assert.equal(emptySlot.ok, true);
  if (emptySlot.ok) assert.equal(emptySlot.claimSlot, true);

  const wrong = decideStationReaderConnect({
    row: row("SN240QA"),
    readers: [reader, other],
    locationLive: false,
    assignedSerial: "1890297422",
  });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.message, "This station is assigned to Reader 1890.");

  const unknown = decideStationReaderConnect({
    row: row("NOPE", false),
    readers: [reader],
    locationLive: false,
    assignedSerial: null,
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.message, PAX_MSG.notRegistered);

  const link = { phase: "connected" as const, reader };
  assert.equal(paymentUsesConnectedReader(link), true);
  assert.equal(connectedReaderForPayment(link)?.serial, "1890297422");
  assert.equal(paymentUsesConnectedReader({ phase: "idle", reader: null }), false);
  assert.equal(paymentUsesConnectedReader({ phase: "connected", reader: null }), false);
});

test("the printer probe connects without a payload and the reader timeout stays", () => {
  const raw = readFileSync(
    new URL("../android/app/src/main/java/app/summex/pos/RawPrintPlugin.java", import.meta.url),
    "utf8",
  );
  assert.match(raw, /void probe\(/);
  assert.equal(raw.includes("out.write"), true);
  const probe = raw.slice(raw.indexOf("void probe"));
  assert.equal(probe.includes("out.write"), false);
  assert.equal(probe.includes("OutputStream"), false);

  const pax = readFileSync(
    new URL("../android/app/src/main/java/app/summex/pos/PaxD135Plugin.java", import.meta.url),
    "utf8",
  );
  assert.match(pax, /MPOSFinix\.Companion\.invoke\(getContext\(\), data\)/);
  assert.match(pax, /new MerchantData\(/);
  assert.match(pax, /scanForDevices\(serialOf\(name\)\)/);
  assert.match(pax, /connect\(next, device, connectionCallback\)/);
  assert.match(pax, /name\.contains\("D135"\)/);
  assert.match(pax, /takingDevice\.invoke\(finix, device, connectionCallback\)/);
  assert.match(pax, /published\.invoke\(finix, bluetoothLabel\(device\), bluetoothAddress\(device\), connectionCallback\)/);
  assert.doesNotMatch(pax, /finix\.connect\(deviceName, deviceAddress/);
  assert.match(pax, /EnvEnum\.SB/);
  assert.doesNotMatch(pax, /EnvEnum\.PROD/);
  assert.match(pax, /MSG_CONNECTED = "Connected"/);
  assert.match(pax, /callbackError\(errorMessage\)/);
  assert.doesNotMatch(pax, /DVt7ZpgavajgoPUHCX967Ser/);
  assert.doesNotMatch(pax, /SANDBOX_DEVICE_ID/);
  assert.match(pax, /keyDownloadProgress/);
  const gradle = readFileSync(
    new URL("../android/app/build.gradle", import.meta.url),
    "utf8",
  );
  assert.match(gradle, /implementation\("com\.finix:pax-mpos-sdk-android:3\.7\.0"\)/);
  assert.match(pax, /FIRST_RESPONSE_MS = 15_000L/);
  assert.match(pax, /CONNECT_TIMEOUT_MS = 4L \* 60L \* 1000L/);
  assert.match(pax, /Allow Nearby devices and Location, then scan again\./);
  assert.match(pax, /Bluetooth is off, or no reader is in range\./);
  assert.match(pax, /static final String MSG_CONNECTING = "Connecting"/);
  assert.match(pax, /static final String MSG_READY = "Reader ready"/);
  assert.match(pax, /Environment SB/);
  assert.match(pax, /Log\.i\("PaxD135", diagnostic\)/);
  assert.match(pax, /Log\.i\("PaxD135", merchantTrace\)/);
  assert.match(pax, /new MerchantData\(\s*passedMerchant,\s*passedMid,\s*passedDevice,\s*Currency\.USD,\s*EnvEnum\.SB,\s*passedUser,\s*passedPassword\s*\)/);
  const merchantTrace = pax.slice(pax.indexOf("String merchantDataTrace"), pax.indexOf("void putSdkTrace"));
  assert.match(merchantTrace, /username prefix/);
  assert.equal(merchantTrace.includes("password"), false);
  assert.match(pax, /substring\(0, 6\)/);
  assert.match(pax, /substring\(0, 8\)/);
  assert.match(pax, /missing merchantId/);
  assert.match(pax, /missing userId/);
  assert.match(pax, /missing mid/);
  assert.match(pax, /mid present /);
  const previewFn = pax.slice(pax.indexOf("String merchantDataPreview"), pax.indexOf("private BluetoothDevice scanForDevices"));
  assert.match(previewFn, /mid present /);
  assert.doesNotMatch(previewFn, /\+ mid\b/);
  assert.match(pax, /put\("sdkMessage"/);
  assert.match(pax, /put\("sdkCode"/);
  assert.match(pax, /put\("usernamePrefix"/);
  assert.match(pax, /Environment SB\. Username present /);
  assert.match(pax, /Password present /);
  assert.match(pax, /\. Merchant /);
  const diag = pax.slice(pax.indexOf("String finixConnectDiagnostic"), pax.indexOf("String keyDownloadProgress"));
  assert.equal(diag.includes("password +"), false);
  assert.equal(diag.includes("userId +"), false);
  assert.equal(diag.includes("return password"), false);
  assert.equal(diag.includes("return userId"), false);
  assert.match(diag, /Username /);
  assert.match(diag, /Password /);
  assert.match(pax, /static final String MSG_CONNECT_TIMEOUT = "The connection timed out."/);
  assert.match(pax, /static final String MSG_CONNECT_REJECTED = "The reader rejected the connection."/);
  assert.match(pax, /static final String MSG_NO_RESPONSE = "The reader did not respond."/);
  const reason = pax.slice(pax.indexOf("String callbackError"), pax.indexOf("private void restoreHeld"));
  assert.match(reason, /errorMessage/);
  assert.equal(reason.includes("MSG_NOT_CONNECTED"), false);
  assert.equal(reason.includes("password"), false);
  assert.equal(pax.includes(".disconnect("), false);
  assert.match(pax, /stopScanBeforeConnect/);
  assert.match(pax, /onWorker\(\(\) -> connectOnWorker/);
  const connectMethod = pax.slice(pax.indexOf("public void connect(PluginCall call)"), pax.indexOf("public void sale"));
  assert.ok(connectMethod.indexOf("missingMerchantField") < connectMethod.indexOf("reuseHeld"));
  const worker = pax.slice(pax.indexOf("void connectOnWorker"), pax.indexOf("void saleOnWorker"));
  assert.ok(worker.indexOf('resolveMessage(call, "missing mid")') < worker.indexOf("scanForDevices"));
});

test("selecting a D135 holds the link and Reader ready stays", async () => {
  assert.equal(paxSdkDeviceId("DV_sandbox_local"), "DV_sandbox_local");
  assert.equal(paxSdkDeviceId("DVsandbox1890"), "DVsandbox1890");
  assert.equal(paxSdkDeviceId(""), "");
  assert.equal(paxSdkDeviceId("DV9"), "DV9");
  assert.equal(finixStationEnv("sandbox"), "SB");
  assert.equal(finixStationEnv(""), "SB");
  assert.equal(finixStationEnv("live"), "LIVE");
  assert.equal(paxSdkConnectActivityResult({ ok: true, message: "Reader ready" }), "Connected");
  assert.equal(
    paxSdkConnectActivityResult({ ok: false, message: "Failed to connect: device not found" }),
    "Failed to connect: device not found",
  );
  assert.equal(
    paxSdkConnectActivityResult({
      ok: false,
      sdkMessage: "Failed to connect: device not found",
      sdkCode: "104",
    }),
    "Failed to connect: device not found code 104",
  );
  assert.equal(presentPaxHold({ event: "select", wasReady: false }).message, "Connecting");
  assert.equal(presentPaxHold({ event: "processing", wasReady: false }).message, "Setting up reader");
  assert.equal(
    presentPaxHold({
      event: "processing",
      wasReady: false,
      message: "Downloading EMV files to device",
    }).message,
    "Downloading EMV files to device",
  );
  assert.equal(
    paxLinkStatusText({ phase: "setting_up", message: "Downloading EMV files to device" }),
    "Downloading EMV files to device",
  );
  const ready = presentPaxHold({ event: "accepted", wasReady: false });
  assert.equal(ready.message, "Reader ready");
  assert.equal(ready.hold, true);
  assert.equal(paxLinkStatusText({ phase: "connected", message: "Reader ready" }), "Reader ready");
  assert.equal(paxLinkStatusText({ phase: "connecting", message: "Connecting" }), "Connecting");
  assert.equal(
    paxLinkStatusText({
      phase: "connecting",
      message: "Environment SB. Username present yes. Password present yes. Merchant MUabc. Device DV9.",
    }),
    "Environment SB. Username present yes. Password present yes. Merchant MUabc. Device DV9.",
  );

  const early = presentPaxHold({
    event: "failed",
    wasReady: false,
    message: "Disconnecting — try again shortly.",
  });
  assert.equal(early.message, "Disconnecting — try again shortly.");
  assert.notEqual(early.message, PAX_MSG.connectNoResponse);
  assert.notEqual(early.message, PAX_MSG.notConnected);
  assert.equal(early.hold, false);
  const finix = presentPaxHold({
    event: "failed",
    wasReady: false,
    message: "Failed to connect: auth",
  });
  assert.equal(finix.message, "Failed to connect: auth");
  assert.notEqual(finix.message, PAX_MSG.connectNoResponse);
  assert.equal(paxConnectFailureReason("timed out waiting"), "timed out waiting");
  assert.equal(paxConnectFailureReason("Failed to connect: auth"), "Failed to connect: auth");
  assert.equal(paxConnectFailureReason("Disconnecting — try again shortly."), "Disconnecting — try again shortly.");
  assert.equal(paxConnectFailureReason(""), PAX_MSG.connectTimeout);
  assert.equal(paxConnectFailureReason(PAX_MSG.connectNoResponse), PAX_MSG.connectNoResponse);
  assert.equal(paxConnectFailureReason(PAX_MSG.permissions), PAX_MSG.permissions);
  assert.equal(paxConnectFailureReason(PAX_MSG.notConnected), PAX_MSG.notConnected);
  assert.equal(
    paxTabletCallback({
      message: "Connection timed out: socket closed",
      sdkMessage: "Connection timed out: socket closed",
      sdkCode: "104",
    }),
    "Connection timed out: socket closed code 104",
  );
  assert.equal(paxTabletCallback({ message: "", sdkMessage: "", sdkCode: "missing" }), PAX_MSG.connectTimeout);
  assert.equal(paxScanRowLabel(row(other.serial), [other]), other.name);
  assert.equal(paxConnectShouldRetry("Failed to connect: auth"), false);
  assert.equal(paxConnectShouldRetry("Disconnecting — try again shortly."), true);
  assert.equal(paxConnectShouldRetry(PAX_MSG.connectTimeout), true);
  assert.equal(paxConnectShouldRetry(PAX_MSG.permissions), false);
  assert.equal(paxConnectShouldRetry("Unauthorized"), false);

  const secret = "not-the-banner-password";
  const username = finixUnauthorizedBanner({
    message: "Unauthorized",
    userId: "sandbox-user",
    password: secret,
    merchantId: "MUabc",
    deviceId: "DVreader",
    env: "SB",
  });
  assert.equal(username, "Unauthorized. Finix sandbox username.");
  assert.equal(username?.includes(secret), false);
  assert.equal(
    finixUnauthorizedBanner({
      message: "Unauthorized",
      userId: "USreader",
      password: "",
      merchantId: "MUabc",
      deviceId: "DVreader",
      env: "SB",
    }),
    "Unauthorized. Finix sandbox password.",
  );
  assert.equal(
    finixUnauthorizedBanner({
      message: "401 Unauthorized",
      userId: "USreader",
      password: secret,
      merchantId: "local",
      deviceId: "DVreader",
      env: "SB",
    }),
    "401 Unauthorized. merchant ID.",
  );
  assert.equal(
    finixUnauthorizedBanner({
      message: "Unauthorized",
      userId: "USreader",
      password: secret,
      merchantId: "MUabc",
      deviceId: "DVreader",
      env: "PROD",
    }),
    "Unauthorized. Environment PROD.",
  );
  assert.equal(
    presentFinixConnectFailure({
      message: "Unauthorized. Finix sandbox username.",
      userId: "sandbox-user",
      password: secret,
      merchantId: "MUabc",
      deviceId: "DVreader",
      env: "SB",
    }),
    "Unauthorized. Finix sandbox username.",
  );
  assert.equal(
    presentFinixConnectFailure({
      message: "Reader ready",
      userId: "USreader",
      password: secret,
      merchantId: "MUabc",
      deviceId: "DVreader",
      env: "SB",
    }),
    "Reader ready",
  );
  const loginName = "sandbox-user";
  const diagnostic = finixConnectDiagnostic({
    userId: loginName,
    password: secret,
    merchantId: "MUabc",
    deviceId: "DVreader",
    env: "SB",
  });
  assert.equal(
    diagnostic,
    "Environment SB. Username present yes. Password present yes. Merchant MUabc. Device DVreader.",
  );
  assert.equal(diagnostic.includes(secret), false);
  assert.equal(diagnostic.includes(loginName), false);
  assert.equal(
    finixConnectDiagnostic({
      userId: "",
      password: "",
      merchantId: "",
      deviceId: "",
      env: "",
    }),
    "Environment SB. Username present no. Password present no. Merchant missing. Device missing.",
  );
  assert.equal(
    finixConnectDiagnostic({
      userId: "USreader",
      password: secret,
      merchantId: "MUabc",
      deviceId: "DV9",
      env: "LIVE",
    }),
    "Environment LIVE. Username present yes. Password present yes. Merchant MUabc. Device DV9.",
  );
  const unauthorized = finixConnectBanner(diagnostic, username ?? "");
  assert.equal(unauthorized.startsWith(diagnostic), true);
  assert.equal(unauthorized.includes("Unauthorized"), true);
  assert.equal(unauthorized.includes(secret), false);
  assert.equal(unauthorized.includes(loginName), false);
  assert.ok(unauthorized.indexOf("Environment SB") < unauthorized.indexOf("Username present"));
  assert.ok(unauthorized.indexOf("Username present") < unauthorized.indexOf("Password present"));
  assert.ok(unauthorized.indexOf("Password present") < unauthorized.indexOf("Merchant MUabc"));
  assert.ok(unauthorized.indexOf("Merchant MUabc") < unauthorized.indexOf("Device "));
  assert.ok(unauthorized.indexOf("Device ") < unauthorized.indexOf("Unauthorized"));
  const readyBanner = finixConnectBanner(diagnostic, "Reader ready");
  assert.equal(readyBanner.endsWith("Reader ready"), true);
  assert.equal(paxLinkStatusText({ phase: "connected", message: readyBanner }), readyBanner);
  assert.equal(paxConnectFailureReason(unauthorized), unauthorized);
  const guideDevices = readFileSync(new URL("../src/lib/guide/content/devices.ts", import.meta.url), "utf8");
  const guidePay = readFileSync(new URL("../src/lib/guide/content/payments.ts", import.meta.url), "utf8");
  assert.match(guideDevices, /which credential or environment was used/);
  assert.match(guidePay, /which credential or environment was used/);
  assert.match(guideDevices, /Station activity shows Connected or the reader error/);
  assert.doesNotMatch(guideDevices, /DVt7ZpgavajgoPUHCX967Ser/);
  assert.match(guideDevices, /A successful connect shows Reader ready/);
  assert.match(guideDevices, /whether the username is present/);
  assert.match(guideDevices, /includes the Finix error body/);
  assert.match(guidePay, /whether the password is present/);
  assert.match(guidePay, /The username and the password are not shown/);
  assert.match(guideDevices, /before the Finix call completes/);
  assert.match(guideDevices, /stays visible until the next connect attempt/);
  assert.match(guidePay, /full Finix error body/);
  assert.match(guideDevices, /selling entity assigned to the selected reader/);
  assert.match(guideDevices, /If they differ the banner names both entities/);
  assert.match(guidePay, /proceeds to the Finix connect step/);

  let calls = 0;
  const retried = await runPaxConnect(async () => {
    calls += 1;
    if (calls === 1) return { ok: false, message: "timeout" };
    return { ok: true, batteryPercent: 80 };
  });
  assert.equal(calls, 2);
  assert.equal(retried.ok, true);

  let denied = 0;
  const permission = await runPaxConnect(async () => {
    denied += 1;
    return { ok: false, message: PAX_MSG.permissions };
  });
  assert.equal(denied, 1);
  assert.equal(permission.message, PAX_MSG.permissions);

  let failed = 0;
  const reported = await runPaxConnect(async () => {
    failed += 1;
    return { ok: false, message: failed === 1 ? "" : "Failed to connect: auth" };
  });
  assert.equal(failed, 2);
  assert.equal(reported.ok, false);
  assert.equal(reported.message, "Failed to connect: auth");
  assert.notEqual(reported.message, PAX_MSG.connectNoResponse);
  assert.notEqual(reported.message, PAX_MSG.notConnected);

  let named = 0;
  const once = await runPaxConnect(async () => {
    named += 1;
    return { ok: false, message: "Failed to connect: auth" };
  });
  assert.equal(named, 1);
  assert.equal(once.ok, false);
  assert.equal(once.message, "Failed to connect: auth");

  const dropped = presentPaxHold({ event: "dropped", wasReady: true });
  assert.equal(dropped.message, "The reader disconnected. The check is not paid. Try again.");
  assert.equal(dropped.hold, false);

  assert.equal(
    reuseHeldPaxLink({
      heldReady: true,
      heldConnected: true,
      heldSerial: "1890297422",
      serial: "1890297422",
    }),
    true,
  );
  assert.equal(
    reuseHeldPaxLink({
      heldReady: false,
      heldConnected: true,
      heldSerial: "1890297422",
      serial: "1890297422",
    }),
    false,
  );
});

test("PIN login pings station and section printers and keeps the printer name", () => {
  const devices = [
    {
      id: "dev_order",
      label: "Order tablet",
      type: "tablet",
      receiptPrinterId: "prn_receipt",
      orderPrinterIds: ["prn_kitchen"],
    },
    {
      id: "prn_receipt",
      label: "Receipt",
      type: "receipt_printer",
      print: { ip: "192.168.0.112", port: 9100 },
    },
    {
      id: "prn_kitchen",
      label: "Kitchen",
      type: "order_printer",
      print: { ip: "192.168.0.105", port: 9100 },
    },
    {
      id: "prn_patio",
      label: "Patio",
      type: "receipt_printer",
      print: { ip: "192.168.0.140", port: 9100, sectionIds: ["sec_patio"] },
    },
    {
      id: "prn_unassigned",
      label: "Spare",
      type: "order_printer",
      print: { ip: "10.0.0.9", port: 9100 },
    },
  ];
  const printers = loginConnectionPrinters({
    stationId: "dev_order",
    devices,
    sectionIds: ["sec_patio"],
  });
  assert.deepEqual(
    printers.map((row) => row.label),
    ["Receipt", "Kitchen", "Patio"],
  );
  const down = stationHealthNotices({
    systems: printers,
    connectedSerial: null,
    probe: { prn_receipt: "down", prn_kitchen: "up", prn_patio: "down" },
  });
  assert.deepEqual(
    down.map((notice) => notice.text),
    ["Receipt is not responding.", "Patio is not responding."],
  );
  const cleared = applyLoginProbe(
    { prn_receipt: "down", prn_kitchen: "up", prn_patio: "down" },
    "prn_receipt",
    "up",
  );
  assert.deepEqual(
    stationHealthNotices({ systems: printers, connectedSerial: null, probe: cleared }).map(
      (notice) => notice.text,
    ),
    ["Patio is not responding."],
  );
  const seeded = seedLoginProbe({ prn_receipt: "down" }, ["prn_receipt", "prn_patio"]);
  assert.equal(seeded.prn_receipt, "down");
  assert.equal(seeded.prn_patio, "pending");
  assert.equal(
    stationHealthNotices({
      systems: printers,
      connectedSerial: null,
      probe: seeded,
    }).some((notice) => notice.text === "Receipt is not responding."),
    true,
  );
});

test("login ping uses the station, the print agent, or an online station", () => {
  assert.equal(lanProbePath({ native: true, agent: true, onlineStation: true }), "station_tcp");
  assert.equal(lanProbePath({ native: false, agent: true, onlineStation: true }), "print_agent");
  assert.equal(lanProbePath({ native: false, agent: false, onlineStation: true }), "online_station");
  assert.equal(lanProbePath({ native: false, agent: false, onlineStation: false }), "unreachable");
  const targets = parsePrinterProbeTargets([
    { id: "prn_receipt", host: "192.168.0.112", port: 9100 },
    { id: "public", host: "8.8.8.8", port: 9100 },
    { id: "prn_receipt", host: "10.0.0.2", port: 9100 },
  ]);
  assert.deepEqual(targets, [{ id: "prn_receipt", host: "192.168.0.112", port: 9100 }]);
});

test("a login probe does not wait for the printer", async () => {
  let finished = false;
  let released: (ok: boolean) => void = () => {};
  const gate = new Promise<boolean>((resolve) => {
    released = resolve;
  });
  scheduleConnectionProbes({
    targets: [{ id: "prn_receipt" }],
    probe: () => gate,
    onResult: () => {
      finished = true;
    },
  });
  assert.equal(finished, false);
  released(true);
  await gate;
  await Promise.resolve();
  assert.equal(finished, true);

  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  const login = store.slice(store.indexOf("login: (pin)"), store.indexOf("applyVerifiedStationPin"));
  assert.match(login, /void import\("\.\/station-connection-check"\)/);
  assert.match(login, /refreshStationConnectionOnLogin\(\)/);
  assert.doesNotMatch(login, /await import\("\.\/station-connection-check"\)/);
  assert.doesNotMatch(login, /await m\.refreshStationConnectionOnLogin/);
  const check = readFileSync("src/lib/pos/station-connection-check.ts", "utf8");
  assert.match(check, /void runStationConnectionCheck/);
  assert.match(check, /scheduleConnectionProbes/);
  const banner = readFileSync("src/components/pos/StationDevices.tsx", "utf8");
  assert.match(banner, /startStationConnectionCheck/);
  assert.match(banner, /loginConnectionPrinters/);
  const watcher = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watcher, /pullPrinterProbeFn/);
  assert.match(watcher, /probeNativePrinter/);
  const agent = readFileSync("scripts/print-agent.mjs", "utf8");
  assert.match(agent, /pathname === "\/probe"/);
});
