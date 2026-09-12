/**
 * Password-login landing dashboards. Never the PIN pad.
 * Tiles are subscribed modules only; deep links match API grants.
 */
import { allowsView } from "@/lib/pos/package-access";
import type { MembershipRole } from "./types";
import type { VenueDashTabId } from "./venue-dashboard-tabs";
import { isHostOperatorsModel } from "./venue-dashboard-tabs";

export type PasswordDashKind =
  | "platform_admin"
  | "host_owner"
  | "host_manager"
  | "venue_admin"
  | "venue_manager"
  | "entity_owner"
  | "entity_manager"
  | "accountant";

export type PasswordDashTile = {
  id: string;
  tab: VenueDashTabId | "home" | "crm" | "pipeline" | "tenants" | "settings_platform";
  label: string;
  blurb: string;
  /** POS view used to test location packages. Omit = always allowed. */
  view?: string;
};

export function passwordDashKind(opts: {
  isPlatformAdmin?: boolean;
  /** True on /platform/tenants/:orgId — never the SaaS CRM home. */
  tenantConsole?: boolean;
  role?: MembershipRole | string | null;
  operatorId?: string | null;
  operatingModel?: string | null;
  peerVenue?: boolean;
}): PasswordDashKind {
  if (opts.isPlatformAdmin && !opts.tenantConsole) return "platform_admin";
  const role = String(opts.role || "").trim().toLowerCase();
  const op = opts.operatorId?.trim() || null;
  if (role === "accountant") return "accountant";
  if (op) {
    if (role === "manager") return "entity_manager";
    return "entity_owner";
  }
  const host = isHostOperatorsModel(opts.operatingModel, opts.peerVenue);
  if (host) return role === "manager" ? "host_manager" : "host_owner";
  return role === "manager" ? "venue_manager" : "venue_admin";
}

export function passwordDashTitle(kind: PasswordDashKind): string {
  switch (kind) {
    case "platform_admin":
      return "Platform dashboard";
    case "host_owner":
      return "Host dashboard";
    case "host_manager":
      return "Host manager";
    case "venue_admin":
      return "Venue dashboard";
    case "venue_manager":
      return "Venue manager";
    case "entity_owner":
      return "Entity owner";
    case "entity_manager":
      return "Entity manager";
    case "accountant":
      return "Accountant";
  }
}

export function passwordDashBlurb(kind: PasswordDashKind): string {
  switch (kind) {
    case "platform_admin":
      return "CRM, pipeline, tenants, and platform settings. Not a restaurant PIN.";
    case "host_owner":
      return "Venue health, every tenant, Devices, Publish, combined and per-entity reports.";
    case "host_manager":
      return "Run the house from back office. Billing and payout routing stay with the host owner.";
    case "venue_admin":
      return "Same house tools as a host dashboard — no host merchant chrome. Not a landlord brand.";
    case "venue_manager":
      return "Floor and ops from back office. Not a landlord merchant. Billing stays with venue admin.";
    case "entity_owner":
      return "This selling entity only: sales, labor %, 86, menu, invoices, schedule, payout. Billing/payments for this brand.";
    case "entity_manager":
      return "This selling entity only. Floor tools from back office. Billing/payments stay with the entity owner.";
    case "accountant":
      return "Reports, hours export, and gift liability. No Devices. No 86.";
  }
}

export function passwordDashTiles(kind: PasswordDashKind): PasswordDashTile[] {
  if (kind === "platform_admin") {
    return [
      { id: "crm", tab: "crm", label: "CRM", blurb: "Leads and accounts" },
      { id: "pipeline", tab: "pipeline", label: "Pipeline", blurb: "Quote to contract" },
      { id: "tenants", tab: "tenants", label: "Tenants", blurb: "Live houses" },
      {
        id: "settings",
        tab: "settings_platform",
        label: "Platform settings",
        blurb: "PIN length, mail, gift defaults",
      },
    ];
  }
  if (kind === "accountant") {
    return [
      { id: "reports", tab: "reports", label: "Reports", blurb: "Sales and tenders", view: "reports" },
      { id: "export", tab: "labor", label: "Hours export", blurb: "ADP / Intuit / CSV", view: "labor" },
      { id: "gift", tab: "ledger", label: "Gift liability", blurb: "Outstanding by issuer", view: "reports" },
    ];
  }
  if (kind === "entity_owner" || kind === "entity_manager") {
    const tiles: PasswordDashTile[] = [
      { id: "sales", tab: "reports", label: "Sales", blurb: "This entity’s owned lines", view: "reports" },
      { id: "labor", tab: "schedule", label: "Labor %", blurb: "Hours vs owned sales", view: "labor" },
      { id: "86", tab: "staff", label: "86", blurb: "86 / un-86 this menu", view: "menu" },
      { id: "menu", tab: "menu", label: "Menu", blurb: "Items, prices, recipes", view: "menu" },
      { id: "invoices", tab: "costs", label: "Invoices", blurb: "Costs and recipes", view: "inventory" },
      { id: "schedule", tab: "schedule", label: "Schedule", blurb: "This entity’s week", view: "schedule" },
      { id: "payout", tab: "staff", label: "Payout status", blurb: "Last period share", view: "settlement" },
    ];
    if (kind === "entity_manager") {
      tiles.push({
        id: "floor",
        tab: "floor",
        label: "Floor",
        blurb: "Run the floor from back office",
        view: "floor",
      });
    } else {
      tiles.push({
        id: "payments",
        tab: "payments",
        label: "Payments",
        blurb: "This entity’s Quantum Payments",
        view: "settings",
      });
    }
    return tiles;
  }
  const house: PasswordDashTile[] = [
    { id: "health", tab: "overview", label: "Venue health", blurb: "Open checks, sales, staff on" },
    { id: "entities", tab: "overview", label: "Entities", blurb: "Every selling brand" },
    { id: "devices", tab: "devices", label: "Devices", blurb: "Pair, roles, printers", view: "settings" },
    { id: "publish", tab: "devices", label: "Publish", blurb: "Push catalog to stations", view: "settings" },
    { id: "onboarding", tab: "onboarding", label: "Onboarding", blurb: "Entity checklist and go-live" },
    { id: "users", tab: "people", label: "Users", blurb: "Password logins and floor PINs" },
    { id: "reports", tab: "reports", label: "Reports", blurb: "Combined and per-entity", view: "reports" },
    { id: "floor", tab: "floor", label: "Floor", blurb: "Map, QR, sections", view: "floor" },
    { id: "menu", tab: "menu", label: "Menus", blurb: "All entity menus", view: "menu" },
    { id: "costs", tab: "costs", label: "Costs", blurb: "Invoices and recipes", view: "inventory" },
    { id: "labor", tab: "labor", label: "Labor", blurb: "Schedules and hours export", view: "labor" },
  ];
  const billing: PasswordDashTile[] = [
    { id: "payments", tab: "payments", label: "Payments", blurb: "Split capture by brand", view: "settings" },
    { id: "grants", tab: "grants", label: "Grants", blurb: "Who may see whom", view: "settings" },
  ];
  if (kind === "host_manager" || kind === "venue_manager") {
    return house;
  }
  if (kind === "venue_admin") {
    return [...house, billing[0]!];
  }
  return [...house, ...billing];
}

export function filterPasswordDashTiles(
  tiles: PasswordDashTile[],
  enabledPackages: string[] | null | undefined,
): PasswordDashTile[] {
  const pkgs = (enabledPackages ?? []).filter(Boolean);
  if (!pkgs.length) return tiles;
  return tiles.filter((t) => {
    if (!t.view) return true;
    return allowsView(t.view, pkgs, "location");
  });
}

export function passwordDashTabs(kind: PasswordDashKind): Array<[VenueDashTabId, string]> {
  switch (kind) {
    case "platform_admin":
      return [];
    case "accountant":
      return [
        ["overview", "Overview"],
        ["reports", "Reports"],
        ["labor", "Exports"],
        ["ledger", "Gift liability"],
      ];
    case "entity_owner":
      return [
        ["overview", "Overview"],
        ["menu", "Menu"],
        ["costs", "Costs"],
        ["schedule", "Schedule"],
        ["reports", "Reports"],
        ["staff", "Staff & 86"],
        ["payments", "Payments"],
      ];
    case "entity_manager":
      return [
        ["overview", "Overview"],
        ["floor", "Floor"],
        ["menu", "Menu"],
        ["costs", "Costs"],
        ["schedule", "Schedule"],
        ["reports", "Reports"],
        ["staff", "Staff & 86"],
      ];
    case "host_manager":
    case "venue_manager":
      return [
        ["overview", "Overview"],
        ["settings", "Settings"],
        ["devices", "Devices"],
        ["floor", "Floor"],
        ["menu", "Menus"],
        ["reports", "Reports"],
        ["onboarding", "Onboarding"],
      ];
    case "venue_admin":
      return [
        ["overview", "Overview"],
        ["settings", "Settings"],
        ["devices", "Devices"],
        ["menu", "Menus"],
        ["payments", "Payments"],
        ["people", "Users"],
        ["onboarding", "Onboarding"],
        ["floor", "Floor"],
        ["reports", "Reports"],
      ];
    case "host_owner":
    default:
      return [
        ["overview", "Overview"],
        ["settings", "Settings"],
        ["devices", "Devices"],
        ["floor", "Floor"],
        ["menu", "Menus"],
        ["payments", "Payments"],
        ["people", "Users"],
        ["onboarding", "Onboarding"],
        ["costs", "Costs"],
        ["labor", "Labor"],
        ["reports", "Reports"],
        ["grants", "Grants"],
      ];
  }
}

export function isEntityPasswordKind(kind: PasswordDashKind): boolean {
  return kind === "entity_owner" || kind === "entity_manager";
}

export function isAccountantPasswordKind(kind: PasswordDashKind): boolean {
  return kind === "accountant";
}
