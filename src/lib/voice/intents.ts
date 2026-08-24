import type { EmployeeRole } from "@/lib/pos/types";
import type { WaitlistReason } from "@/lib/front/types";

export type VoiceIntentKind =
  | "add_item"
  | "send_table"
  | "eighty_six"
  | "bump_ticket"
  | "waitlist_on"
  | "waitlist_off"
  | "waitlist_reason"
  | "void_line"
  | "unknown";

export type VoiceIntent = {
  kind: VoiceIntentKind;
  itemQuery?: string;
  tableLabel?: string;
  reason?: WaitlistReason;
  destructive: boolean;
  blocked: boolean;
  blockedReason?: string;
};

const BLOCKED = /payout|settlement bank|permission matrix|host cut|platform admin|delete location|tax rate/i;

export function parseVoiceIntent(transcript: string, role: EmployeeRole | null): VoiceIntent {
  const t = transcript.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return { kind: "unknown", destructive: false, blocked: false };

  if (BLOCKED.test(t)) {
    return {
      kind: "unknown",
      destructive: false,
      blocked: true,
      blockedReason: "Voice cannot change payouts, host permissions, or platform admin.",
    };
  }

  if (/turn off waitlist|disable waitlist|waitlist off/.test(t)) {
    return { kind: "waitlist_off", destructive: false, blocked: false };
  }
  if (/turn on waitlist|enable waitlist|waitlist on/.test(t)) {
    return { kind: "waitlist_on", destructive: true, blocked: false };
  }
  const reason = parseWaitReason(t);
  if (reason && /waitlist reason|set wait/.test(t)) {
    return { kind: "waitlist_reason", reason, destructive: false, blocked: false };
  }

  if (/^bump\b|bump ticket|bump it/.test(t)) {
    return { kind: "bump_ticket", destructive: false, blocked: false };
  }

  const send = t.match(/send(?:\s+(?:the\s+)?(?:check|order|ticket))?(\s+(?:to\s+)?(?:table|tab)\s+(\d+|[a-z]\d+))?/);
  if (/^send\b/.test(t) || /send table/.test(t)) {
    const table = t.match(/table\s+(\d+|[a-z]\d+)/i);
    return {
      kind: "send_table",
      tableLabel: table?.[1] ?? undefined,
      destructive: false,
      blocked: false,
    };
  }
  if (send?.[2]) {
    return { kind: "send_table", tableLabel: send[2], destructive: false, blocked: false };
  }

  const eighty = t.match(/(?:86|eighty[\s-]*six|eighty six)\s+(?:the\s+)?(.+)/);
  if (eighty?.[1] || /^(?:86|eighty[\s-]*six)\b/.test(t)) {
    const q = (eighty?.[1] ?? t.replace(/^(?:86|eighty[\s-]*six)\s*/i, "")).trim();
    return { kind: "eighty_six", itemQuery: q || undefined, destructive: true, blocked: false };
  }

  if (/^void\b/.test(t)) {
    const q = t.replace(/^void\s+(?:the\s+)?/i, "").replace(/\s+on\s+table.*/, "").trim();
    return { kind: "void_line", itemQuery: q || undefined, destructive: true, blocked: false };
  }

  const add = t.match(/add\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+to\s+(?:table|tab)\s+(\d+|[a-z]\d+))?$/);
  if (add?.[1] && !/^add\s+table/.test(t)) {
    return {
      kind: "add_item",
      itemQuery: add[1].replace(/\s+please$/, "").trim(),
      tableLabel: add[2],
      destructive: false,
      blocked: false,
    };
  }

  void role;
  return { kind: "unknown", destructive: false, blocked: false };
}

function parseWaitReason(t: string): WaitlistReason | undefined {
  if (/kitchen/.test(t)) return "kitchen_backed_up";
  if (/short kitchen|pit short/.test(t)) return "short_kitchen_staff";
  if (/short floor|short server/.test(t)) return "short_floor_staff";
  if (/capacity|full|packed/.test(t)) return "at_capacity";
  return undefined;
}

export function intentAllowedForRole(kind: VoiceIntentKind, role: EmployeeRole | null): boolean {
  if (!role || kind === "unknown") return false;
  switch (kind) {
    case "add_item":
    case "send_table":
      return role === "owner" || role === "manager" || role === "server" || role === "bartender" || role === "cashier" || role === "vendor_operator";
    case "eighty_six":
      return role === "owner" || role === "manager" || role === "kitchen" || role === "bartender" || role === "vendor_operator";
    case "bump_ticket":
      return role === "owner" || role === "manager" || role === "kitchen" || role === "bartender" || role === "vendor_operator";
    case "waitlist_on":
    case "waitlist_off":
    case "waitlist_reason":
      return role === "owner" || role === "manager" || role === "host";
    case "void_line":
      return role === "owner" || role === "manager" || role === "server";
    default:
      return false;
  }
}
