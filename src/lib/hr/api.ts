import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { EntityHrConfig, HrAudience, HrFeatureKey, HrVisibilityKey } from "./types";
import type { PayrollProviderId } from "@/lib/labor/payroll-export";
import type { CcTipPayoutSetting } from "@/lib/pos/cash-handling";
import type { TipPoolingSetting } from "@/lib/pos/tip-pooling";

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

function employer(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s || HOST_SCOPE;
}

async function ctxFor(userId: string, orgId: string, locationId: string) {
  const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
  return loadEntityWriteContext(userId, orgId, locationId);
}

export const hrOverviewFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId?: string | null }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: d.employerId ? employer(d.employerId) : null,
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    const employerId = hr.employerOf(ctx, data.employerId);
    const config = hr.snapshotConfig(ctx, employerId);
    const esign = hr.esignConfigured();
    const state = config.employmentState || ctx.setup.employmentState || "federal";
    const { connectorStatus } = await import("@/lib/labor/payroll-connectors");
    const payroll = connectorStatus(config.payrollProvider === "none" ? "csv" : config.payrollProvider);
    return {
      employerEntityId: employerId,
      employmentState: state,
      config,
      packets: hr.packetsForState(state === "federal" ? "US" : state),
      esign: {
        configured: esign.ok,
        provider: esign.provider,
        label: esign.ok
          ? `E-sign via ${esign.provider === "docusign" ? "DocuSign" : "HelloSign"}`
          : "E-sign outbox — download to sign, then attach the completed PDF",
      },
      payrollExport: {
        provider: config.payrollProvider,
        apiConfigured: payroll.apiConfigured,
        connectHint: payroll.connectHint,
      },
      piiReady: hr.piiReady(),
      isPlatformAdmin: ctx.isPlatformAdmin,
      isHost: ctx.operatorId === HOST_SCOPE || ctx.role === "owner" || ctx.role === "manager",
      role: ctx.role,
    };
  });

export const saveHrSettingsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      enabled?: boolean;
      employmentState?: string;
      features?: Partial<Record<HrFeatureKey, boolean>>;
      visibility?: Partial<Record<HrVisibilityKey, HrAudience>>;
      payrollProvider?: PayrollProviderId;
      ccTipPayout?: CcTipPayoutSetting;
      tipPooling?: TipPoolingSetting;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      enabled: d.enabled,
      employmentState: d.employmentState ? String(d.employmentState).slice(0, 16) : undefined,
      features: d.features,
      visibility: d.visibility,
      payrollProvider: d.payrollProvider,
      ccTipPayout: d.ccTipPayout,
      tipPooling: d.tipPooling,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    const config = await hr.saveEntityHrConfig(ctx, data);
    return { ok: true as const, config };
  });

export const listHrApplicantsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listApplicants(ctx, data.employerId);
  });

export const upsertHrApplicantFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      id?: string;
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      stage?: string;
      notes?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: d.id ? String(d.id).slice(0, 80) : undefined,
      name: String(d.name ?? "").trim().slice(0, 120),
      email: d.email ? String(d.email).trim().slice(0, 160) : undefined,
      phone: d.phone ? String(d.phone).trim().slice(0, 40) : undefined,
      role: d.role ? String(d.role).trim().slice(0, 80) : undefined,
      stage: d.stage ? String(d.stage).slice(0, 40) : undefined,
      notes: d.notes ? String(d.notes).slice(0, 2000) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.upsertApplicant(ctx, data);
  });

export const listHrOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listOnboarding(ctx, data.employerId);
  });

export const startHrOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      employeeName: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      employeeName: String(d.employeeName ?? "").slice(0, 120),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.startOnboarding(ctx, data);
  });

export const patchHrOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      id: string;
      checklist?: { id: string; label: string; done: boolean }[];
      i9Status?: string;
      markI9Section?: 1 | 2 | 3;
      complete?: boolean;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: String(d.id ?? "").slice(0, 80),
      checklist: d.checklist,
      i9Status: d.i9Status as import("./types").I9Status | undefined,
      markI9Section: d.markI9Section,
      complete: d.complete,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.patchOnboarding(ctx, data);
    return { ok: true as const };
  });

export const listHrPacketsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listPackets(ctx, data.employerId);
  });

export const sendHrPacketFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId?: string;
      employeeName: string;
      employeeEmail: string;
      templateId: string;
      state: string;
      employerName: string;
      locationName: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: d.employeeId ? String(d.employeeId).slice(0, 80) : undefined,
      employeeName: String(d.employeeName ?? "").slice(0, 120),
      employeeEmail: String(d.employeeEmail ?? "").slice(0, 160),
      templateId: String(d.templateId ?? "").slice(0, 80),
      state: String(d.state ?? "federal").slice(0, 16),
      employerName: String(d.employerName ?? "").slice(0, 120),
      locationName: String(d.locationName ?? "").slice(0, 120),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.sendPacket(ctx, data);
  });

export const hrPacketOutboxFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: { orgId: string; locationId: string; employerId: string; id: string }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: String(d.id ?? "").slice(0, 80),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.packetOutbox(ctx, data);
  });

export const markHrPacketFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      id: string;
      action: "viewed" | "signed" | "counter_sign" | "upload";
      fileName?: string;
      fileData?: string;
      fileKind?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: String(d.id ?? "").slice(0, 80),
      action: d.action,
      fileName: d.fileName ? String(d.fileName).slice(0, 180) : undefined,
      fileData: d.fileData ? String(d.fileData).slice(0, 450_000) : undefined,
      fileKind: d.fileKind ? String(d.fileKind).slice(0, 80) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.markPacket(ctx, data);
    return { ok: true as const };
  });

export const listHrTimeOffFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listTimeOff(ctx, data.employerId);
  });

export const upsertHrTimeOffFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      id?: string;
      employeeId: string;
      employeeName: string;
      kind: string;
      startAt: string;
      endAt: string;
      status?: "requested" | "approved" | "denied";
      notes?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: d.id ? String(d.id).slice(0, 80) : undefined,
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      employeeName: String(d.employeeName ?? "").slice(0, 120),
      kind: String(d.kind ?? "pto").slice(0, 40),
      startAt: String(d.startAt ?? ""),
      endAt: String(d.endAt ?? ""),
      status: d.status,
      notes: d.notes ? String(d.notes).slice(0, 500) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.upsertTimeOff(ctx, data);
  });

export const listHrWriteupsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listWriteups(ctx, data.employerId);
  });

export const addHrWriteupFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      employeeName: string;
      title: string;
      body: string;
      severity: "coaching" | "written" | "final";
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      employeeName: String(d.employeeName ?? "").slice(0, 120),
      title: String(d.title ?? "").slice(0, 160),
      body: String(d.body ?? "").slice(0, 4000),
      severity: d.severity,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.addWriteup(ctx, data);
  });

export const listHrAvailabilityFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: { orgId: string; locationId: string; employerId: string; employeeId: string }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listAvailability(ctx, data.employerId, data.employeeId);
  });

export const setHrAvailabilityFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      rows: { weekday: number; startMin: number; endMin: number }[];
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      rows: Array.isArray(d.rows) ? d.rows.slice(0, 21) : [],
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.setAvailability(ctx, data);
    return { ok: true as const };
  });

export const listHrEligibilityFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listEligibility(ctx, data.employerId);
  });

export const setHrEligibilityFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      minor: boolean;
      alcohol: boolean;
      notes?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      minor: Boolean(d.minor),
      alcohol: Boolean(d.alcohol),
      notes: d.notes ? String(d.notes).slice(0, 500) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.setEligibility(ctx, data);
    return { ok: true as const };
  });

export const saveHrPiiFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      ssn?: string;
      taxJson?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      ssn: d.ssn ? String(d.ssn).slice(0, 20) : undefined,
      taxJson: d.taxJson ? String(d.taxJson).slice(0, 8000) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.savePii(ctx, data);
  });

export const viewHrPiiFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: { orgId: string; locationId: string; employerId: string; employeeId: string }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.viewPii(ctx, data.employerId, data.employeeId);
  });

export const hrPacketFileFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: { orgId: string; locationId: string; employerId: string; id: string }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: String(d.id ?? "").slice(0, 80),
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.packetFile(ctx, data);
  });

export const attachHrI9FileFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      id: string;
      section: 1 | 2 | 3;
      fileName: string;
      fileKind?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      id: String(d.id ?? "").slice(0, 80),
      section: d.section,
      fileName: String(d.fileName ?? "i9.pdf").slice(0, 180),
      fileKind: d.fileKind ? String(d.fileKind).slice(0, 80) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.attachI9File(ctx, data);
    return { ok: true as const };
  });

export const hrPayrollSummaryFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.payrollSummary(ctx, data.employerId);
  });

export const listHrPayrollMapFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; employerId: string }) => ({
    orgId: org(d.orgId),
    locationId: loc(d.locationId),
    employerId: employer(d.employerId),
  }))
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.listPayrollMap(ctx, data.employerId);
  });

export const saveHrPayrollMapFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employeeId: string;
      providerEmployeeId: string;
      provider?: string;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employeeId: String(d.employeeId ?? "").slice(0, 80),
      providerEmployeeId: String(d.providerEmployeeId ?? "").slice(0, 80),
      provider: d.provider ? String(d.provider).slice(0, 20) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    await hr.savePayrollMap(ctx, data);
    return { ok: true as const };
  });

export const hrPayrollExportFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      employerId: string;
      employerName?: string;
      periodStart: string;
      periodEnd: string;
      push?: boolean;
      closeoutNets?: Array<{
        employeeId: string;
        netTipsCents: number;
        poolInCents: number;
        poolOutCents: number;
      }>;
    }) => ({
      orgId: org(d.orgId),
      locationId: loc(d.locationId),
      employerId: employer(d.employerId),
      employerName: d.employerName ? String(d.employerName).slice(0, 120) : undefined,
      periodStart: String(d.periodStart ?? "").slice(0, 10),
      periodEnd: String(d.periodEnd ?? "").slice(0, 10),
      push: Boolean(d.push),
      closeoutNets: Array.isArray(d.closeoutNets)
        ? d.closeoutNets.slice(0, 200).map((n) => ({
            employeeId: String(n?.employeeId ?? "").slice(0, 80),
            netTipsCents: Math.max(0, Math.round(Number(n?.netTipsCents) || 0)),
            poolInCents: Math.max(0, Math.round(Number(n?.poolInCents) || 0)),
            poolOutCents: Math.max(0, Math.round(Number(n?.poolOutCents) || 0)),
          })).filter((n) => n.employeeId)
        : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const hr = await import("./server");
    const ctx = await ctxFor(context.userId, data.orgId, data.locationId);
    return hr.buildPayrollExport(ctx, data);
  });

export type { EntityHrConfig };
