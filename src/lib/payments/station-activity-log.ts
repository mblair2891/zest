/** Station record of a card-reader connect, an entity match, or Finix key status. */

export const STATION_ACTIVITY_ACTIONS = ["connect", "entity match", "Finix keys"] as const;

export type StationActivityAction = (typeof STATION_ACTIVITY_ACTIONS)[number];

export type StationActivityPresence = "" | "yes" | "no";

export type StationActivityEntry = {
  id: string;
  at: string;
  stationName: string;
  action: StationActivityAction;
  environment: string;
  usernamePresent: StationActivityPresence;
  passwordPresent: StationActivityPresence;
  merchantId: string;
  deviceId: string;
  checkEntity: string;
  readerEntity: string;
  result: string;
};

export function isStationActivityAction(value: string): value is StationActivityAction {
  return (STATION_ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

/** Pull the init line apart. Username and password values are not in that line. */
export function activityFieldsFromDiagnostic(diagnostic: string): {
  environment: string;
  usernamePresent: StationActivityPresence;
  passwordPresent: StationActivityPresence;
  merchantId: string;
  deviceId: string;
} {
  const text = String(diagnostic ?? "");
  const envRaw = /Environment\s+(SB|LIVE)\b/.exec(text)?.[1] ?? "";
  const user = /Username present\s+(yes|no)\b/.exec(text)?.[1];
  const pass = /Password present\s+(yes|no)\b/.exec(text)?.[1];
  const merchantRaw = /Merchant\s+([A-Za-z0-9_]+)/.exec(text)?.[1] ?? "";
  const deviceRaw = /Device\s+([A-Za-z0-9_]+)/.exec(text)?.[1] ?? "";
  const presence = (value: string | undefined): StationActivityPresence =>
    value === "yes" || value === "no" ? value : "";
  return {
    environment: envRaw,
    usernamePresent: presence(user),
    passwordPresent: presence(pass),
    merchantId: merchantRaw === "missing" ? "" : merchantRaw,
    deviceId: deviceRaw === "missing" ? "" : deviceRaw,
  };
}

/** Drop a stuffed username or password value. Presence words stay. */
export function sanitizeActivityResult(result: string): string {
  return String(result ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(password|username|userId|user_id)\b\s*[:=]\s*\S+/gi, "$1 present")
    .slice(0, 800);
}

export function formatStationActivityLine(entry: StationActivityEntry): string {
  const env = entry.environment.trim() || "—";
  const user = entry.usernamePresent || "—";
  const pass = entry.passwordPresent || "—";
  const merchant = entry.merchantId.trim() || "missing";
  const device = entry.deviceId.trim() || "missing";
  const check = entry.checkEntity.trim() || "—";
  const reader = entry.readerEntity.trim() || "—";
  const result = entry.result.trim() || "—";
  return [
    entry.at,
    entry.stationName.trim() || "Station",
    entry.action,
    `Environment ${env}`,
    `Username present ${user}`,
    `Password present ${pass}`,
    `Merchant ${merchant}`,
    `Device ${device}`,
    `Check entity ${check}`,
    `Reader entity ${reader}`,
    result,
  ].join(" | ");
}

/** Newest first, one line per entry. The Devices download is this text. */
export function stationActivityLogText(entries: StationActivityEntry[]): string {
  return entries.map((entry) => formatStationActivityLine(entry)).join("\n");
}
