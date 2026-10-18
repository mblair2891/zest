/** Remove, void, comp, and delete rules for an open check. Pure so tests can load it. */

export type CheckActionLine = {
  id: string;
  sent?: boolean;
  voided?: boolean;
  comped?: boolean;
  note?: string;
  actionReason?: string;
  pendingAction?: "void" | "comp";
};

export type CheckActionOrder = {
  status?: string;
  lines: CheckActionLine[];
  payments?: unknown[];
  cardAuth?: unknown;
};

const BROAD_CHECK_ROLES = new Set(["owner", "manager", "supervisor", "host"]);

/** Null means the actor may void any entity on the check. A set id is that entity only. */
export function actingEntityOperator(
  emp: { role?: string | null; operatorId?: string | null } | null | undefined,
): string | null {
  if (!emp) return null;
  if (BROAD_CHECK_ROLES.has(emp.role ?? "")) return null;
  const op = String(emp.operatorId ?? "").trim();
  if (!op || op === "host") return null;
  return op;
}

export function lineInEntityScope(
  line: { vendorId?: string | null; operatorId?: string | null } | null | undefined,
  entityId: string | null,
): boolean {
  if (!entityId) return true;
  if (!line) return false;
  const op = String(line.vendorId ?? line.operatorId ?? "").trim();
  return (op || "host") === entityId;
}

export function canRemoveLine(line: CheckActionLine | undefined | null): boolean {
  if (!line) return false;
  return !line.sent && !line.voided && !line.comped;
}

export function canVoidOrCompLine(line: CheckActionLine | undefined | null): boolean {
  if (!line) return false;
  return Boolean(line.sent) && !line.voided && !line.comped;
}

export function checkHasSentItem(order: { lines?: { sent?: boolean }[] } | null | undefined): boolean {
  return Boolean(order?.lines?.some((line) => Boolean(line.sent)));
}

export function canDeleteCheck(order: CheckActionOrder | null | undefined): boolean {
  if (!order) return false;
  if ((order.status ?? "open") !== "open") return false;
  if (checkHasSentItem(order)) return false;
  if ((order.payments?.length ?? 0) > 0) return false;
  if (order.cardAuth) return false;
  return true;
}

export function canVoidOrCompCheck(order: CheckActionOrder | null | undefined): boolean {
  if (!order) return false;
  if ((order.status ?? "open") !== "open") return false;
  return checkHasSentItem(order);
}

export function normalizeReasonList(raw: unknown, fallback: readonly string[]): string[] {
  const source = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n/) : null;
  if (!source) return [...fallback];
  const out: string[] = [];
  for (const row of source) {
    const text = String(row ?? "").trim().slice(0, 80);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= 24) break;
  }
  return out.length ? out : [...fallback];
}

export function reasonFromList(reason: string, list: readonly string[]): string | null {
  const text = String(reason ?? "").trim();
  if (!text) return null;
  return list.find((row) => row === text) ?? null;
}

export function lineActionReason(line: {
  actionReason?: string | null;
  note?: string | null;
  voided?: boolean;
  comped?: boolean;
}): string | undefined {
  const reason = String(line.actionReason ?? "").trim();
  if (reason) return reason;
  if (line.voided || line.comped) {
    const note = String(line.note ?? "").trim();
    return note || undefined;
  }
  return undefined;
}

export function linePrintName(name: string, line: { voided?: boolean; comped?: boolean }): string {
  if (line.voided) return `${name} VOID`;
  if (line.comped) return `${name} COMP`;
  return name;
}

export function removeUnsentLine<T extends CheckActionLine>(
  lines: T[],
  lineId: string,
): { ok: true; lines: T[] } | { ok: false; error: string } {
  const line = lines.find((row) => row.id === lineId);
  if (!line || line.voided || line.comped) return { ok: false, error: "Nothing to remove" };
  if (line.sent) return { ok: false, error: "Sent items are voided or comped." };
  return { ok: true, lines: lines.filter((row) => row.id !== lineId) };
}

export function applySentLineAction<T extends CheckActionLine>(
  lines: T[],
  lineId: string,
  kind: "void" | "comp",
  reason: string,
  list: readonly string[],
): { ok: true; lines: T[]; reason: string } | { ok: false; error: string } {
  const line = lines.find((row) => row.id === lineId);
  if (!line || line.voided || (kind === "comp" && line.comped)) {
    return { ok: false, error: kind === "void" ? "Nothing to void" : "Nothing to comp" };
  }
  if (!line.sent) {
    return { ok: false, error: "Unsent items are removed. Sent items are voided or comped." };
  }
  const picked = reasonFromList(reason, list);
  if (!picked) return { ok: false, error: "Pick a reason" };
  return {
    ok: true,
    reason: picked,
    lines: lines.map((row) =>
      row.id === lineId
        ? {
            ...row,
            ...(kind === "void" ? { voided: true as const } : { comped: true as const }),
            actionReason: picked,
            pendingAction: undefined,
          }
        : row,
    ),
  };
}

export function applyOpenCheckAction<T extends CheckActionLine>(
  lines: T[],
  kind: "void" | "comp",
  reason: string,
  list: readonly string[],
): { ok: true; lines: T[]; reason: string } | { ok: false; error: string } {
  if (!lines.some((row) => row.sent)) {
    return { ok: false, error: "Unsent checks are deleted. Sent checks are voided or comped." };
  }
  const picked = reasonFromList(reason, list);
  if (!picked) return { ok: false, error: "Pick a reason" };
  return {
    ok: true,
    reason: picked,
    lines: lines.map((row) => {
      if (row.voided || row.comped) return row;
      return {
        ...row,
        ...(kind === "void" ? { voided: true as const } : { comped: true as const }),
        actionReason: picked,
        pendingAction: undefined,
      };
    }),
  };
}
