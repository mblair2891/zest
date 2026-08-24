import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AccountSource, AccountStage, ActivityKind, ContactRole, DealStage, InvoiceStatus, TicketPriority, TicketStatus } from "./crm-types";
import type { PlanSlug } from "./types";

export const listCrmAccountsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { q?: string; stage?: string }) => ({
    q: d.q ? String(d.q) : "",
    stage: d.stage ? String(d.stage) : "all",
  }))
  .handler(async ({ context, data }) => {
    const { listAccounts } = await import("./crm.server");
    return listAccounts(context.userId, {
      q: data.q,
      stage: data.stage as AccountStage | "all",
    });
  });

export const getCrmAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string }) => ({ accountId: String(d.accountId ?? "") }))
  .handler(async ({ context, data }) => {
    const { getAccount } = await import("./crm.server");
    return getAccount(context.userId, data.accountId);
  });

export const createCrmLeadFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    amountCents?: number;
    notes?: string;
  }) => ({
    name: String(d.name ?? "").trim(),
    email: d.email ? String(d.email).trim() : undefined,
    phone: d.phone ? String(d.phone).trim() : undefined,
    source: d.source ? String(d.source) : undefined,
    amountCents: Number(d.amountCents) || 0,
    notes: d.notes ? String(d.notes) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { createLead } = await import("./crm.server");
    return createLead(context.userId, {
      ...data,
      source: data.source as AccountSource | undefined,
    });
  });

export const patchCrmAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    accountId: string;
    name?: string;
    stage?: string;
    ownerUserId?: string | null;
    tags?: string[];
    source?: string;
    notes?: string;
  }) => ({
    accountId: String(d.accountId ?? ""),
    name: d.name,
    stage: d.stage,
    ownerUserId: d.ownerUserId,
    tags: d.tags,
    source: d.source,
    notes: d.notes,
  }))
  .handler(async ({ context, data }) => {
    const { patchAccount } = await import("./crm.server");
    await patchAccount(context.userId, data.accountId, {
      name: data.name,
      stage: data.stage as AccountStage | undefined,
      ownerUserId: data.ownerUserId,
      tags: data.tags,
      source: data.source as AccountSource | undefined,
      notes: data.notes,
    });
    return { ok: true };
  });

export const addCrmContactFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string; name: string; email?: string; phone?: string; role?: string }) => ({
    accountId: String(d.accountId ?? ""),
    name: String(d.name ?? "").trim(),
    email: d.email ? String(d.email) : undefined,
    phone: d.phone ? String(d.phone) : undefined,
    role: d.role,
  }))
  .handler(async ({ context, data }) => {
    const { addContact } = await import("./crm.server");
    await addContact(context.userId, {
      ...data,
      role: data.role as ContactRole | undefined,
    });
    return { ok: true };
  });

export const addCrmActivityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string; kind: string; body: string; dueAt?: string | null }) => ({
    accountId: String(d.accountId ?? ""),
    kind: String(d.kind ?? "note"),
    body: String(d.body ?? ""),
    dueAt: d.dueAt ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { addActivity } = await import("./crm.server");
    await addActivity(context.userId, {
      ...data,
      kind: data.kind as ActivityKind,
    });
    return { ok: true };
  });

export const completeCrmActivityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { activityId: string }) => ({ activityId: String(d.activityId ?? "") }))
  .handler(async ({ context, data }) => {
    const { completeActivity } = await import("./crm.server");
    await completeActivity(context.userId, data.activityId);
    return { ok: true };
  });

export const upsertCrmOpportunityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    id?: string;
    accountId: string;
    name: string;
    amountCents: number;
    stage?: string;
    planSlug?: string | null;
    closeDate?: string | null;
    probability?: number;
  }) => ({
    id: d.id,
    accountId: String(d.accountId ?? ""),
    name: String(d.name ?? ""),
    amountCents: Number(d.amountCents) || 0,
    stage: d.stage,
    planSlug: d.planSlug,
    closeDate: d.closeDate,
    probability: d.probability,
  }))
  .handler(async ({ context, data }) => {
    const { upsertOpportunity } = await import("./crm.server");
    await upsertOpportunity(context.userId, {
      ...data,
      stage: data.stage as DealStage | undefined,
      planSlug: data.planSlug as PlanSlug | null | undefined,
    });
    return { ok: true };
  });

export const startCrmOnboardingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string }) => ({ accountId: String(d.accountId ?? "") }))
  .handler(async ({ context, data }) => {
    const { startOnboardingForAccount } = await import("./crm.server");
    return startOnboardingForAccount(context.userId, data.accountId);
  });

export const goLiveCrmAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string }) => ({ accountId: String(d.accountId ?? "") }))
  .handler(async ({ context, data }) => {
    const { goLiveForAccount } = await import("./crm.server");
    return goLiveForAccount(context.userId, data.accountId);
  });

export const listCrmFollowUpsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listFollowUps } = await import("./crm.server");
    return listFollowUps(context.userId);
  });

export const listTenantDirectoryFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listTenantDirectory } = await import("./crm.server");
    return listTenantDirectory(context.userId);
  });

export const getTenantDrillInFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string }) => ({ orgId: String(d.orgId ?? "") }))
  .handler(async ({ context, data }) => {
    const { getTenantDrillIn } = await import("./crm.server");
    return getTenantDrillIn(context.userId, data.orgId);
  });

export const listOnboardingWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listOnboardingWorkspace } = await import("./crm.server");
    return listOnboardingWorkspace(context.userId);
  });

export const listSupportTicketsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { status?: string }) => ({ status: d.status ?? "all" }))
  .handler(async ({ context, data }) => {
    const { listTickets } = await import("./crm.server");
    return listTickets(context.userId, data.status as TicketStatus | "all");
  });

export const createSupportTicketFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { subject: string; accountId?: string; orgId?: string; priority?: string; body?: string }) => ({
    subject: String(d.subject ?? ""),
    accountId: d.accountId,
    orgId: d.orgId,
    priority: d.priority,
    body: d.body,
  }))
  .handler(async ({ context, data }) => {
    const { createTicket } = await import("./crm.server");
    return createTicket(context.userId, {
      ...data,
      priority: data.priority as TicketPriority | undefined,
    });
  });

export const patchSupportTicketFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ticketId: string; status?: string; priority?: string }) => ({
    ticketId: String(d.ticketId ?? ""),
    status: d.status,
    priority: d.priority,
  }))
  .handler(async ({ context, data }) => {
    const { patchTicket } = await import("./crm.server");
    await patchTicket(context.userId, data.ticketId, {
      status: data.status as TicketStatus | undefined,
      priority: data.priority as TicketPriority | undefined,
    });
    return { ok: true };
  });

export const listTicketCommentsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ticketId: string }) => ({ ticketId: String(d.ticketId ?? "") }))
  .handler(async ({ context, data }) => {
    const { listTicketComments } = await import("./crm.server");
    return listTicketComments(context.userId, data.ticketId);
  });

export const addTicketCommentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ticketId: string; body: string }) => ({
    ticketId: String(d.ticketId ?? ""),
    body: String(d.body ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { addTicketComment } = await import("./crm.server");
    await addTicketComment(context.userId, data.ticketId, data.body);
    return { ok: true };
  });

export const listSaasInvoicesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listInvoices } = await import("./crm.server");
    return listInvoices(context.userId);
  });

export const issueSaasInvoiceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; amountCents: number; note?: string }) => ({
    orgId: String(d.orgId ?? ""),
    amountCents: Number(d.amountCents) || 0,
    note: d.note,
  }))
  .handler(async ({ context, data }) => {
    const { issueInvoice } = await import("./crm.server");
    await issueInvoice(context.userId, data);
    return { ok: true };
  });

export const setSaasInvoiceStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { invoiceId: string; status: string }) => ({
    invoiceId: String(d.invoiceId ?? ""),
    status: String(d.status ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { setInvoiceStatus } = await import("./crm.server");
    await setInvoiceStatus(context.userId, data.invoiceId, data.status as InvoiceStatus);
    return { ok: true };
  });

export const saasReportFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { saasReport } = await import("./crm.server");
    return saasReport(context.userId);
  });

export const factoryResetStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { isPlatformAdmin } = await import("./tenancy.server");
    if (!(await isPlatformAdmin(context.userId))) {
      return { enabled: false, reason: "Platform admin only." };
    }
    const { factoryResetStatus } = await import("./factory-reset.server");
    return factoryResetStatus();
  });

export const factoryResetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { confirmPhrase: string; password: string }) => ({
    confirmPhrase: String(d.confirmPhrase ?? ""),
    password: String(d.password ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { factoryReset } = await import("./factory-reset.server");
    return factoryReset({
      userId: context.userId,
      confirmPhrase: data.confirmPhrase,
      password: data.password,
    });
  });

export const listSaasPlansFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listPlans } = await import("./crm.server");
    return listPlans(context.userId);
  });
