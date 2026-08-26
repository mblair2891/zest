import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { loadEntityWriteContext, type EntityWriteContext } from "@/lib/access/assert-entity.server";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import { bindTenant } from "@/lib/saas/assert-tenant.server";
import { giftLast4, hashGiftCode, maskGiftCode, normalizeGiftCode } from "./hash";
import type { GiftCard, GiftCardStatus, GiftTransfer } from "@/lib/pos/types";
import type { GiftLiabilityRow } from "@/lib/pos/gift-issuer";

const HOST_WRITE = new Set(["owner", "manager", "platform_admin"]);

type CardRow = {
  id: string;
  location_id: string;
  org_id: string;
  code_hash: string;
  code_last4: string;
  issuer_kind: string;
  issuer_id: string;
  issuer_name: string;
  balance_cents: number;
  original_balance_cents: number;
  status: string;
  source: string;
  issued_to_name: string | null;
  issued_to_email: string | null;
  sold_by_employee_id: string | null;
  sold_by_operator_id: string | null;
  issued_at_ms: number | string;
  expires_at_ms: number | string | null;
  breakage_processed_at_ms: number | string | null;
  notes: string | null;
};

type LedRow = {
  id: string;
  card_id: string;
  kind: string;
  amount_cents: number;
  issuer_id: string | null;
  issuer_kind: string | null;
  counterparty_id: string | null;
  counterparty_kind: string | null;
  tender: string | null;
  check_id: string | null;
  actor_name: string | null;
  note: string | null;
  at_ms: number | string;
};

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function mapCard(row: CardRow): GiftCard {
  const last4 = row.code_last4;
  return {
    id: row.id,
    code: maskGiftCode(last4),
    balanceCents: n(row.balance_cents),
    originalBalanceCents: n(row.original_balance_cents),
    active: row.status !== "void",
    status: (row.status as GiftCardStatus) || "active",
    source: row.source as GiftCard["source"],
    issuedToName: row.issued_to_name ?? undefined,
    issuedToEmail: row.issued_to_email ?? undefined,
    issuedAt: n(row.issued_at_ms),
    notes: row.notes ?? undefined,
    issuerKind: row.issuer_kind === "operator" ? "operator" : "house",
    issuerId: row.issuer_id,
    issuerName: row.issuer_name,
    soldByEmployeeId: row.sold_by_employee_id ?? undefined,
    soldByOperatorId: row.sold_by_operator_id ?? undefined,
    expiresAt: row.expires_at_ms == null ? undefined : n(row.expires_at_ms),
    breakageProcessedAt:
      row.breakage_processed_at_ms == null ? undefined : n(row.breakage_processed_at_ms),
  };
}

async function ctxFor(userId: string, locationId: string, orgId?: string): Promise<EntityWriteContext> {
  const bound = await bindTenant(userId, { locationId, orgId });
  if (!bound.organizationId || !bound.locationId) throw new ForbiddenError("Location is required");
  return loadEntityWriteContext(userId, bound.organizationId, bound.locationId);
}

function canManageIssuer(ctx: EntityWriteContext, issuerId: string): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (ctx.role !== "vendor" && HOST_WRITE.has(ctx.role)) return true;
  const iss = (issuerId || HOST_SCOPE).trim() || HOST_SCOPE;
  return ctx.operatorId === iss;
}

function issuerDenied(ctx: EntityWriteContext, issuerId: string): string | null {
  if (canManageIssuer(ctx, issuerId)) return null;
  return "Not permitted for this issuer";
}

async function writeLedger(
  opts: {
    locationId: string;
    orgId: string;
    cardId: string;
    kind: string;
    amountCents: number;
    issuerId?: string | null;
    issuerKind?: string | null;
    counterpartyId?: string | null;
    counterpartyKind?: string | null;
    tender?: string | null;
    checkId?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    note?: string | null;
    clientMutationId?: string | null;
    at: number;
  },
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into gift_ledger (
      id, location_id, org_id, card_id, kind, amount_cents, issuer_id, issuer_kind,
      counterparty_id, counterparty_kind, tender, check_id, actor_id, actor_name,
      note, at_ms, client_mutation_id
    ) values (
      ${uid("gled")},
      ${opts.locationId},
      ${opts.orgId},
      ${opts.cardId},
      ${opts.kind},
      ${opts.amountCents},
      ${opts.issuerId ?? null},
      ${opts.issuerKind ?? null},
      ${opts.counterpartyId ?? null},
      ${opts.counterpartyKind ?? null},
      ${opts.tender ?? null},
      ${opts.checkId ?? null},
      ${opts.actorId ?? null},
      ${opts.actorName ?? null},
      ${opts.note ?? null},
      ${opts.at},
      ${opts.clientMutationId ?? null}
    )
  `;
}

export async function listGiftCards(
  userId: string,
  locationId: string,
): Promise<{ cards: GiftCard[]; transfers: GiftTransfer[] }> {
  const ctx = await ctxFor(userId, locationId);
  const sql = await getSql();
  const vendor = ctx.role === "vendor" && ctx.operatorId !== HOST_SCOPE;
  const rows = vendor
    ? await sql<CardRow>`
        select * from gift_cards
        where location_id = ${ctx.locationId} and issuer_id = ${ctx.operatorId}
        order by issued_at_ms desc
        limit 500
      `
    : await sql<CardRow>`
        select * from gift_cards
        where location_id = ${ctx.locationId}
        order by issued_at_ms desc
        limit 500
      `;
  const led = await sql<LedRow>`
    select id, card_id, kind, amount_cents, issuer_id, issuer_kind,
           counterparty_id, counterparty_kind, tender, check_id, actor_name, note, at_ms
    from gift_ledger
    where location_id = ${ctx.locationId}
      and kind in (${"remit"}, ${"term_split"})
    order by at_ms desc
    limit 80
  `;
  const transfers: GiftTransfer[] = led.map((r) => ({
    id: r.id,
    at: n(r.at_ms),
    giftCardId: r.card_id,
    amountCents: Math.abs(n(r.amount_cents)),
    fromId: r.issuer_id || HOST_SCOPE,
    fromName: r.issuer_kind === "house" ? "House" : r.issuer_id || "",
    toId: r.counterparty_id || HOST_SCOPE,
    toName: r.counterparty_kind === "house" ? "House" : r.counterparty_id || "",
    reason: r.kind === "term_split" ? "breakage" : r.note === "issue_remit" ? "issue_remit" : "redeem",
  }));
  return { cards: rows.map(mapCard), transfers };
}

export async function lookupGiftCard(
  userId: string,
  locationId: string,
  code: string,
): Promise<{ card: GiftCard; ok: true } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, locationId);
  const sql = await getSql();
  const hash = hashGiftCode(ctx.locationId, code);
  const rows = await sql<CardRow>`
    select * from gift_cards
    where location_id = ${ctx.locationId} and code_hash = ${hash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Card not found" };
  return { ok: true, card: mapCard(row) };
}

export async function issueGiftCard(
  userId: string,
  input: {
    locationId: string;
    amountCents: number;
    code?: string;
    issuerId: string;
    issuerKind: "house" | "operator";
    issuerName: string;
    issuedToName?: string;
    tender?: "cash" | "card";
    soldByEmployeeId?: string;
    soldByOperatorId?: string;
    expiresAt?: number | null;
    clientMutationId?: string;
  },
): Promise<{ ok: true; card: GiftCard; plaintextCode: string } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, input.locationId);
  const denied = issuerDenied(ctx, input.issuerId);
  if (denied) return { ok: false, error: denied };
  if (input.amountCents <= 0) return { ok: false, error: "Amount required" };
  const plaintext =
    normalizeGiftCode(input.code || "") ||
    `SUMMEX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const hash = hashGiftCode(ctx.locationId, plaintext);
  const sql = await getSql();
  const dup = await sql<{ id: string }>`
    select id from gift_cards where location_id = ${ctx.locationId} and code_hash = ${hash} limit 1
  `;
  if (dup[0]) return { ok: false, error: "Code already exists" };
  const now = Date.now();
  const id = uid("gc");
  const last4 = giftLast4(plaintext);
  await sql`
    insert into gift_cards (
      id, location_id, org_id, code_hash, code_last4, issuer_kind, issuer_id, issuer_name,
      balance_cents, original_balance_cents, status, source, issued_to_name,
      sold_by_employee_id, sold_by_operator_id, issued_at_ms, expires_at_ms, client_mutation_id
    ) values (
      ${id}, ${ctx.locationId}, ${ctx.orgId}, ${hash}, ${last4},
      ${input.issuerKind}, ${input.issuerId}, ${input.issuerName},
      ${input.amountCents}, ${input.amountCents}, ${"active"}, ${"summex"},
      ${input.issuedToName ?? null}, ${input.soldByEmployeeId ?? null},
      ${input.soldByOperatorId ?? null}, ${now}, ${input.expiresAt ?? null},
      ${input.clientMutationId ?? null}
    )
  `;
  await writeLedger({
    locationId: ctx.locationId,
    orgId: ctx.orgId,
    cardId: id,
    kind: "issue",
    amountCents: input.amountCents,
    issuerId: input.issuerId,
    issuerKind: input.issuerKind,
    counterpartyId: input.soldByOperatorId ?? null,
    counterpartyKind: input.soldByOperatorId && input.soldByOperatorId !== input.issuerId ? "operator" : null,
    tender: input.tender ?? "card",
    actorId: ctx.userId,
    note: "Issuer liability — not seller merchandise",
    clientMutationId: input.clientMutationId ?? null,
    at: now,
  });
  if (input.soldByOperatorId && input.soldByOperatorId !== input.issuerId) {
    await writeLedger({
      locationId: ctx.locationId,
      orgId: ctx.orgId,
      cardId: id,
      kind: "remit",
      amountCents: input.amountCents,
      issuerId: input.soldByOperatorId,
      issuerKind: "operator",
      counterpartyId: input.issuerId,
      counterpartyKind: input.issuerKind,
      note: "issue_remit",
      at: now,
    });
  }
  const card = (await lookupById(ctx.locationId, id))!;
  return { ok: true, card: { ...card, code: plaintext }, plaintextCode: plaintext };
}

async function lookupById(locationId: string, id: string): Promise<GiftCard | null> {
  const sql = await getSql();
  const rows = await sql<CardRow>`
    select * from gift_cards where location_id = ${locationId} and id = ${id} limit 1
  `;
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function redeemGiftCard(
  userId: string,
  input: {
    locationId: string;
    code: string;
    amountCents: number;
    fulfillerId: string;
    fulfillerKind: "house" | "operator";
    fulfillerName?: string;
    checkId?: string;
    clientMutationId?: string;
  },
): Promise<{ ok: true; card: GiftCard } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, input.locationId);
  if (input.amountCents <= 0) return { ok: false, error: "Amount required" };
  const sql = await getSql();
  const hash = hashGiftCode(ctx.locationId, input.code);
  const rows = await sql<CardRow>`
    select * from gift_cards
    where location_id = ${ctx.locationId} and code_hash = ${hash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Invalid gift card" };
  if (row.status === "frozen") return { ok: false, error: "Card is frozen" };
  if (row.status === "void") return { ok: false, error: "Card is void" };
  const bal = n(row.balance_cents);
  if (bal < input.amountCents) {
    return { ok: false, error: `Balance only $${(bal / 100).toFixed(2)}` };
  }
  const next = bal - input.amountCents;
  const now = Date.now();
  await sql`
    update gift_cards set
      balance_cents = ${next},
      status = ${next === 0 ? "zeroed" : row.status}
    where id = ${row.id} and location_id = ${ctx.locationId}
  `;
  await writeLedger({
    locationId: ctx.locationId,
    orgId: ctx.orgId,
    cardId: row.id,
    kind: "redeem",
    amountCents: -input.amountCents,
    issuerId: row.issuer_id,
    issuerKind: row.issuer_kind,
    counterpartyId: input.fulfillerId,
    counterpartyKind: input.fulfillerKind,
    checkId: input.checkId ?? null,
    actorId: ctx.userId,
    note: "Fulfiller merchandise; issuer liability down",
    clientMutationId: input.clientMutationId ?? null,
    at: now,
  });
  if (input.fulfillerId !== row.issuer_id) {
    await writeLedger({
      locationId: ctx.locationId,
      orgId: ctx.orgId,
      cardId: row.id,
      kind: "remit",
      amountCents: input.amountCents,
      issuerId: row.issuer_id,
      issuerKind: row.issuer_kind,
      counterpartyId: input.fulfillerId,
      counterpartyKind: input.fulfillerKind,
      note: "redeem",
      at: now,
    });
  }
  return { ok: true, card: (await lookupById(ctx.locationId, row.id))! };
}

export async function setGiftStatus(
  userId: string,
  input: { locationId: string; code?: string; cardId?: string; status: GiftCardStatus },
): Promise<{ ok: true; card: GiftCard } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, input.locationId);
  const sql = await getSql();
  const rows = input.cardId
    ? await sql<CardRow>`
        select * from gift_cards where location_id = ${ctx.locationId} and id = ${input.cardId} limit 1
      `
    : await sql<CardRow>`
        select * from gift_cards
        where location_id = ${ctx.locationId} and code_hash = ${hashGiftCode(ctx.locationId, input.code || "")}
        limit 1
      `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Card not found" };
  const denied = issuerDenied(ctx, row.issuer_id);
  if (denied) return { ok: false, error: denied };
  const st = input.status;
  await sql`
    update gift_cards set status = ${st}
    where id = ${row.id} and location_id = ${ctx.locationId}
  `;
  await writeLedger({
    locationId: ctx.locationId,
    orgId: ctx.orgId,
    cardId: row.id,
    kind: st === "void" ? "void" : st === "frozen" ? "freeze" : "unfreeze",
    amountCents: 0,
    issuerId: row.issuer_id,
    issuerKind: row.issuer_kind,
    actorId: ctx.userId,
    at: Date.now(),
  });
  return { ok: true, card: (await lookupById(ctx.locationId, row.id))! };
}

export async function reloadGiftCard(
  userId: string,
  input: { locationId: string; code?: string; cardId?: string; amountCents: number },
): Promise<{ ok: true; card: GiftCard } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, input.locationId);
  if (input.amountCents <= 0) return { ok: false, error: "Amount required" };
  const sql = await getSql();
  const rows = input.cardId
    ? await sql<CardRow>`
        select * from gift_cards where location_id = ${ctx.locationId} and id = ${input.cardId} limit 1
      `
    : await sql<CardRow>`
        select * from gift_cards
        where location_id = ${ctx.locationId} and code_hash = ${hashGiftCode(ctx.locationId, input.code || "")}
        limit 1
      `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Card not found" };
  const denied = issuerDenied(ctx, row.issuer_id);
  if (denied) return { ok: false, error: denied };
  if (row.status === "frozen" || row.status === "void") {
    return { ok: false, error: "Card is not reloadable" };
  }
  const next = n(row.balance_cents) + input.amountCents;
  await sql`
    update gift_cards set balance_cents = ${next}, original_balance_cents = original_balance_cents + ${input.amountCents},
      status = ${"active"}
    where id = ${row.id} and location_id = ${ctx.locationId}
  `;
  await writeLedger({
    locationId: ctx.locationId,
    orgId: ctx.orgId,
    cardId: row.id,
    kind: "issue",
    amountCents: input.amountCents,
    issuerId: row.issuer_id,
    issuerKind: row.issuer_kind,
    actorId: ctx.userId,
    note: "reload",
    at: Date.now(),
  });
  return { ok: true, card: (await lookupById(ctx.locationId, row.id))! };
}

export async function importGiftCards(
  userId: string,
  input: {
    locationId: string;
    source: string;
    overwrite?: boolean;
    issuerId?: string;
    issuerKind?: "house" | "operator";
    issuerName?: string;
    rows: {
      code: string;
      balanceCents: number;
      originalBalanceCents?: number;
      status?: string;
      issuedToName?: string;
      issuedToEmail?: string;
      notes?: string;
    }[];
  },
): Promise<{ ok: true; imported: number; skipped: number } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, input.locationId);
  const issuerId = input.issuerId || HOST_SCOPE;
  const denied = issuerDenied(ctx, issuerId);
  if (denied) return { ok: false, error: denied };
  const sql = await getSql();
  let imported = 0;
  let skipped = 0;
  const now = Date.now();
  for (const row of input.rows.slice(0, 2000)) {
    const code = normalizeGiftCode(row.code);
    if (!code || row.balanceCents < 0) {
      skipped += 1;
      continue;
    }
    const hash = hashGiftCode(ctx.locationId, code);
    const existing = await sql<CardRow>`
      select * from gift_cards where location_id = ${ctx.locationId} and code_hash = ${hash} limit 1
    `;
    if (existing[0]) {
      if (!input.overwrite) {
        skipped += 1;
        continue;
      }
      if (issuerDenied(ctx, existing[0].issuer_id)) {
        skipped += 1;
        continue;
      }
      await sql`
        update gift_cards set
          balance_cents = ${row.balanceCents},
          status = ${row.status || (row.balanceCents > 0 ? "active" : "zeroed")},
          issued_to_name = coalesce(${row.issuedToName ?? null}, issued_to_name),
          notes = coalesce(${row.notes ?? null}, notes)
        where id = ${existing[0].id}
      `;
      await writeLedger({
        locationId: ctx.locationId,
        orgId: ctx.orgId,
        cardId: existing[0].id,
        kind: "import",
        amountCents: row.balanceCents,
        issuerId: existing[0].issuer_id,
        issuerKind: existing[0].issuer_kind,
        note: input.source,
        at: now,
      });
      imported += 1;
      continue;
    }
    const id = uid("gc");
    await sql`
      insert into gift_cards (
        id, location_id, org_id, code_hash, code_last4, issuer_kind, issuer_id, issuer_name,
        balance_cents, original_balance_cents, status, source, issued_to_name, issued_to_email,
        notes, issued_at_ms
      ) values (
        ${id}, ${ctx.locationId}, ${ctx.orgId}, ${hash}, ${giftLast4(code)},
        ${input.issuerKind || "house"}, ${issuerId}, ${input.issuerName || "House"},
        ${row.balanceCents}, ${row.originalBalanceCents ?? row.balanceCents},
        ${row.status || (row.balanceCents > 0 ? "active" : "zeroed")},
        ${input.source}, ${row.issuedToName ?? null}, ${row.issuedToEmail ?? null},
        ${row.notes ?? `Imported from ${input.source}`}, ${now}
      )
    `;
    await writeLedger({
      locationId: ctx.locationId,
      orgId: ctx.orgId,
      cardId: id,
      kind: "import",
      amountCents: row.balanceCents,
      issuerId,
      issuerKind: input.issuerKind || "house",
      note: input.source,
      at: now,
    });
    imported += 1;
  }
  return { ok: true, imported, skipped };
}

export async function processGiftTerm(
  userId: string,
  locationId: string,
  splitBps: number,
): Promise<{ ok: true; processed: number } | { ok: false; error: string }> {
  const ctx = await ctxFor(userId, locationId);
  if (ctx.role === "vendor" && !ctx.isPlatformAdmin) {
    return { ok: false, error: "Host processes term residual" };
  }
  const sql = await getSql();
  const now = Date.now();
  const rows = await sql<CardRow>`
    select * from gift_cards
    where location_id = ${ctx.locationId}
      and status <> ${"void"}
      and breakage_processed_at_ms is null
      and expires_at_ms is not null
      and expires_at_ms <= ${now}
      and balance_cents > 0
  `;
  let processed = 0;
  const bps = Math.min(10_000, Math.max(0, splitBps));
  for (const row of rows) {
    const remaining = n(row.balance_cents);
    const houseShare =
      row.issuer_kind === "house" ? 0 : Math.round((remaining * bps) / 10_000);
    await sql`
      update gift_cards set
        balance_cents = 0,
        status = ${"zeroed"},
        breakage_processed_at_ms = ${now}
      where id = ${row.id} and location_id = ${ctx.locationId}
    `;
    await writeLedger({
      locationId: ctx.locationId,
      orgId: ctx.orgId,
      cardId: row.id,
      kind: "term_split",
      amountCents: -remaining,
      issuerId: row.issuer_id,
      issuerKind: row.issuer_kind,
      counterpartyId: HOST_SCOPE,
      counterpartyKind: "house",
      note:
        row.issuer_kind === "house"
          ? "House-issued residual retained by house"
          : `Operator residual split ${Math.round(bps / 100)}% to house`,
      actorId: ctx.userId,
      at: now,
    });
    if (houseShare > 0 && row.issuer_id !== HOST_SCOPE) {
      await writeLedger({
        locationId: ctx.locationId,
        orgId: ctx.orgId,
        cardId: row.id,
        kind: "remit",
        amountCents: houseShare,
        issuerId: row.issuer_id,
        issuerKind: row.issuer_kind,
        counterpartyId: HOST_SCOPE,
        counterpartyKind: "house",
        note: "term_split",
        at: now,
      });
    }
    processed += 1;
  }
  return { ok: true, processed };
}

export async function giftLiabilityReport(
  userId: string,
  locationId: string,
): Promise<{ rows: GiftLiabilityRow[]; redemptionsCents: number }> {
  const ctx = await ctxFor(userId, locationId);
  const { cards } = await listGiftCards(userId, locationId);
  const sql = await getSql();
  const vendor = ctx.role === "vendor" && ctx.operatorId !== HOST_SCOPE;
  const red = vendor
    ? await sql<{ cents: number }>`
        select coalesce(sum(-amount_cents), 0)::int as cents
        from gift_ledger
        where location_id = ${ctx.locationId}
          and kind = ${"redeem"}
          and issuer_id = ${ctx.operatorId}
      `
    : await sql<{ cents: number }>`
        select coalesce(sum(-amount_cents), 0)::int as cents
        from gift_ledger
        where location_id = ${ctx.locationId} and kind = ${"redeem"}
      `;
  const map = new Map<string, GiftLiabilityRow>();
  for (const c of cards) {
    if (c.status === "void") continue;
    const id = c.issuerId || HOST_SCOPE;
    let row = map.get(id);
    if (!row) {
      row = {
        issuerId: id,
        issuerName: c.issuerName || id,
        kind: c.issuerKind === "operator" ? "operator" : "house",
        outstandingCents: 0,
        issuedCents: 0,
        redeemedCents: 0,
        breakageCents: 0,
        cardCount: 0,
      };
      map.set(id, row);
    }
    row.cardCount += 1;
    row.issuedCents += c.originalBalanceCents ?? c.balanceCents;
    const redeemed = Math.max(0, (c.originalBalanceCents ?? c.balanceCents) - c.balanceCents);
    row.redeemedCents += redeemed;
    if (c.breakageProcessedAt) {
      row.breakageCents += Math.max(0, (c.originalBalanceCents ?? 0) - redeemed);
    } else {
      row.outstandingCents += Math.max(0, c.balanceCents);
    }
  }
  return {
    rows: [...map.values()].sort((a, b) => b.outstandingCents - a.outstandingCents),
    redemptionsCents: n(red[0]?.cents),
  };
}
