/**
 * Drawer shift policy: Assigned, Shared, Personal bank, or None.
 * Ownership handoff is separate from till-to-till cash loans.
 */

export const DRAWER_SHIFT_MODES = ["assigned", "shared", "personal", "none"] as const;
export type DrawerShiftMode = (typeof DRAWER_SHIFT_MODES)[number];

export const DRAWER_SHIFT_MODE_LABEL: Record<DrawerShiftMode, string> = {
  assigned: "Assigned",
  shared: "Shared",
  personal: "Personal bank",
  none: "None",
};

export type DrawerShiftPolicy = {
  defaultMode: DrawerShiftMode;
  sectionMode: Record<string, DrawerShiftMode>;
  deviceMode: Record<string, DrawerShiftMode>;
  allowTransfer: boolean;
  requireCountOnTransfer: boolean;
  requireManagerPinForTransfer: boolean;
  /** 0 = do not require a manager for variance. */
  varianceApprovalCents: number;
  /** null = the employee enters the starting bank. */
  personalBankStartCents: number | null;
};

export const DEFAULT_DRAWER_SHIFT: DrawerShiftPolicy = {
  defaultMode: "assigned",
  sectionMode: {},
  deviceMode: {},
  allowTransfer: true,
  requireCountOnTransfer: true,
  requireManagerPinForTransfer: false,
  varianceApprovalCents: 0,
  personalBankStartCents: null,
};

export type ShiftDecision<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; needsManager?: boolean };

function asMode(raw: unknown): DrawerShiftMode | null {
  const s = String(raw ?? "");
  return (DRAWER_SHIFT_MODES as readonly string[]).includes(s) ? (s as DrawerShiftMode) : null;
}

function modeMap(raw: unknown): Record<string, DrawerShiftMode> {
  const out: Record<string, DrawerShiftMode> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const mode = asMode(v);
    const key = k.trim().slice(0, 80);
    if (key && mode) out[key] = mode;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}

/** When a saved location has no drawerShift blob, keep the house model it already used. */
export function inferDrawerShiftDefault(opts: {
  houseDrawerMode?: string | null;
  cashModel?: string | null;
}): DrawerShiftMode {
  if (opts.cashModel === "cash_disabled") return "none";
  if (opts.cashModel === "server_bank") return "personal";
  if (opts.houseDrawerMode === "shared" || opts.cashModel === "shared_drawer") return "shared";
  return "assigned";
}

export function parseDrawerShiftPolicy(raw: unknown, fallbackMode?: DrawerShiftMode): DrawerShiftPolicy {
  const base: DrawerShiftPolicy = {
    ...DEFAULT_DRAWER_SHIFT,
    defaultMode: fallbackMode ?? DEFAULT_DRAWER_SHIFT.defaultMode,
    sectionMode: {},
    deviceMode: {},
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const startRaw = o.personalBankStartCents;
  const personalBankStartCents =
    startRaw == null || startRaw === ""
      ? null
      : Math.max(0, Math.round(Number(startRaw) || 0));
  return {
    defaultMode: asMode(o.defaultMode) ?? base.defaultMode,
    sectionMode: modeMap(o.sectionMode),
    deviceMode: modeMap(o.deviceMode),
    allowTransfer: o.allowTransfer !== false,
    requireCountOnTransfer: o.requireCountOnTransfer !== false,
    requireManagerPinForTransfer: Boolean(o.requireManagerPinForTransfer),
    varianceApprovalCents: Math.max(0, Math.round(Number(o.varianceApprovalCents) || 0)),
    personalBankStartCents: Number.isFinite(personalBankStartCents) ? personalBankStartCents : null,
  };
}

/** Device override, then section override, then the location default. */
export function resolveDrawerShiftMode(
  policy: DrawerShiftPolicy,
  opts: { deviceId?: string | null; sectionId?: string | null },
): DrawerShiftMode {
  if (opts.deviceId && policy.deviceMode[opts.deviceId]) return policy.deviceMode[opts.deviceId]!;
  if (opts.sectionId && policy.sectionMode[opts.sectionId]) return policy.sectionMode[opts.sectionId]!;
  return policy.defaultMode;
}

export function explicitDrawerShiftMode(
  policy: DrawerShiftPolicy,
  opts: { deviceId?: string | null; sectionId?: string | null },
): DrawerShiftMode | null {
  if (opts.deviceId && policy.deviceMode[opts.deviceId]) return policy.deviceMode[opts.deviceId]!;
  if (opts.sectionId && policy.sectionMode[opts.sectionId]) return policy.sectionMode[opts.sectionId]!;
  return null;
}

/**
 * A personal-bank PIN keeps that bank unless this section or device
 * explicitly says Assigned, Shared, or None. A house drawer uses the location default.
 */
export function applyDrawerShiftToSink(opts: {
  policy: DrawerShiftPolicy;
  deviceId?: string | null;
  sectionId?: string | null;
  sinkType: "drawer" | "bank" | "blocked";
}): { mode: DrawerShiftMode; use: "drawer" | "bank" | "blocked"; error?: string } {
  if (opts.sinkType === "blocked") return { mode: "none", use: "blocked" };
  const explicit = explicitDrawerShiftMode(opts.policy, opts);
  const mode = explicit ?? (opts.sinkType === "bank" ? "personal" : opts.policy.defaultMode);
  if (mode === "none") {
    return { mode, use: "blocked", error: "This station does not handle cash." };
  }
  if (mode === "personal") return { mode, use: "bank" };
  return { mode, use: "drawer" };
}

export function ringCashDecision(opts: {
  mode: DrawerShiftMode;
  employeeId: string;
  ownerId: string | null;
  isManager: boolean;
  ownerClosed: boolean;
}): ShiftDecision<{ kick: boolean }> {
  if (opts.mode === "none") return { ok: false, error: "This station does not handle cash." };
  if (opts.mode === "personal") return { ok: true, kick: false };
  if (!opts.ownerId || opts.ownerClosed) return { ok: false, error: "Claim the drawer before cash." };
  if (opts.mode === "assigned" && opts.employeeId !== opts.ownerId && !opts.isManager) {
    return { ok: false, error: "Only the drawer owner can ring cash on this drawer." };
  }
  return { ok: true, kick: true };
}

export function ownerActionDecision(opts: {
  mode: DrawerShiftMode;
  employeeId: string;
  ownerId: string | null;
  isManager: boolean;
}): ShiftDecision {
  if (opts.mode === "none") return { ok: false, error: "This station does not handle cash." };
  if (opts.mode === "personal") return { ok: false, error: "A personal bank has no drawer to open." };
  if (!opts.ownerId) return { ok: false, error: "Claim the drawer before cash." };
  if (opts.employeeId !== opts.ownerId && !opts.isManager) {
    return { ok: false, error: "Only the drawer owner or a manager can open, close, or count this drawer." };
  }
  return { ok: true };
}

export function claimDrawerDecision(opts: {
  mode: DrawerShiftMode;
  existingOwnerId: string | null;
  ownerClosed: boolean;
  countedCents: number | null;
  personalBankStartCents: number | null;
}): ShiftDecision<{ startCents: number; kick: boolean }> {
  if (opts.mode === "none") return { ok: false, error: "This station does not handle cash." };
  if (opts.existingOwnerId && !opts.ownerClosed) {
    return { ok: false, error: "This drawer already has an owner." };
  }
  if (opts.mode === "personal" && opts.personalBankStartCents != null) {
    return { ok: true, startCents: opts.personalBankStartCents, kick: false };
  }
  if (opts.countedCents == null || !Number.isFinite(opts.countedCents)) {
    return { ok: false, error: "Enter the blind count." };
  }
  return {
    ok: true,
    startCents: Math.max(0, Math.round(opts.countedCents)),
    kick: opts.mode !== "personal",
  };
}

export function startOwnershipTransfer(opts: {
  allowTransfer: boolean;
  actorId: string;
  ownerId: string | null;
  isManager: boolean;
  requireManagerPin: boolean;
  managerPinOk: boolean;
  incomingId: string;
  requireCount: boolean;
  outgoingCountCents: number | null;
  expectedCents: number;
}): ShiftDecision<{
  status: "offered";
  outgoingCountCents: number | null;
  outgoingVarianceCents: number | null;
  expectedCents: number;
}> {
  if (!opts.allowTransfer) return { ok: false, error: "Drawer transfer is off." };
  if (!opts.ownerId) return { ok: false, error: "Claim the drawer before cash." };
  if (opts.actorId !== opts.ownerId && !opts.isManager) {
    return { ok: false, error: "Only the owner or a manager can start a transfer." };
  }
  if (opts.requireManagerPin && !opts.isManager && !opts.managerPinOk) {
    return { ok: false, error: "A manager PIN is required to transfer this drawer." };
  }
  if (!opts.incomingId || opts.incomingId === opts.ownerId) {
    return { ok: false, error: "Pick a different employee." };
  }
  if (opts.requireCount && (opts.outgoingCountCents == null || !Number.isFinite(opts.outgoingCountCents))) {
    return { ok: false, error: "Enter the blind count." };
  }
  const outgoingCountCents =
    opts.outgoingCountCents == null ? null : Math.max(0, Math.round(opts.outgoingCountCents));
  const outgoingVarianceCents =
    outgoingCountCents == null ? null : outgoingCountCents - opts.expectedCents;
  return {
    ok: true,
    status: "offered",
    outgoingCountCents,
    outgoingVarianceCents,
    expectedCents: opts.expectedCents,
  };
}

export function acceptOwnershipTransfer(opts: {
  actorId: string;
  incomingId: string;
  confirmPrevious: boolean;
  outgoingCountCents: number | null;
  expectedCents: number;
  incomingCountCents: number | null;
}): ShiftDecision<{ startCents: number; staysOpen: true }> {
  if (opts.actorId !== opts.incomingId) {
    return { ok: false, error: "Only the incoming employee can accept this transfer." };
  }
  if (opts.confirmPrevious) {
    const start = opts.outgoingCountCents != null ? opts.outgoingCountCents : opts.expectedCents;
    return { ok: true, startCents: Math.max(0, Math.round(start)), staysOpen: true };
  }
  if (opts.incomingCountCents == null || !Number.isFinite(opts.incomingCountCents)) {
    return { ok: false, error: "Enter the blind count." };
  }
  return {
    ok: true,
    startCents: Math.max(0, Math.round(opts.incomingCountCents)),
    staysOpen: true,
  };
}

export function forceReassignDecision(opts: {
  isManager: boolean;
  incomingId: string;
  ownerId: string | null;
}): ShiftDecision<{ reason: "manager action"; resetTotals: false; staysOpen: true }> {
  if (!opts.isManager) return { ok: false, error: "Only a manager can reassign this drawer." };
  if (!opts.incomingId || opts.incomingId === opts.ownerId) {
    return { ok: false, error: "Pick a different employee." };
  }
  return { ok: true, reason: "manager action", resetTotals: false, staysOpen: true };
}

export function closeOwnershipDecision(opts: {
  actorId: string;
  ownerId: string | null;
  countedCents: number | null;
  expectedCents: number;
  varianceApprovalCents: number;
  managerApproved: boolean;
  pendingTransfer: boolean;
}): ShiftDecision<{ varianceCents: number; flagged: boolean }> {
  if (opts.pendingTransfer) return { ok: false, error: "Finish or cancel the transfer first." };
  if (!opts.ownerId) return { ok: false, error: "Claim the drawer before cash." };
  if (opts.actorId !== opts.ownerId) {
    return { ok: false, error: "Only the current owner can close this drawer." };
  }
  if (opts.countedCents == null || !Number.isFinite(opts.countedCents)) {
    return { ok: false, error: "Enter the blind count." };
  }
  const varianceCents = Math.round(opts.countedCents) - opts.expectedCents;
  const threshold = opts.varianceApprovalCents;
  if (threshold > 0 && Math.abs(varianceCents) > threshold && !opts.managerApproved) {
    return {
      ok: false,
      error: "A manager must approve this variance.",
      needsManager: true,
    };
  }
  return { ok: true, varianceCents, flagged: varianceCents !== 0 };
}

export function ownerKey(mode: DrawerShiftMode, drawerId: string, employeeId: string): string {
  return mode === "personal" ? `bank:${employeeId}` : drawerId;
}
