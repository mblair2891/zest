import { getSql } from "@/lib/db";
import { getRequest } from "@tanstack/react-start/server";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import { loadEntityWriteContext } from "@/lib/access/assert-entity.server";
import { uid } from "@/lib/utils";
import {
  applyAccept,
  applyCountAttempt,
  applyCounterfeitPull,
  applyOpeningBankCorrection,
  applyRecount,
  blocksCashSales,
  canStartTillClose,
  canViewTillRecord,
  isBlindPhase,
  isCountLocked,
  isManagerTillRole,
  parseDenomCounts,
  parseTransferLines,
  snapshotExpected,
  tillCloseFromHandling,
  toBlindScreen,
  toResult,
  type BlindCountScreen,
  type CountSubmitInput,
  type ExpectedSnapshot,
  type TillAuditEvent,
  type TillCloseRecord,
  type TillCloseResult,
  type TillCloseStatus,
} from "./till-closeout";
import { parseCashHandling } from "./cash-handling";
import type { EmployeeRole } from "./types";

type Row = {
  id: string;
  location_id: string;
  org_id: string;
  drawer_id: string;
  drawer_name: string;
  sink_type: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  status: string;
  count_mode: string;
  denomination_required: boolean;
  next_shift_bank_cents: number;
  denoms: unknown;
  counted_cents: number | null;
  turn_in_cents: number | null;
  bank_left_cents: number | null;
  over_short_cents: number | null;
  checks_cents: number;
  money_orders_cents: number;
  bag_number: string | null;
  comment: string | null;
  manager_note: string | null;
  witness_employee_id: string | null;
  witness_employee_name: string | null;
  started_at_ms: number;
  submitted_at_ms: number | null;
  accepted_at_ms: number | null;
  accepted_by_id: string | null;
  accepted_by_name: string | null;
  dropped_at_ms: number | null;
  dropped_by_id: string | null;
  voided_at_ms: number | null;
  voided_by_id: string | null;
  recount_of_id: string | null;
  recount_count: number;
  device_id: string | null;
  ip: string | null;
  cash_blocked: boolean;
  opening_bank_corrected_cents: number | null;
  counterfeit_pulled_cents: number;
  opening_bank_cents: number;
  cash_sales_cents: number;
  cash_refunds_cents: number;
  paid_outs_cents: number;
  paid_ins_cents: number;
  drops_cents: number;
  expected_cents: number;
  transfers_in_cents?: number;
  transfers_out_cents?: number;
  transfer_lines?: unknown;
  slip_print_ok?: boolean;
  slip_printed_at_ms?: number | null;
  slip_reprint_count?: number;
  print_override_reason?: string | null;
  print_override_by_id?: string | null;
  print_override_by_name?: string | null;
  first_counted_cents?: number | null;
  first_submitted_at_ms?: number | null;
  denom_counted_cents?: number | null;
  manager_ack_at_ms?: number | null;
  manager_ack_by_id?: string | null;
  notify_sent_at_ms?: number | null;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

function rowToRecord(r: Row): TillCloseRecord {
  const expected: ExpectedSnapshot = {
    openingBankCents: n(r.opening_bank_cents),
    cashSalesCents: n(r.cash_sales_cents),
    cashRefundsCents: n(r.cash_refunds_cents),
    paidOutsCents: n(r.paid_outs_cents),
    paidInsCents: n(r.paid_ins_cents),
    dropsCents: n(r.drops_cents),
    transfersInCents: n(r.transfers_in_cents),
    transfersOutCents: n(r.transfers_out_cents),
    transferLines: parseTransferLines(r.transfer_lines),
    expectedCents: n(r.expected_cents),
  };
  return {
    id: r.id,
    locationId: r.location_id,
    drawerId: r.drawer_id,
    drawerName: r.drawer_name,
    sinkType: r.sink_type === "bank" ? "bank" : "drawer",
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeRole: r.employee_role,
    status: r.status as TillCloseStatus,
    countMode: r.count_mode === "turn_in" ? "turn_in" : "full_drawer",
    denominationRequired: bool(r.denomination_required),
    nextShiftBankCents: n(r.next_shift_bank_cents),
    denoms: r.denoms ? parseDenomCounts(r.denoms) : null,
    countedCents: nNull(r.counted_cents),
    turnInCents: nNull(r.turn_in_cents),
    bankLeftCents: nNull(r.bank_left_cents),
    overShortCents: nNull(r.over_short_cents),
    checksCents: n(r.checks_cents),
    moneyOrdersCents: n(r.money_orders_cents),
    bagNumber: r.bag_number,
    comment: r.comment,
    managerNote: r.manager_note,
    witnessEmployeeId: r.witness_employee_id,
    witnessEmployeeName: r.witness_employee_name,
    startedAt: n(r.started_at_ms),
    submittedAt: nNull(r.submitted_at_ms),
    acceptedAt: nNull(r.accepted_at_ms),
    acceptedById: r.accepted_by_id,
    acceptedByName: r.accepted_by_name,
    droppedAt: nNull(r.dropped_at_ms),
    droppedById: r.dropped_by_id,
    voidedAt: nNull(r.voided_at_ms),
    voidedById: r.voided_by_id,
    recountOfId: r.recount_of_id,
    recountCount: n(r.recount_count),
    deviceId: r.device_id,
    ip: r.ip,
    cashBlocked: bool(r.cash_blocked),
    openingBankCorrectedCents: nNull(r.opening_bank_corrected_cents),
    counterfeitPulledCents: n(r.counterfeit_pulled_cents),
    expected,
    slipPrintOk: bool(r.slip_print_ok),
    slipPrintedAt: nNull(r.slip_printed_at_ms),
    slipReprintCount: n(r.slip_reprint_count),
    printOverrideReason: r.print_override_reason ?? null,
    printOverrideById: r.print_override_by_id ?? null,
    printOverrideByName: r.print_override_by_name ?? null,
    firstCountedCents: nNull(r.first_counted_cents),
    firstSubmittedAt: nNull(r.first_submitted_at_ms),
    denomCountedCents: nNull(r.denom_counted_cents),
    managerAckAt: nNull(r.manager_ack_at_ms),
    managerAckById: r.manager_ack_by_id ?? null,
    notifySentAt: nNull(r.notify_sent_at_ms),
  };
}

async function requestMeta(): Promise<{ ip: string | null }> {
  try {
    const req = getRequest();
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const real = req.headers.get("x-real-ip")?.trim();
    return { ip: (fwd || real || "").slice(0, 80) || null };
  } catch {
    return { ip: null };
  }
}

async function persist(rec: TillCloseRecord, orgId: string): Promise<void> {
  const sql = await getSql();
  const exp = rec.expected;
  await sql`
    insert into till_closeouts (
      id, location_id, org_id, drawer_id, drawer_name, sink_type,
      employee_id, employee_name, employee_role, status, count_mode,
      denomination_required, next_shift_bank_cents, denoms,
      counted_cents, turn_in_cents, bank_left_cents, over_short_cents,
      checks_cents, money_orders_cents, bag_number, comment, manager_note,
      witness_employee_id, witness_employee_name,
      started_at_ms, submitted_at_ms, accepted_at_ms, accepted_by_id, accepted_by_name,
      dropped_at_ms, dropped_by_id, voided_at_ms, voided_by_id,
      recount_of_id, recount_count, device_id, ip, cash_blocked,
      opening_bank_corrected_cents, counterfeit_pulled_cents,
      opening_bank_cents, cash_sales_cents, cash_refunds_cents,
      paid_outs_cents, paid_ins_cents, drops_cents, expected_cents,
      transfers_in_cents, transfers_out_cents, transfer_lines,
      slip_print_ok, slip_printed_at_ms, slip_reprint_count,
      print_override_reason, print_override_by_id, print_override_by_name,
      first_counted_cents, first_submitted_at_ms, denom_counted_cents,
      manager_ack_at_ms, manager_ack_by_id, notify_sent_at_ms
    ) values (
      ${rec.id}, ${rec.locationId}, ${orgId}, ${rec.drawerId}, ${rec.drawerName}, ${rec.sinkType},
      ${rec.employeeId}, ${rec.employeeName}, ${rec.employeeRole}, ${rec.status}, ${rec.countMode},
      ${rec.denominationRequired}, ${rec.nextShiftBankCents}, ${JSON.stringify(rec.denoms ?? {})}::jsonb,
      ${rec.countedCents}, ${rec.turnInCents}, ${rec.bankLeftCents}, ${rec.overShortCents},
      ${rec.checksCents}, ${rec.moneyOrdersCents}, ${rec.bagNumber}, ${rec.comment}, ${rec.managerNote},
      ${rec.witnessEmployeeId}, ${rec.witnessEmployeeName},
      ${rec.startedAt}, ${rec.submittedAt}, ${rec.acceptedAt}, ${rec.acceptedById}, ${rec.acceptedByName},
      ${rec.droppedAt}, ${rec.droppedById}, ${rec.voidedAt}, ${rec.voidedById},
      ${rec.recountOfId}, ${rec.recountCount}, ${rec.deviceId}, ${rec.ip}, ${rec.cashBlocked},
      ${rec.openingBankCorrectedCents}, ${rec.counterfeitPulledCents},
      ${exp?.openingBankCents ?? 0}, ${exp?.cashSalesCents ?? 0}, ${exp?.cashRefundsCents ?? 0},
      ${exp?.paidOutsCents ?? 0}, ${exp?.paidInsCents ?? 0}, ${exp?.dropsCents ?? 0}, ${exp?.expectedCents ?? 0},
      ${exp?.transfersInCents ?? 0}, ${exp?.transfersOutCents ?? 0}, ${JSON.stringify(exp?.transferLines ?? [])}::jsonb,
      ${rec.slipPrintOk}, ${rec.slipPrintedAt}, ${rec.slipReprintCount},
      ${rec.printOverrideReason}, ${rec.printOverrideById}, ${rec.printOverrideByName},
      ${rec.firstCountedCents}, ${rec.firstSubmittedAt}, ${rec.denomCountedCents},
      ${rec.managerAckAt}, ${rec.managerAckById}, ${rec.notifySentAt}
    )
    on conflict (id) do update set
      status = excluded.status,
      denoms = excluded.denoms,
      counted_cents = excluded.counted_cents,
      turn_in_cents = excluded.turn_in_cents,
      bank_left_cents = excluded.bank_left_cents,
      over_short_cents = excluded.over_short_cents,
      checks_cents = excluded.checks_cents,
      money_orders_cents = excluded.money_orders_cents,
      bag_number = excluded.bag_number,
      comment = excluded.comment,
      manager_note = excluded.manager_note,
      witness_employee_id = excluded.witness_employee_id,
      witness_employee_name = excluded.witness_employee_name,
      submitted_at_ms = excluded.submitted_at_ms,
      accepted_at_ms = excluded.accepted_at_ms,
      accepted_by_id = excluded.accepted_by_id,
      accepted_by_name = excluded.accepted_by_name,
      dropped_at_ms = excluded.dropped_at_ms,
      dropped_by_id = excluded.dropped_by_id,
      voided_at_ms = excluded.voided_at_ms,
      voided_by_id = excluded.voided_by_id,
      recount_of_id = excluded.recount_of_id,
      recount_count = excluded.recount_count,
      cash_blocked = excluded.cash_blocked,
      opening_bank_corrected_cents = excluded.opening_bank_corrected_cents,
      counterfeit_pulled_cents = excluded.counterfeit_pulled_cents,
      opening_bank_cents = excluded.opening_bank_cents,
      cash_sales_cents = excluded.cash_sales_cents,
      cash_refunds_cents = excluded.cash_refunds_cents,
      paid_outs_cents = excluded.paid_outs_cents,
      paid_ins_cents = excluded.paid_ins_cents,
      drops_cents = excluded.drops_cents,
      expected_cents = excluded.expected_cents,
      transfers_in_cents = excluded.transfers_in_cents,
      transfers_out_cents = excluded.transfers_out_cents,
      transfer_lines = excluded.transfer_lines,
      next_shift_bank_cents = excluded.next_shift_bank_cents,
      slip_print_ok = excluded.slip_print_ok,
      slip_printed_at_ms = excluded.slip_printed_at_ms,
      slip_reprint_count = excluded.slip_reprint_count,
      print_override_reason = excluded.print_override_reason,
      print_override_by_id = excluded.print_override_by_id,
      print_override_by_name = excluded.print_override_by_name,
      first_counted_cents = excluded.first_counted_cents,
      first_submitted_at_ms = excluded.first_submitted_at_ms,
      denom_counted_cents = excluded.denom_counted_cents,
      manager_ack_at_ms = excluded.manager_ack_at_ms,
      manager_ack_by_id = excluded.manager_ack_by_id,
      notify_sent_at_ms = excluded.notify_sent_at_ms
  `;
}

async function audit(opts: {
  rec: TillCloseRecord;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  payload?: import("./till-closeout").TillAuditPayload;
  ip?: string | null;
  deviceId?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into till_closeout_audit (
      id, closeout_id, location_id, at_ms, actor_id, actor_name, action, detail, payload, ip, device_id
    ) values (
      ${uid("tca")}, ${opts.rec.id}, ${opts.rec.locationId}, ${Date.now()},
      ${opts.actorId}, ${opts.actorName}, ${opts.action}, ${opts.detail.slice(0, 240)},
      ${JSON.stringify(opts.payload ?? {})}::jsonb, ${opts.ip ?? opts.rec.ip}, ${opts.deviceId ?? opts.rec.deviceId}
    )
  `;
}

async function load(id: string, locationId: string): Promise<TillCloseRecord | null> {
  const sql = await getSql();
  const rows = await sql<Row>`
    select * from till_closeouts where id = ${id} and location_id = ${locationId} limit 1
  `;
  return rows[0] ? rowToRecord(rows[0]) : null;
}

function floorRole(role: string): EmployeeRole {
  const s = role as EmployeeRole;
  return s;
}

export async function startTillCloseout(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    drawerId: string;
    drawerName: string;
    sinkType: "drawer" | "bank";
    assignedEmployeeIds: string[];
    employee: { id: string; name: string; role: string };
    snapshot: Omit<ExpectedSnapshot, "expectedCents">;
    nextShiftBankCents: number;
    witness?: { id: string; name: string } | null;
    deviceId?: string | null;
  },
): Promise<{ ok: true; screen: BlindCountScreen } | { ok: false; error: string }> {
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const till = tillCloseFromHandling(parseCashHandling(ctx.setup.cashHandling));
  const gate = canStartTillClose({
    emp: { id: data.employee.id, role: floorRole(data.employee.role) },
    drawerAssignedIds: data.assignedEmployeeIds,
    drawerId: data.drawerId,
    sinkType: data.sinkType,
    bankEmployeeId: data.sinkType === "bank" ? data.employee.id : null,
  });
  if (!gate.ok) return gate;

  const sql = await getSql();
  const open = await sql<Row>`
    select * from till_closeouts
    where location_id = ${data.locationId}
      and drawer_id = ${data.drawerId}
      and status in ('counting','recounting','submitted','auto_accepted','needs_review','accepted','dropped')
    order by started_at_ms desc
    limit 1
  `;
  const existing = open[0] ? rowToRecord(open[0]) : null;
  if (existing && isBlindPhase(existing.status)) {
    if (existing.employeeId !== data.employee.id && !isManagerTillRole(floorRole(data.employee.role))) {
      return { ok: false, error: "This drawer is already being closed." };
    }
    return { ok: true, screen: toBlindScreen(existing, till) };
  }
  if (existing && isCountLocked(existing.status)) {
    return { ok: false, error: "This drawer is already closed. A manager can void the count and start a recount." };
  }

  const expected = snapshotExpected(data.snapshot);
  const { ip } = await requestMeta();
  const rec: TillCloseRecord = {
    id: uid("tcl"),
    locationId: data.locationId,
    drawerId: data.drawerId,
    drawerName: data.drawerName,
    sinkType: data.sinkType,
    employeeId: data.employee.id,
    employeeName: data.employee.name,
    employeeRole: data.employee.role,
    status: "counting",
    countMode: till.countMode,
    denominationRequired: till.denominationRequired,
    nextShiftBankCents: data.nextShiftBankCents,
    denoms: null,
    countedCents: null,
    turnInCents: null,
    bankLeftCents: null,
    overShortCents: null,
    checksCents: 0,
    moneyOrdersCents: 0,
    bagNumber: null,
    comment: null,
    managerNote: null,
    witnessEmployeeId: data.witness?.id ?? null,
    witnessEmployeeName: data.witness?.name ?? null,
    startedAt: Date.now(),
    submittedAt: null,
    acceptedAt: null,
    acceptedById: null,
    acceptedByName: null,
    droppedAt: null,
    droppedById: null,
    voidedAt: null,
    voidedById: null,
    recountOfId: null,
    recountCount: 0,
    deviceId: data.deviceId ?? null,
    ip,
    cashBlocked: true,
    openingBankCorrectedCents: null,
    counterfeitPulledCents: 0,
    expected,
    slipPrintOk: false,
    slipPrintedAt: null,
    slipReprintCount: 0,
    printOverrideReason: null,
    printOverrideById: null,
    printOverrideByName: null,
    firstCountedCents: null,
    firstSubmittedAt: null,
    denomCountedCents: null,
    managerAckAt: null,
    managerAckById: null,
    notifySentAt: null,
  };
  await persist(rec, ctx.orgId);
  await audit({
    rec,
    actorId: data.employee.id,
    actorName: data.employee.name,
    action: "start",
    detail: `Started blind count on ${rec.drawerName}`,
    payload: {
      openingBankCents: expected.openingBankCents,
      cashSalesCents: expected.cashSalesCents,
      cashRefundsCents: expected.cashRefundsCents,
      paidOutsCents: expected.paidOutsCents,
      paidInsCents: expected.paidInsCents,
      dropsCents: expected.dropsCents,
      expectedCents: expected.expectedCents,
    },
    ip,
    deviceId: data.deviceId,
  });
  return { ok: true, screen: toBlindScreen(rec, till) };
}

export async function getTillCountScreen(
  userId: string,
  data: { locationId: string; orgId: string; closeoutId: string; employeeId: string; role: string },
): Promise<{ ok: true; screen: BlindCountScreen } | { ok: false; error: string }> {
  await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (!canViewTillRecord({ emp: { id: data.employeeId, role: floorRole(data.role) }, rec })) {
    throw new ForbiddenError("You cannot open another drawer’s close.");
  }
  if (!isBlindPhase(rec.status)) {
    return { ok: false, error: "Count is already submitted." };
  }
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const till = tillCloseFromHandling(parseCashHandling(ctx.setup.cashHandling));
  return { ok: true, screen: toBlindScreen(rec, till) };
}

export async function submitTillCount(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
    input: CountSubmitInput;
    deviceId?: string | null;
  },
): Promise<
  | { ok: true; kind: "matched" | "pending_review"; result: TillCloseResult }
  | { ok: true; kind: "need_denoms"; screen: import("./till-closeout").BlindCountScreen; message: string }
  | { ok: false; error: string }
> {
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (rec.employeeId !== data.employee.id && !isManagerTillRole(floorRole(data.employee.role))) {
    throw new ForbiddenError("You cannot submit another employee’s count.");
  }
  const handling = parseCashHandling(ctx.setup.cashHandling);
  const till = tillCloseFromHandling(handling);
  const applied = applyCountAttempt(rec, data.input, till);
  if (!applied.ok) return applied;
  const { ip } = await requestMeta();
  const next = { ...applied.rec, ip: ip ?? rec.ip, deviceId: data.deviceId ?? rec.deviceId };
  await persist(next, ctx.orgId);
  if (applied.kind === "need_denoms") {
    await audit({
      rec: next,
      actorId: data.employee.id,
      actorName: data.employee.name,
      action: "first_total_mismatch",
      detail: applied.message,
      payload: { firstCountedCents: next.firstCountedCents },
      ip,
      deviceId: data.deviceId,
    });
    return { ok: true, kind: "need_denoms", screen: toBlindScreen(next, till), message: applied.message };
  }
  await audit({
    rec: next,
    actorId: data.employee.id,
    actorName: data.employee.name,
    action: applied.kind === "pending_review" ? "final_mismatch" : "submit",
    detail:
      applied.kind === "pending_review"
        ? "Denomination total still does not match — management notified"
        : `Submitted counted ${next.countedCents} · over/short ${next.overShortCents}`,
    payload: {
      denomsJson: next.denoms ? JSON.stringify(next.denoms) : null,
      countedCents: next.countedCents,
      firstCountedCents: next.firstCountedCents,
      denomCountedCents: next.denomCountedCents,
      expectedCents: next.expected?.expectedCents,
      overShortCents: next.overShortCents,
      turnInCents: next.turnInCents,
      bagNumber: next.bagNumber,
      checksCents: next.checksCents,
      moneyOrdersCents: next.moneyOrdersCents,
    },
    ip,
    deviceId: data.deviceId,
  });
  const result = toResult(next);
  if ("error" in result) return { ok: false, error: result.error };
  result.revealVariance =
    applied.kind === "pending_review" ? till.revealVarianceAfterFinalMismatch : true;
  result.clockOutBlocked = clockOutBlocked(next, till.varianceAction, handling.overShortWarnCents);
  if (applied.kind === "pending_review") {
    await notifyTillMismatch(next, till, data.locationId, ctx.setup);
  }
  return { ok: true, kind: applied.kind, result };
}

function clockOutBlocked(
  rec: TillCloseRecord,
  action: ReturnType<typeof tillCloseFromHandling>["varianceAction"],
  warnCents: number,
): boolean {
  if (rec.status === "pending_review" || rec.status === "denom_required") return true;
  if (rec.status === "needs_review") return action !== "warn";
  if (rec.status === "submitted" && action === "block_clockout") {
    const abs = Math.abs(rec.overShortCents ?? 0);
    return !(warnCents > 0 && abs <= warnCents);
  }
  return isBlindPhase(rec.status);
}

async function notifyTillMismatch(
  rec: TillCloseRecord,
  till: ReturnType<typeof tillCloseFromHandling>,
  locationId: string,
  setup: unknown,
): Promise<void> {
  const exp = rec.expected?.expectedCents ?? 0;
  const body = [
    `Till over/short — manager review`,
    `Till: ${rec.drawerName}`,
    `Employee: ${rec.employeeName} (${rec.employeeId})`,
    `1st total: ${((rec.firstCountedCents ?? 0) / 100).toFixed(2)}`,
    `2nd denom: ${((rec.denomCountedCents ?? rec.countedCents ?? 0) / 100).toFixed(2)}`,
    `Expected: ${(exp / 100).toFixed(2)}`,
    `Over/short: ${((rec.overShortCents ?? 0) / 100).toFixed(2)}`,
    `Close ID: ${rec.id}`,
    `Open Cash → Till closeouts to review.`,
  ].join("\n");
  if (till.notifySms) {
    try {
      const { parseLossPrevention } = await import("./loss-prevention");
      const lp = parseLossPrevention(
        setup && typeof setup === "object" ? (setup as { lossPrevention?: unknown }).lossPrevention : undefined,
      );
      const phones = (lp.onCallList ?? [])
        .map((c) => String(c.phone ?? "").replace(/[^\d+]/g, ""))
        .filter((p) => p.length >= 8)
        .slice(0, 12);
      if (phones.length) {
        const { sendSms } = await import("@/lib/front/messaging.server");
        for (const to of phones) {
          await sendSms({ to, body, kind: "till_mismatch", locationId }).catch(() => undefined);
        }
      }
    } catch {
      /* */
    }
  }
  if (till.notifyEmail && till.notifyEmails.length) {
    try {
      const { sendEmail } = await import("@/lib/front/messaging.server");
      for (const to of till.notifyEmails) {
        await sendEmail({
          to,
          subject: `Till over/short — ${rec.drawerName}`,
          body,
          kind: "till_mismatch",
          locationId,
        }).catch(() => undefined);
      }
    } catch {
      /* */
    }
  }
}

export async function getTillResult(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employeeId: string;
    role: string;
  },
): Promise<{ ok: true; result: TillCloseResult } | { ok: false; error: string }> {
  await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (!canViewTillRecord({ emp: { id: data.employeeId, role: floorRole(data.role) }, rec })) {
    throw new ForbiddenError("You cannot view another employee’s count.");
  }
  const result = toResult(rec);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, result };
}

export async function managerTillQueue(
  userId: string,
  data: { locationId: string; orgId: string; employeeRole: string; fromMs?: number; toMs?: number },
): Promise<{ ok: true; rows: TillCloseRecord[] } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.employeeRole)) && data.employeeRole !== "accountant") {
    throw new ForbiddenError("Manager only.");
  }
  await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const sql = await getSql();
  const from = data.fromMs ?? Date.now() - 36 * 60 * 60 * 1000;
  const to = data.toMs ?? Date.now() + 60 * 1000;
  const rows = await sql<Row>`
    select * from till_closeouts
    where location_id = ${data.locationId}
      and started_at_ms >= ${from}
      and started_at_ms <= ${to}
    order by started_at_ms desc
    limit 200
  `;
  return { ok: true, rows: rows.map(rowToRecord) };
}

export async function acceptTillCloseout(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note?: string;
  },
): Promise<{ ok: true; rec: TillCloseRecord } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.actor.role))) throw new ForbiddenError("Manager only.");
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (isBlindPhase(rec.status)) return { ok: false, error: "The cashier has not submitted a count." };
  const next = applyAccept(
    { ...rec, managerNote: data.note?.trim().slice(0, 240) || rec.managerNote },
    data.actor,
  );
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.actor.id,
    actorName: data.actor.name,
    action: "accept",
    detail: data.note?.trim() || "Accepted variance",
  });
  return { ok: true, rec: next };
}

export async function requireTillRecount(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note?: string;
  },
): Promise<{ ok: true; screen: BlindCountScreen } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.actor.role))) throw new ForbiddenError("Manager only.");
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (isBlindPhase(rec.status) && rec.countedCents == null) {
    return { ok: false, error: "No submitted count to void." };
  }
  const next = {
    ...applyRecount(rec, data.actor.id),
    managerNote: data.note?.trim().slice(0, 240) || rec.managerNote,
  };
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.actor.id,
    actorName: data.actor.name,
    action: "recount",
    detail: data.note?.trim() || "Voided cashier count — recount still blind",
    payload: { clearedCountedCents: rec.countedCents, expectedHidden: true },
  });
  const till = tillCloseFromHandling(parseCashHandling(ctx.setup.cashHandling));
  return { ok: true, screen: toBlindScreen(next, till) };
}

export async function addTillManagerNote(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    note: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.actor.role))) throw new ForbiddenError("Manager only.");
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  const next = { ...rec, managerNote: data.note.trim().slice(0, 240) };
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.actor.id,
    actorName: data.actor.name,
    action: "note",
    detail: next.managerNote || "",
  });
  return { ok: true };
}

export async function correctTillOpeningBank(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    openingBankCents: number;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.actor.role))) throw new ForbiddenError("Manager only.");
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  const next = applyOpeningBankCorrection(rec, data.openingBankCents);
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.actor.id,
    actorName: data.actor.name,
    action: "correct_opening_bank",
    detail: data.reason.trim().slice(0, 240) || "Opening bank correction",
    payload: {
      from: rec.expected?.openingBankCents,
      to: next.expected?.openingBankCents,
      expectedCents: next.expected?.expectedCents,
    },
  });
  return { ok: true };
}

export async function pullTillCounterfeit(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    actor: { id: string; name: string; role: string };
    cents: number;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.actor.role))) throw new ForbiddenError("Manager only.");
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  const next = applyCounterfeitPull(rec, data.cents);
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.actor.id,
    actorName: data.actor.name,
    action: "counterfeit_pull",
    detail: data.reason.trim().slice(0, 240),
    payload: { pulledCents: data.cents, countedCents: next.countedCents },
  });
  return { ok: true };
}

export async function markTillDropped(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
  },
): Promise<{ ok: true; result: TillCloseResult } | { ok: false; error: string }> {
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (rec.employeeId !== data.employee.id && !isManagerTillRole(floorRole(data.employee.role))) {
    throw new ForbiddenError("You cannot drop another employee’s bag.");
  }
  if (isBlindPhase(rec.status)) return { ok: false, error: "Submit the count first." };
  const next: TillCloseRecord = {
    ...rec,
    status: rec.status === "accepted" || rec.status === "auto_accepted" ? "dropped" : rec.status,
    droppedAt: Date.now(),
    droppedById: data.employee.id,
  };
  if (rec.status === "auto_accepted" || rec.status === "accepted") next.status = "dropped";
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.employee.id,
    actorName: data.employee.name,
    action: "dropped",
    detail: `Bag ${next.bagNumber || "—"} dropped in safe`,
  });
  const result = toResult(next);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, result };
}

export async function addTillComment(
  userId: string,
  data: {
    locationId: string;
    orgId: string;
    closeoutId: string;
    employee: { id: string; name: string; role: string };
    comment: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const rec = await load(data.closeoutId, data.locationId);
  if (!rec) return { ok: false, error: "Close not found." };
  if (rec.employeeId !== data.employee.id && !isManagerTillRole(floorRole(data.employee.role))) {
    throw new ForbiddenError("You cannot comment on another employee’s close.");
  }
  if (isBlindPhase(rec.status)) {
    return { ok: false, error: "Comment is available after you submit the count." };
  }
  const next = { ...rec, comment: data.comment.trim().slice(0, 240) };
  await persist(next, ctx.orgId);
  await audit({
    rec: next,
    actorId: data.employee.id,
    actorName: data.employee.name,
    action: "comment",
    detail: next.comment || "",
  });
  return { ok: true };
}

export async function listTillAudit(
  userId: string,
  data: { locationId: string; orgId: string; closeoutId: string; employeeRole: string },
): Promise<{ ok: true; rows: TillAuditEvent[] } | { ok: false; error: string }> {
  if (!isManagerTillRole(floorRole(data.employeeRole)) && data.employeeRole !== "accountant") {
    throw new ForbiddenError("Manager only.");
  }
  await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    closeout_id: string;
    at_ms: number;
    actor_id: string;
    actor_name: string;
    action: string;
    detail: string | null;
    payload: unknown;
    ip: string | null;
    device_id: string | null;
  }>`
    select id, closeout_id, at_ms, actor_id, actor_name, action, detail, payload, ip, device_id
    from till_closeout_audit
    where closeout_id = ${data.closeoutId} and location_id = ${data.locationId}
    order by at_ms desc
    limit 200
  `;
  return {
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      closeoutId: r.closeout_id,
      at: n(r.at_ms),
      actorId: r.actor_id,
      actorName: r.actor_name,
      action: r.action,
      detail: r.detail ?? "",
      payload: (r.payload as TillAuditEvent["payload"]) ?? null,
      ip: r.ip,
      deviceId: r.device_id,
    })),
  };
}

export async function drawerCashBlocked(
  userId: string,
  data: { locationId: string; orgId: string; drawerId: string },
): Promise<{ blocked: boolean; closeoutId: string | null }> {
  await loadEntityWriteContext(userId, data.orgId, data.locationId);
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string; cash_blocked: boolean }>`
    select id, status, cash_blocked from till_closeouts
    where location_id = ${data.locationId} and drawer_id = ${data.drawerId}
    order by started_at_ms desc
    limit 1
  `;
  const r = rows[0];
  if (!r) return { blocked: false, closeoutId: null };
  const blocked = bool(r.cash_blocked) && blocksCashSales(r.status as TillCloseStatus);
  return { blocked, closeoutId: blocked ? r.id : null };
}
