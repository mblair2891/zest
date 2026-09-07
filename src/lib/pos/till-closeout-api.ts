import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { parseTransferLines, type CountSubmitInput, type ExpectedSnapshot } from "./till-closeout";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function org(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Organization is required");
  return s;
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

function emp(d: { id?: string; name?: string; role?: string }) {
  return {
    id: clip(d.id, 80),
    name: clip(d.name, 80),
    role: clip(d.role, 40),
  };
}

export const startTillCloseoutFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    drawerId: string;
    drawerName: string;
    sinkType: "drawer" | "bank";
    assignedEmployeeIds?: string[];
    employee: { id: string; name: string; role: string };
    snapshot: Omit<ExpectedSnapshot, "expectedCents">;
    nextShiftBankCents: number;
    witness?: { id: string; name: string } | null;
    deviceId?: string | null;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    drawerId: clip(d.drawerId, 80),
    drawerName: clip(d.drawerName, 80) || "Drawer",
    sinkType: d.sinkType === "bank" ? ("bank" as const) : ("drawer" as const),
    assignedEmployeeIds: Array.isArray(d.assignedEmployeeIds)
      ? d.assignedEmployeeIds.map((x) => clip(x, 80)).slice(0, 40)
      : [],
    employee: emp(d.employee),
    snapshot: {
      openingBankCents: Math.max(0, Math.round(Number(d.snapshot?.openingBankCents) || 0)),
      cashSalesCents: Math.max(0, Math.round(Number(d.snapshot?.cashSalesCents) || 0)),
      cashRefundsCents: Math.max(0, Math.round(Number(d.snapshot?.cashRefundsCents) || 0)),
      paidOutsCents: Math.max(0, Math.round(Number(d.snapshot?.paidOutsCents) || 0)),
      paidInsCents: Math.max(0, Math.round(Number(d.snapshot?.paidInsCents) || 0)),
      dropsCents: Math.max(0, Math.round(Number(d.snapshot?.dropsCents) || 0)),
      transfersInCents: Math.max(0, Math.round(Number(d.snapshot?.transfersInCents) || 0)),
      transfersOutCents: Math.max(0, Math.round(Number(d.snapshot?.transfersOutCents) || 0)),
      transferLines: parseTransferLines(d.snapshot?.transferLines),
    },
    nextShiftBankCents: Math.max(0, Math.round(Number(d.nextShiftBankCents) || 0)),
    witness: d.witness
      ? { id: clip(d.witness.id, 80), name: clip(d.witness.name, 80) }
      : null,
    deviceId: d.deviceId ? clip(d.deviceId, 80) : null,
  }))
  .handler(async ({ context, data }) => {
    const { startTillCloseout } = await import("./till-closeout.server");
    return startTillCloseout(context.userId, data);
  });

export const getTillCountScreenFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employeeId: string;
    role: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employeeId: clip(d.employeeId, 80),
    role: clip(d.role, 40),
  }))
  .handler(async ({ context, data }) => {
    const { getTillCountScreen } = await import("./till-closeout.server");
    return getTillCountScreen(context.userId, data);
  });

export const submitTillCountFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
    input: CountSubmitInput;
    deviceId?: string | null;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employee: emp(d.employee),
    input: {
      denoms: d.input?.denoms ?? null,
      countedTotalCents:
        d.input?.countedTotalCents == null ? null : Math.round(Number(d.input.countedTotalCents) || 0),
      bankRemoved: Boolean(d.input?.bankRemoved),
      checksCents: Math.max(0, Math.round(Number(d.input?.checksCents) || 0)),
      moneyOrdersCents: Math.max(0, Math.round(Number(d.input?.moneyOrdersCents) || 0)),
      bagNumber: d.input?.bagNumber ? clip(d.input.bagNumber, 40) : null,
    },
    deviceId: d.deviceId ? clip(d.deviceId, 80) : null,
  }))
  .handler(async ({ context, data }) => {
    const { submitTillCount } = await import("./till-closeout.server");
    return submitTillCount(context.userId, data);
  });

export const getTillResultFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employeeId: string;
    role: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employeeId: clip(d.employeeId, 80),
    role: clip(d.role, 40),
  }))
  .handler(async ({ context, data }) => {
    const { getTillResult } = await import("./till-closeout.server");
    return getTillResult(context.userId, data);
  });

export const managerTillQueueFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    employeeRole: string;
    fromMs?: number;
    toMs?: number;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    employeeRole: clip(d.employeeRole, 40),
    fromMs: d.fromMs ? Number(d.fromMs) : undefined,
    toMs: d.toMs ? Number(d.toMs) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { managerTillQueue } = await import("./till-closeout.server");
    return managerTillQueue(context.userId, data);
  });

export const acceptTillCloseoutFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note?: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    actor: emp(d.actor),
    note: d.note ? clip(d.note, 240) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { acceptTillCloseout } = await import("./till-closeout.server");
    return acceptTillCloseout(context.userId, data);
  });

export const requireTillRecountFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note?: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    actor: emp(d.actor),
    note: d.note ? clip(d.note, 240) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { requireTillRecount } = await import("./till-closeout.server");
    return requireTillRecount(context.userId, data);
  });

export const addTillManagerNoteFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    actor: emp(d.actor),
    note: clip(d.note, 240),
  }))
  .handler(async ({ context, data }) => {
    const { addTillManagerNote } = await import("./till-closeout.server");
    return addTillManagerNote(context.userId, data);
  });

export const correctTillOpeningBankFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    openingBankCents: number;
    reason: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    actor: emp(d.actor),
    openingBankCents: Math.max(0, Math.round(Number(d.openingBankCents) || 0)),
    reason: clip(d.reason, 240),
  }))
  .handler(async ({ context, data }) => {
    const { correctTillOpeningBank } = await import("./till-closeout.server");
    return correctTillOpeningBank(context.userId, data);
  });

export const pullTillCounterfeitFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    cents: number;
    reason: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    actor: emp(d.actor),
    cents: Math.max(0, Math.round(Number(d.cents) || 0)),
    reason: clip(d.reason, 240),
  }))
  .handler(async ({ context, data }) => {
    const { pullTillCounterfeit } = await import("./till-closeout.server");
    return pullTillCounterfeit(context.userId, data);
  });

export const markTillDroppedFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employee: emp(d.employee),
  }))
  .handler(async ({ context, data }) => {
    const { markTillDropped } = await import("./till-closeout.server");
    return markTillDropped(context.userId, data);
  });

export const addTillCommentFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
    comment: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employee: emp(d.employee),
    comment: clip(d.comment, 240),
  }))
  .handler(async ({ context, data }) => {
    const { addTillComment } = await import("./till-closeout.server");
    return addTillComment(context.userId, data);
  });

export const listTillAuditFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employeeRole: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: org(d.orgId),
    closeoutId: clip(d.closeoutId, 80),
    employeeRole: clip(d.employeeRole, 40),
  }))
  .handler(async ({ context, data }) => {
    const { listTillAudit } = await import("./till-closeout.server");
    return listTillAudit(context.userId, data);
  });
