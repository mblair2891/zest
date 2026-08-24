import { apiHref } from "@/lib/platform/hosts";

export const NETWORK_READY_STATUSES = ["pass", "warn", "fail", "skipped"] as const;
export type NetworkReadyStatus = (typeof NETWORK_READY_STATUSES)[number];

export type NetworkChecklist = {
  venueWifi: boolean;
  notGuestIsolated: boolean;
  tabletCount: boolean;
  printerLan: boolean;
  offlineExpectations: boolean;
};

export const EMPTY_NETWORK_CHECKLIST: NetworkChecklist = {
  venueWifi: false,
  notGuestIsolated: false,
  tabletCount: false,
  printerLan: false,
  offlineExpectations: false,
};

export const NETWORK_CHECKLIST_ITEMS: {
  id: keyof NetworkChecklist;
  label: string;
  hint: string;
}[] = [
  {
    id: "venueWifi",
    label: "Venue staff Wi‑Fi is up",
    hint: "POS, KDS, and printers join a staff SSID — not the public guest network.",
  },
  {
    id: "notGuestIsolated",
    label: "POS devices are not on guest-only isolated Wi‑Fi",
    hint: "Client isolation on guest Wi‑Fi blocks tablets from the house hub and printers.",
  },
  {
    id: "tabletCount",
    label: "Tablet / station count matches the floor",
    hint: "Enough devices for POS, KDS, and host stand before first service.",
  },
  {
    id: "printerLan",
    label: "Printers are on the same LAN as POS",
    hint: "Chits and receipts stay on the house hub. Guest VLAN will not see them.",
  },
  {
    id: "offlineExpectations",
    label: "Team knows cash vs card when the internet is down",
    hint: "Cash still closes. Quantum Payments cards need an uplink. KDS and seating keep working on Wi‑Fi.",
  },
];

export type NetworkProbeResult = {
  status: Exclude<NetworkReadyStatus, "skipped">;
  latencyMs: number | null;
  healthOk: boolean;
  reason: string;
};

export type LocationNetworkReady = {
  networkReadyStatus?: NetworkReadyStatus;
  networkCheckedAt?: string;
  networkNotes?: string;
  networkChecklist?: NetworkChecklist;
};

export function parseNetworkReadyStatus(raw: unknown): NetworkReadyStatus | undefined {
  if (raw === "pass" || raw === "warn" || raw === "fail" || raw === "skipped") return raw;
  return undefined;
}

export function parseNetworkChecklist(raw: unknown): NetworkChecklist {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    venueWifi: Boolean(o.venueWifi),
    notGuestIsolated: Boolean(o.notGuestIsolated),
    tabletCount: Boolean(o.tabletCount),
    printerLan: Boolean(o.printerLan),
    offlineExpectations: Boolean(o.offlineExpectations),
  };
}

export function checklistComplete(c: NetworkChecklist | undefined): boolean {
  if (!c) return false;
  return NETWORK_CHECKLIST_ITEMS.every((i) => c[i.id]);
}

export function combineNetworkStatus(
  probe: Exclude<NetworkReadyStatus, "skipped"> | null,
  checks: NetworkChecklist | undefined,
  skipped: boolean,
): NetworkReadyStatus {
  if (skipped) return "skipped";
  if (!probe) return "skipped";
  if (probe === "fail") return "fail";
  if (probe === "warn" || !checklistComplete(checks)) return "warn";
  return "pass";
}

export const NETWORK_STATUS_COPY: Record<
  NetworkReadyStatus,
  { label: string; tone: "success" | "warn" | "danger" | "secondary"; blurb: string }
> = {
  pass: {
    label: "Pass",
    tone: "success",
    blurb: "Health is reachable and the house checklist is complete. You can still reopen this later.",
  },
  warn: {
    label: "Warn",
    tone: "warn",
    blurb: "Something is slow, incomplete, or partial. You may finish onboarding anyway — this is advisory.",
  },
  fail: {
    label: "Fail",
    tone: "danger",
    blurb: "Could not reach Summex from this network. Finish anyway if you must — POS and login stay available.",
  },
  skipped: {
    label: "Skipped",
    tone: "secondary",
    blurb: "Check was skipped. Re-run from location settings before first service when you can.",
  },
};

export const NETWORK_FAIL_RECS = [
  "Join this tablet to the staff SSID, not guest Wi‑Fi.",
  "Confirm the access point is up and client isolation is off on the staff network.",
  "If the ISP is down, cash and KDS still work on the house hub; cards wait for uplink.",
  "You can finish onboarding now and re-run this check from Settings anytime.",
];

export async function probeNetworkReadiness(): Promise<NetworkProbeResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "fail",
      latencyMs: null,
      healthOk: false,
      reason: "This device reports no internet. Join staff Wi‑Fi, then run the check again.",
    };
  }
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const url = apiHref("/health");
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const ms = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - started,
    );
    if (!r.ok) {
      return {
        status: "fail",
        latencyMs: ms,
        healthOk: false,
        reason: `Health endpoint returned ${r.status}. Check venue Wi‑Fi and the API host.`,
      };
    }
    const j = (await r.json()) as { ok?: boolean; db?: string };
    if (j.ok !== true) {
      return {
        status: "warn",
        latencyMs: ms,
        healthOk: false,
        reason: "Reached Summex, but health is not fully OK (database or API).",
      };
    }
    if (ms > 2000) {
      return {
        status: "warn",
        latencyMs: ms,
        healthOk: true,
        reason: `Reachable, but slow (${ms} ms). Guest cards may feel sticky at peak.`,
      };
    }
    return {
      status: "pass",
      latencyMs: ms,
      healthOk: true,
      reason: `Summex health OK in ${ms} ms.`,
    };
  } catch {
    return {
      status: "fail",
      latencyMs: null,
      healthOk: false,
      reason: "Could not reach Summex health. This does not block go-live.",
    };
  }
}
