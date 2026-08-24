import { usePosStore } from "@/lib/pos/store";
import { canEmployee } from "@/lib/access/permissions";
import { canEditMenu } from "@/lib/access/entity-grants";
import { saveFrontSettingsFn } from "@/lib/front/api";
import { isProspectDemo } from "@/lib/demo/session";
import { intentAllowedForRole, parseVoiceIntent, type VoiceIntent } from "./intents";
import { matchMenuItems } from "./match-item";
import { logVoiceCommandFn } from "./api";

export type VoiceExecuteResult = {
  ok: boolean;
  message: string;
  deny?: boolean;
  needsConfirm?: boolean;
  confirmLabel?: string;
  intent: VoiceIntent;
  didYouMean?: { id: string; name: string }[];
  pending?: { kind: VoiceIntent["kind"]; itemId?: string; tableId?: string };
};

function tableByLabel(label?: string) {
  if (!label) return undefined;
  const want = label.toLowerCase();
  return usePosStore.getState().tables.find(
    (t) => t.label.toLowerCase() === want || t.label.toLowerCase() === `t${want}`,
  );
}

export function previewVoiceCommand(transcript: string): VoiceExecuteResult {
  const s = usePosStore.getState();
  const emp = s.getCurrentEmployee();
  const intent = parseVoiceIntent(transcript, emp?.role ?? null);
  if (intent.blocked) {
    return { ok: false, deny: true, message: intent.blockedReason ?? "Not allowed", intent };
  }
  if (!emp) return { ok: false, deny: true, message: "PIN in first", intent };
  if (s.sessionKind === "pin" && (intent.kind === "unknown" && /payout|permission/.test(transcript))) {
    return { ok: false, deny: true, message: "Floor PIN cannot change host settings by voice", intent };
  }
  if (!intentAllowedForRole(intent.kind, emp.role)) {
    return { ok: false, deny: true, message: `Not a ${emp.role} command`, intent };
  }

  if (intent.kind === "add_item") {
    const hits = matchMenuItems(intent.itemQuery, s.menuItems.filter((m) => m.available));
    if (!hits.length) return { ok: false, message: `No menu match for “${intent.itemQuery}”`, intent };
    if (hits.length > 1 && hits[0]!.score - hits[1]!.score < 0.12) {
      return {
        ok: false,
        message: "Did you mean…?",
        intent,
        didYouMean: hits.map((h) => ({ id: h.item.id, name: h.item.name })),
      };
    }
    const table = tableByLabel(intent.tableLabel);
    return {
      ok: true,
      message: `Add ${hits[0]!.item.name}${table ? ` to table ${table.label}` : ""}`,
      intent,
      pending: { kind: "add_item", itemId: hits[0]!.item.id, tableId: table?.id },
    };
  }

  if (intent.kind === "eighty_six") {
    if (!canEmployee(emp, "item:86")) {
      return { ok: false, deny: true, message: "You cannot 86 items", intent };
    }
    const hits = matchMenuItems(intent.itemQuery, s.menuItems);
    if (!hits.length) return { ok: false, message: `No item named “${intent.itemQuery}”`, intent };
    if (hits.length > 1 && hits[0]!.score - hits[1]!.score < 0.12) {
      return {
        ok: false,
        message: "Did you mean…?",
        intent,
        didYouMean: hits.map((h) => ({ id: h.item.id, name: h.item.name })),
        needsConfirm: true,
      };
    }
    const item = hits[0]!.item;
    if (!canEditMenu(emp, s.entityPermissions, item.vendorId)) {
      return { ok: false, deny: true, message: "You cannot 86 another entity’s item", intent };
    }
    return {
      ok: true,
      message: `86 ${item.name}`,
      intent,
      needsConfirm: true,
      confirmLabel: `86 ${item.name}?`,
      pending: { kind: "eighty_six", itemId: item.id },
    };
  }

  if (intent.kind === "send_table") {
    const table = tableByLabel(intent.tableLabel) ?? s.tables.find((t) => t.id === s.activeTableId);
    if (!table) return { ok: false, message: "Which table?", intent };
    return {
      ok: true,
      message: `Send table ${table.label}`,
      intent,
      pending: { kind: "send_table", tableId: table.id },
    };
  }

  if (intent.kind === "bump_ticket") {
    if (!canEmployee(emp, "tickets:bump")) {
      return { ok: false, deny: true, message: "You cannot bump tickets", intent };
    }
    return { ok: true, message: "Bump the oldest ticket on this rail", intent, pending: { kind: "bump_ticket" } };
  }

  if (intent.kind === "waitlist_on" || intent.kind === "waitlist_off") {
    if (!canEmployee(emp, "waitlist:manage")) {
      return { ok: false, deny: true, message: "Waitlist is host-stand / manager", intent };
    }
    return {
      ok: true,
      message: intent.kind === "waitlist_on" ? "Turn waitlist on" : "Turn waitlist off",
      intent,
      needsConfirm: intent.kind === "waitlist_on",
      confirmLabel: "Turn waitlist on for the house?",
      pending: { kind: intent.kind },
    };
  }

  if (intent.kind === "waitlist_reason") {
    if (!canEmployee(emp, "waitlist:manage")) {
      return { ok: false, deny: true, message: "Waitlist is host-stand / manager", intent };
    }
    return {
      ok: true,
      message: `Set waitlist reason: ${intent.reason}`,
      intent,
      pending: { kind: "waitlist_reason" },
    };
  }

  if (intent.kind === "void_line") {
    return {
      ok: true,
      message: "Void the last line on this check",
      intent,
      needsConfirm: true,
      confirmLabel: "Void that line?",
      pending: { kind: "void_line" },
    };
  }

  return { ok: false, message: "I didn’t catch a command. Try “add highball to table 12” or “86 brisket”.", intent };
}

export function commitVoicePending(pending: NonNullable<VoiceExecuteResult["pending"]>, intent: VoiceIntent): VoiceExecuteResult {
  const s = usePosStore.getState();
  const emp = s.getCurrentEmployee();
  if (!emp) return { ok: false, deny: true, message: "PIN in first", intent };

  if (pending.kind === "add_item" && pending.itemId) {
    if (pending.tableId) {
      const sel = s.selectTable(pending.tableId);
      if (!sel.ok) return { ok: false, message: sel.error ?? "Cannot open that table", intent };
    }
    const add = s.addItem(pending.itemId);
    if (!add.ok) return { ok: false, message: add.error ?? "Could not add", intent };
    s.audit("voice_command", `add ${pending.itemId}`);
    return { ok: true, message: "Added to the check", intent };
  }

  if (pending.kind === "eighty_six" && pending.itemId) {
    const item = s.menuItems.find((m) => m.id === pending.itemId);
    if (!item) return { ok: false, message: "Item gone", intent };
    if (!canEditMenu(emp, s.entityPermissions, item.vendorId)) {
      return { ok: false, deny: true, message: "You cannot 86 another entity’s item", intent };
    }
    s.toggleItemAvailable(pending.itemId);
    s.audit("voice_command", `86 ${item.name}`);
    return { ok: true, message: `${item.name} is 86`, intent };
  }

  if (pending.kind === "send_table" && pending.tableId) {
    s.selectTable(pending.tableId);
    s.sendOrder();
    s.audit("voice_command", `send table ${pending.tableId}`);
    return { ok: true, message: "Sent", intent };
  }

  if (pending.kind === "bump_ticket") {
    const station = s.view === "bar" ? "bar" : "kitchen";
    const t = s.tickets.find((x) => x.station === station && x.status !== "bumped");
    if (!t) return { ok: false, message: "No ticket to bump", intent };
    s.bumpTicket(t.id);
    s.audit("voice_command", `bump ${t.id}`);
    return { ok: true, message: `Bumped ${t.tableLabel}`, intent };
  }

  if (pending.kind === "waitlist_on" || pending.kind === "waitlist_off") {
    const on = pending.kind === "waitlist_on";
    s.updateSettings({ waitlistEnabled: on });
    const locId = s.tenantLocationId;
    if (locId && !isProspectDemo()) {
      void saveFrontSettingsFn({ data: { locationId: locId, waitlistEnabled: on } }).catch(() => undefined);
    }
    s.audit("voice_command", `waitlist ${on ? "on" : "off"}`);
    return { ok: true, message: on ? "Waitlist on" : "Waitlist off", intent };
  }

  if (pending.kind === "waitlist_reason" && intent.reason) {
    s.updateSettings({ waitlistReason: intent.reason });
    const locId = s.tenantLocationId;
    if (locId && !isProspectDemo()) {
      void saveFrontSettingsFn({
        data: { locationId: locId, waitlistReason: intent.reason, waitlistEnabled: true },
      }).catch(() => undefined);
    }
    s.audit("voice_command", `waitlist reason ${intent.reason}`);
    return { ok: true, message: "Waitlist reason set", intent };
  }

  if (pending.kind === "void_line") {
    const order = s.getActiveOrder();
    const line = [...(order?.lines ?? [])].reverse().find((l) => !l.voided);
    if (!line) return { ok: false, message: "No line to void", intent };
    s.voidLine(line.id, "voice");
    s.audit("voice_command", `void ${line.name}`);
    return { ok: true, message: `Voided ${line.name}`, intent };
  }

  return { ok: false, message: "Nothing to do", intent };
}

export function logVoiceResult(
  transcript: string,
  result: VoiceExecuteResult,
): void {
  const s = usePosStore.getState();
  const emp = s.getCurrentEmployee();
  const locId = s.tenantLocationId;
  if (!locId || isProspectDemo()) return;
  void logVoiceCommandFn({
    data: {
      locationId: locId,
      operatorId: emp?.operatorId ?? null,
      transcript,
      intent: result.intent.kind,
      ok: result.ok && !result.deny,
      detail: result.message,
    },
  }).catch(() => undefined);
}
