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
