/**
 * Pair this tablet over plain JSON. The station logs the response, then parses it.
 * A bad body becomes the setup sentence. The claim code stays in the field.
 */

import {
  SETUP_READ_MESSAGE,
  logSetupPayload,
  staffSetupMessage,
  type SetupLogHeaders,
} from "./setup-response";
import { STATION_PAIR_INVALID } from "./station-pair-payload";

export const STATION_PAIR_URL = "/api/station/pair";

export type StationPairRole = "order" | "ods" | "host" | "kiosk";

export type StationPairSuccess = {
  ok: true;
  pair: {
    locationId: string;
    orgId: string;
    locationName: string;
    orgName: string;
    venueType: string;
    station: StationPairRole;
    deviceId: string;
    claimCode: string;
  };
  publish: unknown;
  org: { id: string; name: string };
  location: { id: string; name: string; setup?: unknown };
  operators: unknown[];
  floorStaff: unknown[];
  role: "station";
  operatorId: null;
  openDemo: false;
  trainingRoster: boolean;
};

export type StationPairRead =
  | { ok: true; value: StationPairSuccess }
  | { ok: false; message: string };

const ROLES: StationPairRole[] = ["order", "ods", "host", "kiosk"];

function headerNote(headers: { get(name: string): string | null }): SetupLogHeaders {
  return {
    serialized: headers.get("x-tss-serialized"),
    length: headers.get("content-length"),
  };
}

function looksLikeHtml(text: string, contentType: string): boolean {
  if (contentType.toLowerCase().includes("text/html")) return true;
  const start = text.trimStart().slice(0, 48).toLowerCase();
  return (
    start.startsWith("<!doctype") ||
    start.startsWith("<html") ||
    start.startsWith("<head") ||
    start.startsWith("<body")
  );
}

/** User-facing pair failure. Parser and Seroval text stay off the screen. */
export function pairFailureText(message: string): string {
  const text = message.trim();
  if (!text) return SETUP_READ_MESSAGE;
  const setup = staffSetupMessage(text);
  if (setup) return setup;
  if (text === STATION_PAIR_INVALID) return STATION_PAIR_INVALID;
  if (text === "Enter the code from Devices") return text;
  if (text.startsWith("That code matches more than one")) return text;
  return SETUP_READ_MESSAGE;
}

/**
 * Log status, content-type, serialization header, content-length, and the body,
 * then parse. Truncated, HTML, and unexpected JSON stay a short sentence.
 */
export function readStationPairPayload(
  status: number,
  headers: { get(name: string): string | null },
  body: string,
): StationPairRead {
  const contentType = headers.get("content-type") || "";
  logSetupPayload("station-pair", status, body, contentType, headerNote(headers));
  const trimmed = body.trim();
  if (!trimmed || looksLikeHtml(trimmed, contentType)) {
    return { ok: false, message: SETUP_READ_MESSAGE };
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: SETUP_READ_MESSAGE };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: SETUP_READ_MESSAGE };
  }
  const row = value as Record<string, unknown>;
  if (row.ok === false) {
    const message = typeof row.message === "string" ? row.message : "";
    return { ok: false, message: pairFailureText(message) };
  }
  if (row.ok !== true) return { ok: false, message: SETUP_READ_MESSAGE };
  const pair = row.pair;
  if (!pair || typeof pair !== "object" || Array.isArray(pair)) {
    return { ok: false, message: SETUP_READ_MESSAGE };
  }
  const slot = pair as Record<string, unknown>;
  const station = String(slot.station ?? "");
  const locationId = String(slot.locationId ?? "").trim();
  const deviceId = String(slot.deviceId ?? "").trim();
  if (!locationId || !deviceId || !ROLES.includes(station as StationPairRole)) {
    return { ok: false, message: SETUP_READ_MESSAGE };
  }
  return { ok: true, value: row as StationPairSuccess };
}

export async function postStationPair(
  claimCode: string,
  browserDeviceId: string,
): Promise<StationPairSuccess> {
  let response: Response;
  try {
    response = await fetch(STATION_PAIR_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ claimCode, browserDeviceId }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    logSetupPayload("station-pair", 0, msg, "", { serialized: "", length: "" });
    throw new Error(SETUP_READ_MESSAGE);
  }
  const text = await response.text();
  const read = readStationPairPayload(response.status, response.headers, text);
  if (!read.ok) throw new Error(read.message);
  return read.value;
}
