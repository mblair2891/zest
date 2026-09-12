/**
 * Password-login venue dashboards. Never the PIN pad.
 * Host + tenants: host owner/manager sees every tenant’s ops.
 * Peer: venue admin is not a landlord merchant.
 * Entity admin: own slice only.
 */

export type VenueDashAudience = "platform" | "owner" | "entity";
export type VenueDashModel = "single" | "host_operators" | "peer_venue";
export type VenueDashTabId =
  | "overview"
  | "settings"
  | "devices"
  | "floor"
  | "menu"
  | "costs"
  | "labor"
  | "reports"
  | "payments"
  | "grants"
  | "people"
  | "staff"
  | "schedule";

export type VenueDashTab = [VenueDashTabId, string];

export function isHostOperatorsModel(
  operatingModel?: string | null,
  peerVenue?: boolean,
): boolean {
  if (peerVenue === true || operatingModel === "peer_venue") return false;
  return operatingModel === "host_operators";
}

export function venueDashboardTabs(opts: {
  audience: VenueDashAudience;
  operatingModel: VenueDashModel;
}): VenueDashTab[] {
  if (opts.audience === "entity") {
    return [
      ["overview", "Overview"],
      ["menu", "Menu"],
      ["costs", "Costs"],
      ["schedule", "Schedule"],
      ["reports", "Reports"],
      ["staff", "Staff & 86"],
    ];
  }
  const hostHall = opts.operatingModel === "host_operators";
  const base: VenueDashTab[] = hostHall
    ? [
        ["overview", "Overview"],
        ["settings", "Settings"],
        ["devices", "Devices"],
        ["floor", "Floor"],
        ["menu", "Menus"],
        ["costs", "Costs"],
        ["labor", "Labor"],
        ["reports", "Reports"],
        ["payments", "Payments"],
        ["grants", "Grants"],
      ]
    : [
        ["overview", "Overview"],
        ["settings", "Settings"],
        ["devices", "Devices"],
        ["menu", "Menus"],
        ["payments", "Payments"],
      ];
  if (opts.audience === "platform") {
    return [...base, ["people", "Users"]];
  }
  return base;
}
