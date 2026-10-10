/**
 * Quantum Payments webhook decisions and receipt lines.
 * A paid transfer closes the check. A failed transfer does not.
 * Guest copy never names the processor.
 */

export type FinixWebhookKind = "transfer" | "authorization" | "dispute" | "onboarding" | "ignored";

export type ParsedFinixEvent = {
  kind: FinixWebhookKind;
  eventId: string;
  resourceId: string;
  state: string;
  checkId: string | null;
  authorizationId: string | null;
  amountCents: number | null;
  /** Transfer reached SUCCEEDED. Authorizations do not close a check. */
  paid: boolean;
  failed: boolean;
};

const PAID = new Set(["SUCCEEDED", "SUCCESS", "PAID"]);
const FAILED = new Set(["FAILED", "FAILURE", "CANCELED", "CANCELLED", "RETURNED", "DECLINED", "REJECTED"]);

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function kindFrom(type: string, entity: string): FinixWebhookKind {
  const blob = `${type} ${entity}`.toLowerCase();
  if (blob.includes("dispute")) return "dispute";
  if (blob.includes("authorization")) return "authorization";
  if (blob.includes("transfer")) return "transfer";
  if (
    blob.includes("merchant") ||
    blob.includes("onboarding") ||
    blob.includes("identity") ||
    blob.includes("verification")
  ) {
    return "onboarding";
  }
  return "ignored";
}

function resourceOf(event: Record<string, unknown>, kind: FinixWebhookKind): Record<string, unknown> {
  const embedded = asRecord(event._embedded);
  const lists: unknown[] = [];
  if (kind === "transfer") lists.push(embedded.transfers);
  if (kind === "authorization") lists.push(embedded.authorizations);
  if (kind === "dispute") lists.push(embedded.disputes);
  lists.push(embedded.transfers, embedded.authorizations, embedded.disputes);
  for (const list of lists) {
    if (Array.isArray(list) && list[0] && typeof list[0] === "object") {
      return list[0] as Record<string, unknown>;
    }
  }
  const data = asRecord(event.data);
  if (Object.keys(data).length) return data;
  return event;
}

function tagsOf(resource: Record<string, unknown>): Record<string, unknown> {
  return asRecord(resource.tags);
}

export function parseFinixWebhook(event: unknown): ParsedFinixEvent {
  const root = asRecord(event);
  const type = text(root.type);
  const entity = text(root.entity);
  const kind = kindFrom(type, entity);
  const resource = kind === "ignored" || kind === "onboarding" ? asRecord(root.data) : resourceOf(root, kind);
  const resourceKind = kind === "ignored" ? kindFrom(type || entity, text(resource.type) || text(resource.entity)) : kind;
  const resolved = resourceKind === "ignored" ? kind : resourceKind;
  const body = resolved === kind ? resource : resourceOf(root, resolved);
  const tags = tagsOf(body);
  const state = text(body.state || body.status || tags.state).toUpperCase();
  const resourceId = text(body.id || root.entity_id || tags.id);
  const checkId = text(tags.check_id || tags.checkId || body.check_id) || null;
  const authorizationId = text(body.authorization || tags.authorization_id || tags.authorizationId) || null;
  const amountRaw = body.amount ?? body.amount_cents;
  const amountCents = typeof amountRaw === "number" && Number.isFinite(amountRaw) ? Math.round(amountRaw) : null;
  const failed = FAILED.has(state);
  const paid = resolved === "transfer" && PAID.has(state) && !failed;
  const eventId =
    text(root.id) ||
    [resolved, resourceId || checkId || "event", state || type || "update"].filter(Boolean).join(":").slice(0, 80);
  return {
    kind: resolved,
    eventId: eventId.slice(0, 80),
    resourceId,
    state,
    checkId,
    authorizationId,
    amountCents,
    paid,
    failed,
  };
}

export function transferClosesCheck(event: ParsedFinixEvent): boolean {
  return event.kind === "transfer" && event.paid && !event.failed;
}

export type QuantumCheckLine = {
  entityId: string;
  entityName: string;
  amountCents: number;
};

export type QuantumCheckCard = {
  status: "authorized" | "paid" | "failed";
  authorizationId: string;
  transferId?: string;
  amountCents: number;
};

export type QuantumCheck = {
  id: string;
  status: "open" | "closed";
  number: number | string;
  tableLabel: string;
  serverId: string;
  serverName: string;
  lines: QuantumCheckLine[];
  card: QuantumCheckCard | null;
};

export type ServerPayNotice = {
  audience: ["server"];
  title: string;
  body: string;
  serverId: string;
  serverName: string;
  tableLabel: string;
  orderId: string;
};

function matchesCheck(check: QuantumCheck, event: ParsedFinixEvent): boolean {
  if (event.checkId && event.checkId === check.id) return true;
  if (check.card && event.authorizationId && event.authorizationId === check.card.authorizationId) return true;
  if (check.card && event.resourceId && event.resourceId === check.card.authorizationId) return true;
  if (check.card?.transferId && event.resourceId === check.card.transferId) return true;
  return false;
}

/** Apply one webhook to one guest check. Failed and authorization events leave it open. */
export function applyFinixEventToCheck(
  check: QuantumCheck,
  event: ParsedFinixEvent,
): { check: QuantumCheck; closed: boolean; notice: ServerPayNotice | null } {
  if (!matchesCheck(check, event) && event.kind !== "ignored") {
    if (event.checkId && event.checkId !== check.id) {
      return { check, closed: false, notice: null };
    }
  }
  if (event.kind === "authorization") {
    if (check.status !== "open") return { check, closed: false, notice: null };
    const authorizationId = event.resourceId || check.card?.authorizationId || "";
    if (!authorizationId) return { check, closed: false, notice: null };
    return {
      check: {
        ...check,
        card: {
          status: event.failed ? "failed" : "authorized",
          authorizationId,
          transferId: check.card?.transferId,
          amountCents: event.amountCents ?? check.card?.amountCents ?? 0,
        },
      },
      closed: false,
      notice: null,
    };
  }
  if (event.kind === "transfer" && event.failed) {
    if (!matchesCheck(check, event)) return { check, closed: false, notice: null };
    return {
      check: {
        ...check,
        status: check.status,
        card: check.card
          ? { ...check.card, status: "failed", transferId: event.resourceId || check.card.transferId }
          : {
              status: "failed",
              authorizationId: event.authorizationId || event.resourceId,
              transferId: event.resourceId,
              amountCents: event.amountCents ?? 0,
            },
      },
      closed: false,
      notice: null,
    };
  }
  if (event.kind === "dispute" || event.kind === "onboarding" || event.kind === "ignored") {
    return { check, closed: false, notice: null };
  }
  if (!transferClosesCheck(event) || !matchesCheck(check, event)) {
    return { check, closed: false, notice: null };
  }
  if (check.status === "closed") return { check, closed: false, notice: null };
  const label = check.tableLabel || String(check.number);
  return {
    check: {
      ...check,
      status: "closed",
      card: {
        status: "paid",
        authorizationId: check.card?.authorizationId || event.authorizationId || event.resourceId,
        transferId: event.resourceId || check.card?.transferId,
        amountCents: event.amountCents ?? check.card?.amountCents ?? 0,
      },
    },
    closed: true,
    notice: {
      audience: ["server"],
      title: `Table ${label} paid — Quantum Payments`,
      body: `Check #${check.number} closed`,
      serverId: check.serverId,
      serverName: check.serverName,
      tableLabel: label,
      orderId: check.id,
    },
  };
}

/** Each receipt item names the selling entity. */
export function receiptItemLine(qty: number, name: string, entityName: string): string {
  const entity = entityName.trim();
  const item = `${qty}x ${name}`;
  return entity ? `${item} · ${entity}` : item;
}

export function settlementByLines(
  lines: QuantumCheckLine[],
): { entityId: string; entityName: string; amountCents: number }[] {
  const map = new Map<string, { entityId: string; entityName: string; amountCents: number }>();
  for (const line of lines) {
    const cur = map.get(line.entityId) ?? {
      entityId: line.entityId,
      entityName: line.entityName,
      amountCents: 0,
    };
    cur.amountCents += Math.max(0, Math.round(line.amountCents));
    map.set(line.entityId, cur);
  }
  return [...map.values()].filter((row) => row.amountCents > 0);
}

export function liveCardGate(opts: {
  locationLive: boolean;
  merchantId: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (!opts.locationLive) {
    return { ok: false, error: "Live keys run only when the location is live" };
  }
  const id = String(opts.merchantId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  if (id.toLowerCase().includes("sandbox")) {
    return { ok: false, error: "Sandbox merchant cannot take a live card" };
  }
  return { ok: true };
}

export function parentMerchantForCapture(opts: {
  peerVenue: boolean;
  shares: Array<{
    kind: "host" | "operator";
    entityId: string;
    merchantId: string | null;
    amountCents: number;
  }>;
}):
  | { ok: true; parentMerchantId: string; splits: Array<{ merchantId: string; amountCents: number }> }
  | { ok: false; error: string } {
  if (opts.peerVenue && opts.shares.some((s) => s.kind === "host" && s.amountCents > 0)) {
    return {
      ok: false,
      error: "A peer venue has one merchant per entity. The building is not a merchant.",
    };
  }
  const payable = opts.shares.filter((s) => s.amountCents > 0 && !(opts.peerVenue && s.kind === "host"));
  if (!payable.length || payable.some((s) => !String(s.merchantId ?? "").trim())) {
    return {
      ok: false,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  const parent = [...payable].sort((a, b) => b.amountCents - a.amountCents)[0]!;
  const splits = payable
    .filter((s) => s.merchantId !== parent.merchantId)
    .map((s) => ({ merchantId: s.merchantId as string, amountCents: s.amountCents }));
  return { ok: true, parentMerchantId: parent.merchantId as string, splits };
}

export function quantumPaidServerNotice(
  prev: { status: string; payments?: { id: string }[] } | undefined,
  next: {
    id: string;
    status: string;
    number: number | string;
    serverId: string;
    serverName: string;
    payments: { id: string; method: string; processor?: string }[];
  },
  tableLabel: string,
): ServerPayNotice | null {
  if (!prev || prev.status !== "open" || next.status !== "closed") return null;
  const seen = new Set((prev.payments ?? []).map((p) => p.id));
  const added = next.payments.find(
    (p) => p.method === "card" && p.processor === "quantum_payments" && !seen.has(p.id),
  );
  if (!added) return null;
  const label = tableLabel || String(next.number);
  return {
    audience: ["server"],
    title: `Table ${label} paid — Quantum Payments`,
    body: `Check #${next.number} closed`,
    serverId: next.serverId,
    serverName: next.serverName,
    tableLabel: label,
    orderId: next.id,
  };
}
