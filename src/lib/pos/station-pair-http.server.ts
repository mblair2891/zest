/**
 * POST /api/station/pair. Plain JSON in, plain JSON out. No Seroval envelope.
 */

import { pairStationByClaim } from "@/lib/access/api";
import { jsonSafe } from "@/lib/pos/json-safe";
import { SETUP_READ_MESSAGE, logSetupPayload, staffSetupMessage } from "@/lib/pos/setup-response";
import { STATION_PAIR_INVALID } from "@/lib/pos/station-pair-payload";

const MAX_PAIR_REQUEST = 8_000;

function pairJson(status: number, body: unknown): Response {
  let code = status;
  let text: string;
  try {
    text = JSON.stringify(body);
  } catch {
    text = JSON.stringify({ ok: false, message: SETUP_READ_MESSAGE });
    code = 502;
  }
  const length = String(Buffer.byteLength(text));
  logSetupPayload("station-pair", code, text, "application/json", {
    serialized: "",
    length,
  });
  return new Response(text, {
    status: code,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": length,
      "cache-control": "no-store",
    },
  });
}

function failure(err: unknown): Response {
  const msg = err instanceof Error ? err.message : "";
  if (
    msg === STATION_PAIR_INVALID ||
    msg === "Enter the code from Devices" ||
    msg.startsWith("That code matches more than one")
  ) {
    return pairJson(400, { ok: false, message: msg });
  }
  if (staffSetupMessage(msg)) return pairJson(502, { ok: false, message: SETUP_READ_MESSAGE });
  console.error(`[setup] station-pair failed status=500 body=${msg.slice(0, 240)}`);
  return pairJson(502, { ok: false, message: SETUP_READ_MESSAGE });
}

export async function handleStationPairRequest(request: Request): Promise<Response> {
  let text = "";
  try {
    text = await request.text();
  } catch {
    return pairJson(502, { ok: false, message: SETUP_READ_MESSAGE });
  }
  if (text.length > MAX_PAIR_REQUEST) {
    return pairJson(400, { ok: false, message: "Enter the code from Devices" });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return pairJson(502, { ok: false, message: SETUP_READ_MESSAGE });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return pairJson(400, { ok: false, message: "Enter the code from Devices" });
  }
  const row = body as Record<string, unknown>;
  const claimCode = String(row.claimCode ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .slice(0, 12);
  const browserDeviceId = row.browserDeviceId ? String(row.browserDeviceId).trim().slice(0, 80) : "";
  try {
    const result = await pairStationByClaim({ claimCode, browserDeviceId });
    return pairJson(200, { ok: true, ...jsonSafe(result) });
  } catch (err) {
    return failure(err);
  }
}
