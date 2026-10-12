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
import { finixSdkConnectActivity, finixUsernamePrefix } from "../src/lib/payments/pax-d135.ts";

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
  assert.match(pay, /noteStationActivity/);
  assert.match(pay, /action: "entity match"/);
  assert.match(pay, /action: "Finix keys"/);
  assert.match(pay, /action: "connect"/);
  assert.match(pay, /finixSdkConnectActivity/);
  assert.match(station, /finixSdkConnectActivity/);
  assert.match(station, /action: "Finix keys"/);
  assert.match(devices, /data-station-activity-log/);
  assert.match(devices, /data-station-activity-download/);
  assert.match(devices, /station-activity\.txt/);
  const sentence =
    "On reader select the station records the environment, whether username and password are present, the application ID, the merchant ID, and the device ID it sends to the Finix SDK.";
  const sdkSentence =
    "When the station calls the Finix Android SDK connect, Devices records the merchant ID, device ID, the first six characters of the username, and the environment passed in MerchantData, then the SDK exception message and code. The password is not recorded.";
  assert.match(guide, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(guide, new RegExp(sdkSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(payments, new RegExp(sdkSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(pay.includes(".disconnect("), false);
  assert.equal(station.includes(".disconnect("), false);
});
