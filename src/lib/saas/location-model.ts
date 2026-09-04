/**
 * Location operating models: who sells, who owns the floor.
 * Venue name is guest branding — not automatically a merchant.
 */
export const LOCATION_OPERATING_MODELS = ["single", "host_operators", "peer_venue"] as const;
export type LocationOperatingModel = (typeof LOCATION_OPERATING_MODELS)[number];

export const OPERATING_MODELS = ["single", "host_operators", "peer_venue", "mixed"] as const;
export type OperatingModel = (typeof OPERATING_MODELS)[number];

export const LOCATION_MODEL_LABEL: Record<LocationOperatingModel, string> = {
  single: "Single operator",
  host_operators: "Host + tenants",
  peer_venue: "Shared venue (peers)",
};

export const LOCATION_MODEL_HINT: Record<LocationOperatingModel, string> = {
  single: "One entity, one merchant, one menu.",
  host_operators: "Host subscriber plus guest operators. Host may sell and issue gift.",
  peer_venue: "Named building only. Independent entities. No landlord-brand POS, merchant, or gift product required.",
};

export function parseLocationOperatingModel(raw: unknown): LocationOperatingModel {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    s === "peer_venue" ||
    s === "peer" ||
    s === "shared_venue" ||
    s === "shared_building" ||
    s === "venue_partnership"
  ) {
    return "peer_venue";
  }
  if (
    s === "host_operators" ||
    s === "host_plus_tenants" ||
    s === "host_multi_operator" ||
    s === "host" ||
    s === "hall"
  ) {
    return "host_operators";
  }
  return "single";
}

export function parseOperatingModel(raw: unknown): OperatingModel {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (s === "mixed") return "mixed";
  if (s === "peer_venue" || s === "peer" || s === "shared_venue" || s === "shared_building") {
    return "peer_venue";
  }
  if (s === "host_operators" || s === "host_plus_tenants" || s === "host_multi_operator" || s === "host") {
    return "host_operators";
  }
  return "single";
}

export function isSharedFloorModel(
  model: string | null | undefined,
): model is "host_operators" | "peer_venue" {
  return model === "host_operators" || model === "peer_venue";
}

export function isPeerVenueModel(model: string | null | undefined): boolean {
  return model === "peer_venue";
}

export function isHostPlusTenantsModel(model: string | null | undefined): boolean {
  return model === "host_operators";
}
