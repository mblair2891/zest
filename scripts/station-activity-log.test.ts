import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activityFieldsFromDiagnostic,
  formatStationActivityLine,
  sanitizeActivityResult,
  stationActivityLogText,
  type StationActivityEntry,
} from "../src/lib/payments/station-activity-log.ts";
import {
  finixMerchantDataGap,
  finixMerchantDataPreview,
  finixSdkConnectActivity,
  finixUserIdPreview,
  finixUsernamePrefix,
  paxSdkConnectActivityResult,
} from "../src/lib/payments/pax-d135.ts";

const entry: StationActivityEntry = {
  id: "sal_1",
  at: "2026-10-11T18:00:00.000Z",
  stationName: "Order",
  action: "connect",
  environment: "SB",
  usernamePresent: "yes",
  passwordPresent: "yes",
  applicationId: "APexample",
  merchantId: "MUexample",
  deviceId: "DVexample",
  checkEntity: "Copper Bar",
  readerEntity: "Copper Bar",
  result: "Reader ready",
};

test("activity line names the station, both entities, and the result", () => {
  const line = formatStationActivityLine(entry);
  assert.match(line, /2026-10-11T18:00:00.000Z/);
  assert.match(line, /\| Order \| connect \|/);
  assert.match(line, /Environment SB/);
  assert.match(line, /Username present yes/);
  assert.match(line, /Password present yes/);
  assert.match(line, /Application APexample/);
  assert.match(line, /Merchant MUexample/);
  assert.match(line, /Device DVexample/);
  assert.match(line, /Check entity Copper Bar/);
  assert.match(line, /Reader entity Copper Bar/);
  assert.match(line, /Reader ready$/);
  assert.equal(line.includes("secret-value"), false);
});

test("diagnostic fields keep presence and drop a stuffed password", () => {
  const fields = activityFieldsFromDiagnostic(
    "Environment SB. Username present yes. Password present no. Merchant missing. Device DVexample.",
  );
  assert.equal(fields.environment, "SB");
  assert.equal(fields.usernamePresent, "yes");
  assert.equal(fields.passwordPresent, "no");
  assert.equal(fields.applicationId, "");
  assert.equal(fields.merchantId, "");
  assert.equal(fields.deviceId, "DVexample");
  assert.equal(sanitizeActivityResult("Unauthorized. password: secret-value"), "Unauthorized. password present");
});

test("connect trace keeps the application id and the raw Finix body", () => {
  const raw = '{"message":"Unauthorized"}';
  const traced: StationActivityEntry = {
    ...entry,
    result: raw,
  };
  const line = formatStationActivityLine(traced);
  assert.match(line, /Application APexample/);
  assert.match(line, /Merchant MUexample/);
  assert.match(line, /Device DVexample/);
  assert.ok(line.endsWith(raw));
  assert.equal(stationActivityLogText([traced]).includes(line), true);
  const parsed = activityFieldsFromDiagnostic(
    "Environment SB. Username present yes. Password present yes. Application APexample. Merchant MUexample. Device DVexample.",
  );
  assert.equal(parsed.applicationId, "APexample");
  assert.equal(sanitizeActivityResult(`${raw} password: secret-value`).includes("secret-value"), false);
});

test("pre-connect activity lists MerchantData and hides the password", () => {
  const preview = finixUserIdPreview("US1234567890");
  assert.equal(preview, "US123456");
  const line = finixMerchantDataPreview({
    merchantId: "MUexample",
    deviceId: "DVexample",
    userId: "US1234567890",
    env: "SB",
    mid: "MID-secret-value",
  });
  assert.match(line, /merchantId MUexample/);
  assert.match(line, /deviceId DVexample/);
  assert.match(line, /userId prefix US123456/);
  assert.match(line, /mid present yes/);
  assert.equal(line.includes("US1234567890"), false);
  assert.equal(line.includes("MID-secret-value"), false);
  assert.equal(line.includes("secret-value"), false);
  assert.equal(line.toLowerCase().includes("password"), false);
  assert.match(line, /env SB/);
  const emptyMid = finixMerchantDataPreview({
    merchantId: "MUexample",
    deviceId: "DVexample",
    userId: "US1234567890",
    env: "SB",
    mid: "",
  });
  assert.match(emptyMid, /mid present no/);
  assert.equal(sanitizeActivityResult(line), line);
  assert.equal(
    finixMerchantDataGap({
      merchantId: "",
      deviceId: "DVexample",
      userId: "US1234567890",
      password: "secret-value",
      env: "SB",
      mid: "M123",
    }),
    "missing merchantId",
  );
  assert.equal(
    finixMerchantDataGap({
      merchantId: "MUexample",
      deviceId: "DVexample",
      userId: " ",
      password: "secret-value",
      env: "SB",
      mid: "M123",
    }),
    "missing userId",
  );
  assert.equal(
    finixMerchantDataGap({
      merchantId: "MUexample",
      deviceId: "DVexample",
      userId: "US1234567890",
      password: "",
      env: "SB",
      mid: "M123",
    }),
    "missing password",
  );
  assert.equal(
    finixMerchantDataGap({
      merchantId: "MUexample",
      deviceId: "",
      userId: "US1234567890",
      password: "secret-value",
      env: "SB",
      mid: "M123",
    }),
    "missing deviceId",
  );
  assert.equal(
    finixMerchantDataGap({
      merchantId: "MUexample",
      deviceId: "DVexample",
      userId: "US1234567890",
      password: "secret-value",
      env: "SB",
      mid: "",
    }),
    "missing mid",
  );
  assert.equal(
    finixMerchantDataGap({
      merchantId: "MUexample",
      deviceId: "DVexample",
      userId: "US1234567890",
      password: "secret-value",
      env: "SB",
      mid: "M123",
    }),
    null,
  );
  assert.equal(
    paxSdkConnectActivityResult({
      ok: false,
      message: "Failed to connect: device not found",
      sdkCode: "UNKNOWN",
    }),
    "Failed to connect: device not found code UNKNOWN",
  );
  assert.equal(paxSdkConnectActivityResult({ ok: true, message: "Reader ready", sdkCode: "none" }), "Connected");
  const shown = formatStationActivityLine({ ...entry, result: line });
  assert.match(shown, /userId prefix US123456/);
  assert.equal(shown.includes("secret-value"), false);
});

test("sdk connect activity records MerchantData and the SDK code", () => {
  const prefix = finixUsernamePrefix("US123456789");
  assert.equal(prefix, "US1234");
  const line = finixSdkConnectActivity({
    merchantId: "MUexample",
    deviceId: "DVexample",
    usernamePrefix: prefix,
    environment: "SB",
    sdkMessage: "Unauthorized",
    sdkCode: "UNKNOWN",
  });
  assert.match(line, /merchantId MUexample/);
  assert.match(line, /deviceId DVexample/);
  assert.match(line, /username prefix US1234/);
  assert.equal(line.includes("US123456789"), false);
  assert.match(line, /environment SB/);
  assert.match(line, /SDK message Unauthorized/);
  assert.match(line, /code UNKNOWN/);
  const secret = finixSdkConnectActivity({
    merchantId: "MUexample",
    deviceId: "DVexample",
    usernamePrefix: "US1234",
    environment: "SB",
    sdkMessage: "Unauthorized password: secret-value",
    sdkCode: "UNKNOWN",
  });
  assert.equal(secret.includes("secret-value"), false);
  const shown = formatStationActivityLine({
    ...entry,
    result: line,
  });
  assert.equal(stationActivityLogText([ { ...entry, result: line } ]).includes(shown), true);
});

test("download text is the same lines Devices shows", () => {
  const text = stationActivityLogText([entry]);
  assert.equal(text, formatStationActivityLine(entry));
});

test("pay and devices record and list the log", () => {
  const pay = readFileSync(new URL("../src/components/pos/PaymentDialog.tsx", import.meta.url), "utf8");
  const station = readFileSync(new URL("../src/components/pos/StationDevices.tsx", import.meta.url), "utf8");
  const devices = readFileSync(new URL("../src/components/pos/LocationDeviceRegistry.tsx", import.meta.url), "utf8");
  const guide = readFileSync(new URL("../src/lib/guide/content/devices.ts", import.meta.url), "utf8");
  const payments = readFileSync(new URL("../src/lib/guide/content/payments.ts", import.meta.url), "utf8");
  assert.match(pay, /paxSdkConnectActivityResult/);
  assert.match(station, /paxSdkConnectActivityResult/);
  assert.match(pay, /env: session\.env/);
  assert.match(station, /env: session\.env/);
  assert.match(pay, /noteStationActivity/);
  assert.match(pay, /action: "entity match"/);
  assert.match(pay, /action: "Finix keys"/);
  assert.match(pay, /action: "connect"/);
  assert.match(pay, /finixSdkTraceFromConnect/);
  assert.match(station, /finixSdkTraceFromConnect/);
  assert.match(pay, /finixMerchantDataPreview/);
  assert.match(station, /finixMerchantDataPreview/);
  assert.match(pay, /finixMerchantDataGap/);
  assert.match(station, /finixMerchantDataGap/);
  assert.ok(pay.indexOf("finixMerchantDataGap") < pay.indexOf("connectForPaxReader"));
  assert.ok(station.indexOf("finixMerchantDataGap") < station.indexOf("connectForPaxReader"));
  assert.match(pay, /mid: session\.mid/);
  assert.match(station, /mid: session\.mid/);
  assert.match(pay, /status\.state !== "processing"/);
  assert.match(station, /status\.state !== "processing"/);
  assert.match(pay, /readServerEnv\("FINIX_USERNAME"\)|creds\.userId/);
  assert.match(pay, /creds\.merchantId/);
  assert.match(station, /creds\.merchantId/);
  assert.match(station, /action: "Finix keys"/);
  assert.match(devices, /data-station-activity-log/);
  assert.match(devices, /data-station-activity-download/);
  assert.match(devices, /station-activity\.txt/);
  const sentence =
    "On reader select the station records the environment, whether username and password are present, the application ID, the merchant ID, and the device ID it sends to the Finix SDK.";
  const sdkSentence =
    "When the station initializes the card reader it uses the selling entity's Finix merchant, the reader's device id, and the server's Finix username and password.";
  const diagnosticSentence =
    "Before the station connects the card reader, Station activity lists the merchant, the device, the first eight characters of the username, the environment, and mid.";
  const scanSentence =
    "An empty merchant number shows missing mid and does not connect. Pay scans for a reader whose name contains D135 and whose serial matches the one that was tapped, then connects that reader.";
  assert.match(guide, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(guide, new RegExp(sdkSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(sdkSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(guide, new RegExp(diagnosticSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(diagnosticSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(guide, new RegExp(scanSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(scanSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(pay.includes(".disconnect("), false);
  assert.equal(station.includes(".disconnect("), false);
});
