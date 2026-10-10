/**
 * Paid Quantum Payments transfers close the guest check and leave a notice
 * for the assigned server. Failed transfers leave the check open.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { parseFinixWebhook, transferClosesCheck, type ParsedFinixEvent } from "./finix-events";

type PayRow = {
  id: string;
  check_id: string | null;
  location_id: string | null;
  org_id: string;
  amount_cents: number;
  capture_mode: string | null;
  status: string;
  last4: string | null;
};

async function findPayment(event: ParsedFinixEvent): Promise<PayRow | null> {
  const sql = await getSql();
  const resourceId = event.resourceId || "";
  const authorizationId = event.authorizationId || "";
  if (resourceId || authorizationId) {
    const rows = await sql<PayRow>`
      select id, check_id, location_id, org_id, amount_cents, capture_mode, status, last4
      from summex_payments
      where processor = ${"quantum_payments"}
        and (
          processor_payment_id = ${resourceId}
          or processor_payment_id = ${authorizationId}
        )
      order by created_at desc
      limit 1
    `;
    if (rows[0]) return rows[0];
  }
  if (event.checkId) {
    const rows = await sql<PayRow>`
      select id, check_id, location_id, org_id, amount_cents, capture_mode, status, last4
      from summex_payments
      where processor = ${"quantum_payments"}
        and check_id = ${event.checkId}
        and status = ${"authorized"}
      order by created_at desc
      limit 1
    `;
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function applyFinixRailEvent(event: unknown): Promise<{
  closed: boolean;
  notified: boolean;
  failed: boolean;
}> {
  const parsed = parseFinixWebhook(event);
  if (parsed.kind === "transfer" && parsed.failed) {
    const payment = await findPayment(parsed);
    if (payment) {
      const sql = await getSql();
      await sql`
        update summex_payments
        set status = ${"failed"}
        where id = ${payment.id} and status = ${"authorized"}
      `;
    }
    return { closed: false, notified: false, failed: true };
  }
  if (parsed.kind === "authorization") {
    const payment = await findPayment(parsed);
    if (payment && parsed.failed) {
      const sql = await getSql();
      await sql`
        update summex_payments
        set status = ${"failed"}
        where id = ${payment.id} and status = ${"authorized"}
      `;
    }
    return { closed: false, notified: false, failed: parsed.failed };
  }
  if (!transferClosesCheck(parsed)) {
    return { closed: false, notified: false, failed: false };
  }
  const payment = await findPayment(parsed);
  const checkId = payment?.check_id || parsed.checkId;
  if (!checkId || !payment?.location_id) {
    return { closed: false, notified: false, failed: false };
  }
  const sql = await getSql();
  const now = Date.now();
  const closed = await sql<{
    id: string;
    server_id: string;
    server_name: string;
    table_id: string | null;
    number: number | string;
    location_id: string;
  }>`
    update pos_checks set
      status = ${"closed"},
      closed_at_ms = ${now},
      updated_at_ms = ${now}
    where id = ${checkId}
      and location_id = ${payment.location_id}
      and status = ${"open"}
    returning id, server_id, server_name, table_id, number, location_id
  `;
  const row = closed[0];
  if (!row) return { closed: false, notified: false, failed: false };

  const transferId = parsed.resourceId || payment.id;
  await sql`
    update summex_payments set
      status = ${"captured"},
      processor_payment_id = ${transferId}
    where id = ${payment.id}
  `;
  const payId = newId("pay");
  await sql`
    insert into pos_check_payments (
      id, check_id, location_id, method, amount_cents, tip_cents,
      last4, employee_id, processor, charge_brand, sandbox, at_ms
    ) values (
      ${payId},
      ${row.id},
      ${row.location_id},
      ${"card"},
      ${payment.amount_cents},
      ${0},
      ${payment.last4},
      ${row.server_id || ""},
      ${"quantum_payments"},
      ${"Quantum Payments"},
      ${payment.capture_mode !== "live"},
      ${now}
    )
    on conflict (id) do nothing
  `;
  const label = row.table_id || String(row.number);
  await sql`
    insert into pos_ticket_events (
      id, location_id, ticket_id, check_id, kind, actor_id, actor_name, at_ms, payload
    ) values (
      ${newId("tev")},
      ${row.location_id},
      ${row.id},
      ${row.id},
      ${"quantum_paid"},
      ${row.server_id || null},
      ${row.server_name || null},
      ${now},
      ${JSON.stringify({
        title: `Table ${label} paid — Quantum Payments`,
        body: `Check #${row.number} closed`,
        serverId: row.server_id,
        serverName: row.server_name,
        tableLabel: label,
      })}::jsonb
    )
  `;
  if (row.table_id) {
    await sql`
      update pos_table_status set
        status = ${"closed_not_cleaned"},
        status_since_ms = ${now},
        updated_at_ms = ${now}
      where location_id = ${row.location_id} and check_id = ${row.id}
    `;
  }
  return { closed: true, notified: true, failed: false };
}
