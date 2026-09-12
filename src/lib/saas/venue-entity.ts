/**
 * Venue is a building wrapper, not a merchant.
 * Peer = named building, hostEntityId null, no Finix identity, no house sales.
 * Single-operator = venue + exactly one entity.
 * Hosted = venue + host entity + tenant entities.
 */

export const VENUE_KINDS = ["peer", "single_operator", "hosted"] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export const ENTITY_ONBOARD_STATUSES = [
  "invited",
  "in_progress",
  "finix_pending",
  "ready",
] as const;
export type EntityOnboardStatus = (typeof ENTITY_ONBOARD_STATUSES)[number];

export const ENTITY_MCC = {
  food: "5812",
  drink: "5813",
  other: "7299",
} as const;
export type EntityMcc = (typeof ENTITY_MCC)[keyof typeof ENTITY_MCC] | string;

export const SERVICE_STYLES_VENUE = [
  "full_service",
  "counter",
  "hybrid",
  "drive_through",
] as const;
export type VenueServiceStyle = (typeof SERVICE_STYLES_VENUE)[number];

export const CASH_ROUND_INCREMENTS = [0.25, 0.5, 1] as const;
export type CashRoundIncrement = (typeof CASH_ROUND_INCREMENTS)[number];

export const TAX_MODES = ["venue_shared", "per_entity"] as const;
export type VenueTaxMode = (typeof TAX_MODES)[number];

export const QR_VENUE_MODES = [
  "full",
  "reorder",
  "pay_only",
  "table_tent",
] as const;
export type VenueQrMode = (typeof QR_VENUE_MODES)[number];

export const VENUE_QR_LABEL: Record<VenueQrMode, string> = {
  full: "Complete self-serve — order and pay",
  reorder: "Reorder-only after staff opened a check",
  pay_only: "Pay-only",
  table_tent: "Table-tent QR — pull open check, split, pay, optional add-ons",
};

/** Safe mapping from stored operating_model. */
export function venueKindFromOperatingModel(
  operatingModel?: string | null,
  peerVenue?: boolean,
): VenueKind {
  if (peerVenue === true || operatingModel === "peer_venue" || operatingModel === "peer") {
    return "peer";
  }
  if (operatingModel === "host_operators" || operatingModel === "hosted") {
    return "hosted";
  }
  return "single_operator";
}

export function operatingModelFromVenueKind(kind: VenueKind): "peer_venue" | "single" | "host_operators" {
  if (kind === "peer") return "peer_venue";
  if (kind === "hosted") return "host_operators";
  return "single";
}

/** Peer venues never have a host merchant. Null is valid. */
export function normalizeHostEntityId(
  kind: VenueKind,
  hostEntityId: string | null | undefined,
): string | null {
  if (kind === "peer") return null;
  const id = String(hostEntityId ?? "").trim();
  return id || null;
}

export function isPeerVenueKind(kind: VenueKind | string | null | undefined): boolean {
  return kind === "peer" || kind === "peer_venue";
}

export function parseEntityOnboardStatus(raw: unknown): EntityOnboardStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "ready" || s === "complete") return s === "complete" ? "finix_pending" : "ready";
  if (s === "finix_pending") return "finix_pending";
  if (s === "in_progress") return "in_progress";
  return "invited";
}

export function entityStatusAfterOpen(current: EntityOnboardStatus): EntityOnboardStatus {
  if (current === "ready" || current === "finix_pending") return current;
  return "in_progress";
}

export function entityStatusAfterSubmit(opts: {
  finixApproved: boolean;
}): EntityOnboardStatus {
  return opts.finixApproved ? "ready" : "finix_pending";
}

export function canMarkTrainingReady(
  entities: Array<{ status: EntityOnboardStatus | string }>,
): boolean {
  if (entities.length < 1) return false;
  return entities.every((e) => {
    const s = parseEntityOnboardStatus(e.status);
    return s === "in_progress" || s === "finix_pending" || s === "ready";
  });
}

export function canMarkCardLive(opts: {
  entities: Array<{ status: EntityOnboardStatus | string; finixApproved?: boolean }>;
  readerEnrolled: boolean;
}): { ok: boolean; reason?: string } {
  if (!opts.entities.length) {
    return { ok: false, reason: "Add at least one selling entity" };
  }
  const allReady = opts.entities.every((e) => {
    if (e.finixApproved === true) return true;
    return parseEntityOnboardStatus(e.status) === "ready";
  });
  if (!allReady) {
    return {
      ok: false,
      reason: "Every selling entity needs an approved Quantum Payments merchant",
    };
  }
  if (!opts.readerEnrolled) {
    return {
      ok: false,
      reason: "Enroll at least one Quantum / Finix reader before live cards",
    };
  }
  return { ok: true };
}

/** Line owner for settlement / labor / gift / chargeback. Never the building. */
export function lineOwnerId(line: {
  entityId?: string | null;
  vendorId?: string | null;
}): string | null {
  const id = String(line.entityId || line.vendorId || "").trim();
  return id || null;
}

export function assertPeerLineOwner(
  peerVenue: boolean,
  line: { entityId?: string | null; vendorId?: string | null },
): string {
  const id = lineOwnerId(line);
  if (peerVenue && !id) {
    throw new Error("Each line needs a selling entity. This building is not a merchant.");
  }
  if (!id) {
    throw new Error("Each line needs a selling entity.");
  }
  return id;
}

export function parseCashRoundIncrement(raw: unknown): CashRoundIncrement {
  const n = Number(raw);
  if (n === 0.5) return 0.5;
  if (n === 1) return 1;
  return 0.25;
}

export function parseVenueTaxMode(raw: unknown): VenueTaxMode {
  return String(raw ?? "") === "per_entity" ? "per_entity" : "venue_shared";
}

export function parseVenueServiceStyle(raw: unknown): VenueServiceStyle {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "counter" || s === "qsr" || s === "cafe") return "counter";
  if (s === "hybrid" || s === "mixed" || s === "hall") return "hybrid";
  if (s === "drive_through" || s === "drive" || s === "dt") return "drive_through";
  return "full_service";
}

export function parseVenueQrMode(raw: unknown): VenueQrMode {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "reorder" || s === "reorder_only" || s === "reorder_after_open") return "reorder";
  if (s === "pay_only" || s === "pay") return "pay_only";
  if (s === "table_tent" || s === "table_tents" || s === "tent") return "table_tent";
  return "full";
}

export function minEntityCount(kind: VenueKind): number {
  return kind === "peer" ? 2 : 1;
}

export const ENTITY_STATUS_LABEL: Record<EntityOnboardStatus, string> = {
  invited: "Invited",
  in_progress: "In progress",
  finix_pending: "Payments pending",
  ready: "Ready",
};
