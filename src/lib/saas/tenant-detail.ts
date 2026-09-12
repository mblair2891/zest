/**
 * Platform tenant console model.
 * Peer venues have no host merchant — never read host.name / host.merchant
 * without a null check.
 */

export type TenantHostMerchant = {
  name: string;
  merchant: boolean;
};

export type TenantDetailEntity = {
  id: string;
  name: string;
};

export type TenantDetailModel = {
  venueName: string;
  operatingModel: "single" | "host_operators" | "peer_venue";
  /** Null on peer_venue (shared building, no landlord merchant). */
  host: TenantHostMerchant | null;
  /** Always null on peer venues. Never read without a null check. */
  hostEntityId: string | null;
  entities: TenantDetailEntity[];
};

export function isPeerVenueModel(
  operatingModel?: string | null,
  peerVenue?: boolean,
): boolean {
  return peerVenue === true || operatingModel === "peer_venue";
}

/** Safe read — never throws when the venue has no host entity. */
export function hostMerchantName(host: TenantHostMerchant | null | undefined): string | null {
  if (!host) return null;
  return host.name || null;
}

export function buildTenantDetailModel(opts: {
  venueName: string;
  operatingModel?: string | null;
  peerVenue?: boolean;
  hostEntityId?: string | null;
  operators: Array<{ id: string; dba?: string | null; name?: string | null }>;
}): TenantDetailModel {
  const peer = isPeerVenueModel(opts.operatingModel, opts.peerVenue);
  const hostOps = opts.operatingModel === "host_operators";
  const entities: TenantDetailEntity[] = opts.operators
    .map((o) => ({
      id: o.id,
      name: String(o.dba || o.name || "").trim(),
    }))
    .filter((e) => e.name.length > 0);
  const hostEntityId = peer ? null : opts.hostEntityId?.trim() || null;
  return {
    venueName: opts.venueName.trim() || "Venue",
    operatingModel: peer ? "peer_venue" : hostOps ? "host_operators" : "single",
    host: peer
      ? null
      : {
          name: opts.venueName.trim() || "Host",
          merchant: true,
        },
    hostEntityId,
    entities,
  };
}

/** Safe for React children — never returns an object. */
export function hostMerchantLabel(host: TenantHostMerchant | null | undefined): string {
  return hostMerchantName(host) ?? "Shared building — no host merchant";
}
