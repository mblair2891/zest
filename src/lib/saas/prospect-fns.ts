import { createServerFn } from "@tanstack/react-start";
import { uid } from "@/lib/utils";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  type IntakeAnswers,
  type OnboardingPayload,
  type OnboardingSteps,
  type PricingRules,
  type ProspectRecord,
  type ProspectStatus,
  type QuoteSnapshot,
  emptyAnswers,
  emptyOnboardingPayload,
  emptyOnboardingSteps,
  liveReady,
} from "./prospect-types";
import { DEFAULT_PRICING_RULES, buildQuote } from "./pricing-engine";

type ProspectRow = {
  id: string;
  public_token: string;
  status: string;
  billing_email: string | null;
  company_json: string;
  answers_json: string;
  quote_json: string | null;
  quote_issued_at: string | null;
  accepted_at: string | null;
  contracted_at: string | null;
  contract_signed_by: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ts(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

function mapProspect(
  row: ProspectRow,
  onboarding: ProspectRecord["onboarding"],
): ProspectRecord {
  return {
    id: row.id,
    publicToken: row.public_token,
    status: row.status as ProspectStatus,
    billingEmail: row.billing_email ?? "",
    company: parseJson(row.company_json, emptyAnswers().company),
    answers: parseJson(row.answers_json, emptyAnswers()),
    quote: parseJson<QuoteSnapshot | null>(row.quote_json, null),
    quoteIssuedAt: ts(row.quote_issued_at),
    acceptedAt: ts(row.accepted_at),
    contractedAt: ts(row.contracted_at),
    contractSignedBy: row.contract_signed_by ?? "",
    orgId: row.org_id ?? "",
    createdAt: ts(row.created_at) ?? Date.now(),
    updatedAt: ts(row.updated_at) ?? Date.now(),
    onboarding,
  };
}

async function requireAdmin(userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    select user_id from platform_admin where user_id = ${userId} limit 1
  `;
  if (!rows[0]) throw new Error("Forbidden");
}

async function audit(
  prospectId: string | null,
  actor: string,
  action: string,
  detail: string,
) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    insert into audit_events (id, prospect_id, actor, action, detail)
    values (${uid("aud")}, ${prospectId}, ${actor}, ${action}, ${detail})
  `;
}

async function loadOnboarding(
  prospectId: string,
): Promise<ProspectRecord["onboarding"]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    steps_json: string;
    payload_json: string;
  }>`
    select id, steps_json, payload_json from onboarding_runs
    where prospect_id = ${prospectId}
    order by created_at desc
    limit 1
  `;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    steps: parseJson(rows[0].steps_json, emptyOnboardingSteps()),
    payload: parseJson(rows[0].payload_json, emptyOnboardingPayload()),
  };
}

async function loadById(id: string): Promise<ProspectRecord | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<ProspectRow>`
    select * from prospects where id = ${id} limit 1
  `;
  if (!rows[0]) return null;
  return mapProspect(rows[0], await loadOnboarding(id));
}

async function loadByToken(token: string): Promise<ProspectRecord | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<ProspectRow>`
    select * from prospects where public_token = ${token} limit 1
  `;
  if (!rows[0]) return null;
  return mapProspect(rows[0], await loadOnboarding(rows[0].id));
}

async function getRules(): Promise<PricingRules> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ rules_json: string }>`
    select rules_json from pricing_rules where id = ${"default"} limit 1
  `;
  if (!rows[0]) {
    await sql`
      insert into pricing_rules (id, rules_json)
      values (${"default"}, ${JSON.stringify(DEFAULT_PRICING_RULES)})
      on conflict (id) do nothing
    `;
    return DEFAULT_PRICING_RULES;
  }
  return parseJson(rows[0].rules_json, DEFAULT_PRICING_RULES);
}

export const createProspect = createServerFn({ method: "POST" }).handler(
  async () => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = uid("pro");
    const token = uid("ptk");
    const answers = emptyAnswers();
    await sql`
      insert into prospects (id, public_token, status, company_json, answers_json)
      values (
        ${id},
        ${token},
        ${"prospect"},
        ${JSON.stringify(answers.company)},
        ${JSON.stringify(answers)}
      )
    `;
    await audit(id, "prospect", "created", "Intake started");
    const rec = await loadById(id);
    if (!rec) throw new Error("Failed to create prospect");
    return rec;
  },
);

export const getProspectByToken = createServerFn({ method: "GET" })
  .validator((token: string) => String(token || ""))
  .handler(async ({ data: token }) => {
    if (!token) return null;
    return loadByToken(token);
  });

export const saveProspectAnswers = createServerFn({ method: "POST" })
  .validator((input: { token: string; answers: IntakeAnswers }) => input)
  .handler(async ({ data }) => {
    const rec = await loadByToken(data.token);
    if (!rec) throw new Error("Prospect not found");
    if (rec.status !== "prospect") {
      throw new Error("Intake is locked after a quote is issued");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const answers = data.answers;
    await sql`
      update prospects set
        answers_json = ${JSON.stringify(answers)},
        company_json = ${JSON.stringify(answers.company)},
        billing_email = ${answers.company.billingEmail},
        updated_at = now()
      where id = ${rec.id}
    `;
    return loadById(rec.id);
  });

export const submitProspectQuote = createServerFn({ method: "POST" })
  .validator((token: string) => String(token || ""))
  .handler(async ({ data: token }) => {
    const rec = await loadByToken(token);
    if (!rec) throw new Error("Prospect not found");
    if (rec.status !== "prospect" && rec.status !== "quoted") {
      throw new Error("Cannot re-quote in the current status");
    }
    if (!rec.answers.company.legalName.trim()) {
      throw new Error("Legal name is required");
    }
    if (!rec.answers.company.billingEmail.trim()) {
      throw new Error("Billing email is required");
    }
    if (!rec.answers.zestPaymentsAck) {
      throw new Error("Acknowledge Zest Payments to receive a quote");
    }
    const rules = await getRules();
    const quote = buildQuote(rec.answers, rules);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set
        status = ${"quoted"},
        quote_json = ${JSON.stringify(quote)},
        quote_issued_at = now(),
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, "system", "quoted", `Monthly $${(quote.monthlyCents / 100).toFixed(2)}`);
    return loadById(rec.id);
  });

export const acceptQuote = createServerFn({ method: "POST" })
  .validator((token: string) => String(token || ""))
  .handler(async ({ data: token }) => {
    const rec = await loadByToken(token);
    if (!rec) throw new Error("Prospect not found");
    if (rec.status !== "quoted") throw new Error("No open quote to accept");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set
        status = ${"accepted"},
        accepted_at = now(),
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, "prospect", "accepted", "Quote accepted; contract pending");
    return loadById(rec.id);
  });

export const saveOnboarding = createServerFn({ method: "POST" })
  .validator(
    (input: {
      token: string;
      payload: OnboardingPayload;
      steps: OnboardingSteps;
    }) => input,
  )
  .handler(async ({ data }) => {
    const rec = await loadByToken(data.token);
    if (!rec) throw new Error("Prospect not found");
    if (
      rec.status !== "contracted" &&
      rec.status !== "onboarding" &&
      rec.status !== "live"
    ) {
      throw new Error("Onboarding unlocks after the contract is signed");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let runId = rec.onboarding?.id;
    if (!runId) {
      runId = uid("obr");
      await sql`
        insert into onboarding_runs (id, prospect_id, steps_json, payload_json)
        values (
          ${runId},
          ${rec.id},
          ${JSON.stringify(data.steps)},
          ${JSON.stringify(data.payload)}
        )
      `;
    } else {
      await sql`
        update onboarding_runs set
          steps_json = ${JSON.stringify(data.steps)},
          payload_json = ${JSON.stringify(data.payload)},
          updated_at = now()
        where id = ${runId}
      `;
    }
    const nextStatus: ProspectStatus = liveReady(data.payload, data.steps)
      ? "live"
      : "onboarding";
    await sql`
      update prospects set status = ${nextStatus}, updated_at = now()
      where id = ${rec.id}
    `;
    if (nextStatus !== rec.status) {
      await audit(rec.id, "prospect", nextStatus, "Onboarding progress");
    }
    return loadById(rec.id);
  });

export const attachOrgId = createServerFn({ method: "POST" })
  .validator((input: { token: string; orgId: string }) => input)
  .handler(async ({ data }) => {
    const rec = await loadByToken(data.token);
    if (!rec) throw new Error("Prospect not found");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set org_id = ${data.orgId}, updated_at = now()
      where id = ${rec.id}
    `;
    return loadById(rec.id);
  });

export const listProspects = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<ProspectRow>`
      select * from prospects order by updated_at desc
    `;
    const out: ProspectRecord[] = [];
    for (const row of rows) {
      out.push(mapProspect(row, await loadOnboarding(row.id)));
    }
    return out;
  });

export const getProspectAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ context, data: id }) => {
    await requireAdmin(context.userId);
    return loadById(id);
  });

export const adminSaveAnswers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; answers: IntakeAnswers }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const rec = await loadById(data.id);
    if (!rec) throw new Error("Not found");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set
        answers_json = ${JSON.stringify(data.answers)},
        company_json = ${JSON.stringify(data.answers.company)},
        billing_email = ${data.answers.company.billingEmail},
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, context.userId, "answers_edited", "Admin edited intake");
    return loadById(rec.id);
  });

export const adminReissueQuote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ context, data: id }) => {
    await requireAdmin(context.userId);
    const rec = await loadById(id);
    if (!rec) throw new Error("Not found");
    const rules = await getRules();
    const quote = buildQuote(rec.answers, rules);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set
        status = ${rec.status === "prospect" ? "quoted" : rec.status},
        quote_json = ${JSON.stringify(quote)},
        quote_issued_at = now(),
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, context.userId, "quoted", "Admin re-issued quote");
    return loadById(rec.id);
  });

export const adminPatchQuote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; quote: QuoteSnapshot }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const rec = await loadById(data.id);
    if (!rec) throw new Error("Not found");
    const quote = {
      ...data.quote,
      monthlyCents: data.quote.lines
        .filter((l) => l.recurring === "monthly")
        .reduce((s, l) => s + l.amountCents, 0),
      oneTimeCents: data.quote.lines
        .filter((l) => l.recurring === "one_time")
        .reduce((s, l) => s + l.amountCents, 0),
    };
    quote.annualCents = Math.round(quote.monthlyCents * 12 * 0.9);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set
        quote_json = ${JSON.stringify(quote)},
        quote_issued_at = now(),
        status = ${rec.status === "prospect" ? "quoted" : rec.status},
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, context.userId, "quote_edited", "Admin adjusted line items");
    return loadById(rec.id);
  });

export const markContractSigned = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ context, data: id }) => {
    await requireAdmin(context.userId);
    const rec = await loadById(id);
    if (!rec) throw new Error("Not found");
    if (rec.status !== "accepted" && rec.status !== "quoted") {
      throw new Error("Contract signing requires an accepted (or quoted) prospect");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const payload = emptyOnboardingPayload(rec.answers);
    const runId = rec.onboarding?.id ?? uid("obr");
    if (!rec.onboarding) {
      await sql`
        insert into onboarding_runs (id, prospect_id, steps_json, payload_json)
        values (
          ${runId},
          ${rec.id},
          ${JSON.stringify(emptyOnboardingSteps())},
          ${JSON.stringify(payload)}
        )
      `;
    }
    await sql`
      update prospects set
        status = ${"onboarding"},
        contracted_at = now(),
        contract_signed_by = ${context.userId},
        updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, context.userId, "contracted", "Contract marked signed");
    return loadById(rec.id);
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: ProspectStatus }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const rec = await loadById(data.id);
    if (!rec) throw new Error("Not found");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update prospects set status = ${data.status}, updated_at = now()
      where id = ${rec.id}
    `;
    await audit(rec.id, context.userId, "status", `→ ${data.status}`);
    return loadById(rec.id);
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((prospectId: string) => String(prospectId || ""))
  .handler(async ({ context, data: prospectId }) => {
    await requireAdmin(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      prospect_id: string | null;
      actor: string;
      action: string;
      detail: string | null;
      created_at: string;
    }>`
      select * from audit_events
      where prospect_id = ${prospectId}
      order by created_at desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      prospectId: r.prospect_id,
      actor: r.actor,
      action: r.action,
      detail: r.detail ?? "",
      createdAt: ts(r.created_at) ?? Date.now(),
    }));
  });

export const getPricingRulesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return getRules();
  });

export const savePricingRules = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((rules: PricingRules) => rules)
  .handler(async ({ context, data: rules }) => {
    await requireAdmin(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into pricing_rules (id, rules_json, updated_at)
      values (${"default"}, ${JSON.stringify(rules)}, now())
      on conflict (id) do update set
        rules_json = excluded.rules_json,
        updated_at = now()
    `;
    await audit(null, context.userId, "pricing_rules", rules.version);
    return rules;
  });
