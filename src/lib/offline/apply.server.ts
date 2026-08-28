import { getSql } from "@/lib/db";
import type { FlushItem, FlushResult } from "./api";

export async function applyOfflineBatch(
  userId: string,
  items: FlushItem[],
): Promise<{ results: FlushResult[] }> {
  const sql = await getSql();
  const results: FlushResult[] = [];

  for (const item of items) {
    if (!item.clientMutationId || !item.locationId) {
      results.push({
        clientMutationId: item.clientMutationId || "unknown",
        status: "rejected",
        error: "Missing id",
      });
      continue;
    }
    try {
      if (!userId || userId === "demo-offline") {
        results.push({
          clientMutationId: item.clientMutationId,
          status: "rejected",
          error: "Sign in to sync",
        });
        continue;
      }
      const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
      await bindTenant(userId, { locationId: item.locationId });
      const existing = await sql<{ client_mutation_id: string; status: string }>`
        select client_mutation_id, status
        from offline_mutations
        where location_id = ${item.locationId}
          and client_mutation_id = ${item.clientMutationId}
        limit 1
      `;
      if (existing[0]) {
        results.push({
          clientMutationId: item.clientMutationId,
          status: "duplicate",
        });
        continue;
      }

      if (item.kind === "clock_punch") {
        await applyClockPunch(sql, userId, item).catch(() => undefined);
        await sql`
          insert into offline_mutations (
            client_mutation_id, location_id, user_id, kind, payload, status
          ) values (
            ${item.clientMutationId},
            ${item.locationId},
            ${userId},
            ${item.kind},
            ${JSON.stringify(item.payload)}::jsonb,
            ${"applied"}
          )
        `;
        results.push({ clientMutationId: item.clientMutationId, status: "applied" });
        continue;
      }

      if (item.kind === "card_capture") {
        results.push({
          clientMutationId: item.clientMutationId,
          status: "rejected",
          error: "Card requires connection",
        });
        await sql`
          insert into offline_mutations (
            client_mutation_id, location_id, user_id, kind, payload, status, error
          ) values (
            ${item.clientMutationId},
            ${item.locationId},
            ${userId},
            ${item.kind},
            ${JSON.stringify(item.payload)}::jsonb,
            ${"rejected"},
            ${"card_requires_connection"}
          )
        `;
        continue;
      }

      if (item.kind === "settings_patch") {
        results.push({
          clientMutationId: item.clientMutationId,
          status: "conflict",
          error: "Server wins on settings — reopen Location settings online",
        });
        await sql`
          insert into offline_mutations (
            client_mutation_id, location_id, user_id, kind, payload, status, error
          ) values (
            ${item.clientMutationId},
            ${item.locationId},
            ${userId},
            ${item.kind},
            ${JSON.stringify(item.payload)}::jsonb,
            ${"conflict"},
            ${"server_wins_settings"}
          )
        `;
        continue;
      }

      if (item.kind === "cash_ledger") {
        await applyCashLedger(sql, userId, item);
      }
      if (item.kind === "waitlist_add") {
        await applyWaitlist(item).catch(() => undefined);
      }
      if (item.kind === "waitlist_sms") {
        await applyWaitlistSms(item).catch(() => undefined);
      }
      if (
        item.kind === "order_upsert" ||
        item.kind === "ticket_upsert" ||
        item.kind === "ticket_bump" ||
        item.kind === "table_seat"
      ) {
        const { applyFloorOutboxPayload } = await import("@/lib/pos/floor.server");
        await applyFloorOutboxPayload(
          userId,
          item.kind,
          item.locationId,
          item.payload,
          item.clientMutationId,
        );
      }

      await sql`
        insert into offline_mutations (
          client_mutation_id, location_id, user_id, kind, payload, status
        ) values (
          ${item.clientMutationId},
          ${item.locationId},
          ${userId},
          ${item.kind},
          ${JSON.stringify(item.payload)}::jsonb,
          ${"applied"}
        )
      `;
      results.push({ clientMutationId: item.clientMutationId, status: "applied" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "apply failed";
      results.push({
        clientMutationId: item.clientMutationId,
        status: "rejected",
        error: msg,
      });
    }
  }

  return { results };
}

type Sql = Awaited<ReturnType<typeof getSql>>;

async function applyClockPunch(sql: Sql, userId: string, item: FlushItem) {
  const employeeId = String(item.payload.employeeId ?? "").slice(0, 80);
  if (!employeeId) return;
  const clockingOut = Boolean(item.payload.clockingOut);
  const at = Number(item.payload.at) || Date.now();
  const name = String(item.payload.employeeName ?? item.payload.name ?? employeeId).slice(0, 120);
  const locs = await sql<{ org_id: string }>`
    select org_id from locations where id = ${item.locationId} limit 1
  `;
  const orgId = locs[0]?.org_id;
  if (!orgId) return;
  const employerId = String(item.payload.employerId ?? item.payload.operatorId ?? "host").slice(
    0,
    80,
  );
  void userId;
  if (clockingOut) {
    const open = await sql<{ id: string; clock_in_at: unknown }>`
      select id, clock_in_at from location_punches
      where location_id = ${item.locationId}
        and employee_id = ${employeeId}
        and clock_out_at is null
      order by clock_in_at desc
      limit 1
    `;
    const row = open[0];
    if (!row) return;
    const inAt = new Date(row.clock_in_at as string).getTime();
    const mins = Number.isFinite(inAt) ? Math.max(0, Math.round((at - inAt) / 60_000)) : 0;
    const regular = Math.min(480, mins);
    const ot = Math.max(0, mins - 480);
    await sql`
      update location_punches
      set clock_out_at = ${new Date(at).toISOString()},
          status = ${"auto_approved"},
          regular_minutes = ${regular},
          ot_minutes = ${ot},
          updated_at = now()
      where id = ${row.id}
    `;
    return;
  }
  const id = String(item.payload.punchId ?? item.clientMutationId ?? `tp_${employeeId}_${at}`).slice(
    0,
    80,
  );
  await sql`
    insert into location_punches (
      id, org_id, location_id, employer_id, employee_id, employee_name,
      clock_in_at, status
    ) values (
      ${id}, ${orgId}, ${item.locationId}, ${employerId || "host"},
      ${employeeId}, ${name}, ${new Date(at).toISOString()}, ${"open"}
    )
    on conflict (id) do nothing
  `;
}

async function applyCashLedger(sql: Sql, userId: string, item: FlushItem) {
  const orgId = String(item.payload.orgId ?? "");
  const amountCents = Number(item.payload.amountCents) || 0;
  if (!orgId || amountCents <= 0) return;
  const { recordCapturedCard } = await import("@/lib/payments/summex-payments");
  try {
    await recordCapturedCard({
      userId,
      orgId,
      locationId: String(item.payload.locationId ?? item.locationId),
      amountCents,
      last4: "cash",
    });
  } catch {
    /* demo / missing org — mutation row still records the cash close */
  }
  void sql;
}

async function applyWaitlist(item: FlushItem) {
  const name = String(item.payload.name ?? "").trim();
  const phone = String(item.payload.phone ?? "").trim();
  if (!name) return;
  const { joinWaitlist } = await import("@/lib/front/store.server");
  await joinWaitlist({
    locationId: item.locationId,
    name,
    phone: phone || "0000000000",
    partySize: Number(item.payload.partySize) || 2,
  });
}

async function applyWaitlistSms(item: FlushItem) {
  const to = String(item.payload.phone ?? "").trim();
  const body = String(item.payload.body ?? "").trim();
  if (!to || !body) return;
  const { sendSms } = await import("@/lib/front/messaging.server");
  await sendSms({
    to,
    body,
    kind: "waitlist_join",
    locationId: item.locationId,
  });
}
