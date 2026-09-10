import { getSql } from "@/lib/db";
import type { TillTransfer, TillTransferAudit } from "./till-transfer";
import type { TillDenomQty } from "./till-closeout";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToTransfer(r: Record<string, unknown>): TillTransfer {
  return {
    id: String(r.id),
    locationId: String(r.location_id),
    status: String(r.status) as TillTransfer["status"],
    fromSinkKey: String(r.from_sink_key),
    fromTillName: String(r.from_till_name ?? ""),
    fromEmployeeId: String(r.from_employee_id ?? ""),
    fromEmployeeName: String(r.from_employee_name ?? ""),
    toSinkKey: String(r.to_sink_key),
    toTillName: String(r.to_till_name ?? ""),
    toEmployeeId: String(r.to_employee_id ?? ""),
    toEmployeeName: String(r.to_employee_name ?? ""),
    amountCents: num(r.amount_cents) ?? 0,
    requestedMix: (r.requested_mix && typeof r.requested_mix === "object"
      ? r.requested_mix
      : {}) as TillDenomQty,
    handedMix: (r.handed_mix && typeof r.handed_mix === "object"
      ? r.handed_mix
      : {}) as TillDenomQty,
    note: r.note ? String(r.note) : undefined,
    requestedAt: num(r.requested_at_ms) ?? 0,
    resolvedAt: num(r.resolved_at_ms) ?? undefined,
    reverseOfId: r.reverse_of_id ? String(r.reverse_of_id) : undefined,
    reverseId: r.reverse_id ? String(r.reverse_id) : undefined,
    reversedById: r.reversed_by_id ? String(r.reversed_by_id) : undefined,
    reversedByName: r.reversed_by_name ? String(r.reversed_by_name) : undefined,
    reprintCount: num(r.reprint_count) ?? 0,
    printOk: Boolean(r.print_ok),
    lastPrintedAt: num(r.last_printed_at_ms) ?? undefined,
    updatedAt: num(r.updated_at_ms) ?? 0,
    acceptedById: r.accepted_by_id ? String(r.accepted_by_id) : undefined,
    acceptedByName: r.accepted_by_name ? String(r.accepted_by_name) : undefined,
  };
}

export async function upsertTillTransferServer(opts: {
  orgId: string;
  locationId: string;
  row: TillTransfer;
  events?: TillTransferAudit[];
  ip?: string;
}): Promise<void> {
  const sql = await getSql();
  const t = opts.row;
  await sql`
    insert into pos_till_transfers (
      id, location_id, org_id, status,
      from_sink_key, from_till_name, from_employee_id, from_employee_name,
      to_sink_key, to_till_name, to_employee_id, to_employee_name,
      amount_cents, requested_mix, handed_mix, note,
      requested_at_ms, resolved_at_ms, reverse_of_id, reverse_id,
      reversed_by_id, reversed_by_name, reprint_count, print_ok,
      last_printed_at_ms, accepted_by_id, accepted_by_name, updated_at_ms, ip
    ) values (
      ${t.id}, ${opts.locationId}, ${opts.orgId}, ${t.status},
      ${t.fromSinkKey}, ${t.fromTillName}, ${t.fromEmployeeId}, ${t.fromEmployeeName},
      ${t.toSinkKey}, ${t.toTillName}, ${t.toEmployeeId}, ${t.toEmployeeName},
      ${t.amountCents}, ${JSON.stringify(t.requestedMix ?? {})}::jsonb,
      ${JSON.stringify(t.handedMix ?? {})}::jsonb, ${t.note ?? null},
      ${t.requestedAt}, ${t.resolvedAt ?? null}, ${t.reverseOfId ?? null}, ${t.reverseId ?? null},
      ${t.reversedById ?? null}, ${t.reversedByName ?? null}, ${t.reprintCount}, ${t.printOk},
      ${t.lastPrintedAt ?? null}, ${t.acceptedById ?? null}, ${t.acceptedByName ?? null},
      ${t.updatedAt}, ${opts.ip ?? null}
    )
    on conflict (id) do update set
      status = excluded.status,
      from_employee_id = excluded.from_employee_id,
      from_employee_name = excluded.from_employee_name,
      handed_mix = excluded.handed_mix,
      note = excluded.note,
      resolved_at_ms = excluded.resolved_at_ms,
      reverse_of_id = excluded.reverse_of_id,
      reverse_id = excluded.reverse_id,
      reversed_by_id = excluded.reversed_by_id,
      reversed_by_name = excluded.reversed_by_name,
      reprint_count = excluded.reprint_count,
      print_ok = excluded.print_ok,
      last_printed_at_ms = excluded.last_printed_at_ms,
      accepted_by_id = excluded.accepted_by_id,
      accepted_by_name = excluded.accepted_by_name,
      updated_at_ms = excluded.updated_at_ms,
      ip = excluded.ip
  `;
  for (const ev of opts.events ?? []) {
    await sql`
      insert into pos_till_transfer_audit (
        id, location_id, org_id, transfer_id, at_ms, kind, employee_id, employee_name, detail
      ) values (
        ${ev.id}, ${opts.locationId}, ${opts.orgId}, ${ev.transferId}, ${ev.at},
        ${ev.kind}, ${ev.employeeId}, ${ev.employeeName}, ${ev.detail}
      )
      on conflict (id) do nothing
    `;
  }
}

export async function listTillTransfersServer(
  locationId: string,
  sinceMs?: number,
): Promise<TillTransfer[]> {
  const sql = await getSql();
  const since = sinceMs && sinceMs > 0 ? sinceMs : Date.now() - 36 * 3600 * 1000;
  const rows = await sql<Record<string, unknown>>`
    select * from pos_till_transfers
    where location_id = ${locationId} and updated_at_ms >= ${since}
    order by requested_at_ms desc
    limit 200
  `;
  return rows.map(rowToTransfer);
}
