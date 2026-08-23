import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type {
  DeviceEnrollment,
  LeaseInvoice,
  LocationCreatedBy,
  LocationMenuCategory,
  LocationMenuItem,
  LocationOperator,
  OnboardingStep,
  OperatingModel,
  OperatorStationType,
  PadAssignment,
  PlatformCompany,
  PodMerchant,
  SaasLocation,
  SaasMembership,
  SaasOrganization,
  TruckPad,
} from "./saas-types";
import {
  type PackageId,
  defaultPackagesForMode,
  packageForView,
  packagesForLocation,
  PACKAGE_BY_ID,
} from "./packages";
import {
  codeFromName,
  hostLocationStatus,
  nextOperatorColor,
  starterCatalogDraft,
} from "./host-location";
import type { OnboardingPayload } from "@/lib/saas/prospect-types";

const PLATFORM: PlatformCompany = {
  name: "Zest",
  legalName: "Zest Platform LLC",
  proprietors: [],
  tagline: "Service, sharp. — restaurants, halls & truck pods under one canopy.",
  supportEmail: "support@zest.app",
  version: "1.0.0",
};

const EMPTY_ORG: SaasOrganization = {
  id: "",
  name: "No organization yet",
  legalName: "",
  plan: "starter",
  seats: 10,
  locationsIncluded: 1,
  merchantsIncluded: 5,
  billingEmail: "",
  status: "trial",
  createdAt: 0,
};

function emptyOnboarding(): OnboardingStep[] {
  return [
    { id: "ob_1", title: "Create organization", done: false },
    { id: "ob_2", title: "Add first location", done: false },
    { id: "ob_3", title: "Invite team members", done: false },
    { id: "ob_4", title: "Onboard merchants / operators", done: false },
    { id: "ob_5", title: "Configure settlement & host cut", done: false },
    { id: "ob_6", title: "Enroll devices", done: false },
    { id: "ob_7", title: "Connect integrations", done: false },
    { id: "ob_8", title: "Run first period close", done: false },
  ];
}

interface SaasState {
  platform: PlatformCompany;
  org: SaasOrganization;
  orgs: SaasOrganization[];
  activeOrgId: string;
  members: SaasMembership[];
  locations: SaasLocation[];
  merchants: PodMerchant[];
  operators: LocationOperator[];
  locationCategories: LocationMenuCategory[];
  locationItems: LocationMenuItem[];
  pads: TruckPad[];
  schedule: PadAssignment[];
  devices: DeviceEnrollment[];
  invoices: LeaseInvoice[];
  onboarding: OnboardingStep[];
  activeLocationId: string;
  /** Separate SaaS /platform session (not POS staff) */
  platformAuthed: boolean;
  platformAdminName: string;
  platformAdminRole: SaasMembership["role"] | "";

  setActiveLocation: (id: string) => void;
  setActiveOrg: (id: string) => void;
  loginPlatform: (name?: string, role?: SaasMembership["role"]) => void;
  logoutPlatform: () => void;
  toggleLocationOpen: (id: string) => void;
  assignPad: (padId: string, merchantId: string) => void;
  clearPad: (padId: string) => void;
  setPadStatus: (padId: string, status: TruckPad["status"]) => void;
  generateLeaseInvoices: (locationId: string) => number;
  markInvoicePaid: (id: string) => void;
  completeOnboardingStep: (id: string) => void;
  enrollDevice: (partial: Omit<DeviceEnrollment, "id" | "lastSeenAt" | "status">) => void;
  updatePlan: (plan: SaasOrganization["plan"]) => void;
  addMerchant: (m: Omit<PodMerchant, "id" | "orgId">) => void;
  toggleLocationPackage: (locationId: string, packageId: PackageId) => void;
  setLocationPackages: (locationId: string, packages: PackageId[]) => void;
  locationHasPackage: (locationId: string, packageId: PackageId) => boolean;
  locationAllowsView: (locationId: string, view: string) => boolean;
  todayLineup: () => { pad: TruckPad; merchant?: PodMerchant }[];
  ampsUsed: (locationId: string) => number;

  createOrganization: (input: {
    name: string;
    legalName?: string;
    billingEmail?: string;
    plan?: SaasOrganization["plan"];
  }) => { ok: true; orgId: string } | { ok: false; error: string };
  createLocation: (input: {
    orgId?: string;
    name: string;
    code?: string;
    address?: string;
    timezone?: string;
    mode: SaasLocation["mode"];
    operatingModel: OperatingModel;
    hostBrandName?: string;
  }) => { ok: true; locationId: string } | { ok: false; error: string };
  updateLocation: (
    locationId: string,
    patch: Partial<
      Pick<
        SaasLocation,
        | "name"
        | "code"
        | "address"
        | "timezone"
        | "hostBrandName"
        | "operatingModel"
        | "open"
        | "mode"
      >
    >,
  ) => { ok: boolean; error?: string };
  addOperator: (input: {
    locationId: string;
    name: string;
    shortName?: string;
    payoutAccountLabel: string;
    payoutLast4: string;
    stationType: OperatorStationType;
  }) => { ok: true; operatorId: string } | { ok: false; error: string };
  updateOperator: (
    operatorId: string,
    patch: Partial<
      Pick<
        LocationOperator,
        | "name"
        | "shortName"
        | "payoutAccountLabel"
        | "payoutLast4"
        | "stationType"
        | "ownedCategoryIds"
        | "ownedItemIds"
        | "active"
      >
    >,
  ) => { ok: boolean; error?: string };
  removeOperator: (operatorId: string) => void;
  addLocationCategory: (input: {
    locationId: string;
    name: string;
    station: "bar" | "kitchen";
    color?: string;
  }) => { ok: true; categoryId: string } | { ok: false; error: string };
  addLocationItem: (input: {
    locationId: string;
    categoryId: string;
    name: string;
    priceCents: number;
    course?: LocationMenuItem["course"];
    station?: "bar" | "kitchen";
  }) => { ok: true; itemId: string } | { ok: false; error: string };
  removeLocationCategory: (categoryId: string) => void;
  removeLocationItem: (itemId: string) => void;
  setOperatorRouting: (input: {
    operatorId: string;
    stationType: OperatorStationType;
    ownedCategoryIds: string[];
    ownedItemIds?: string[];
  }) => { ok: boolean; error?: string };
  generateStarterCatalog: (
    locationId: string,
  ) => { ok: true; categoryIds: string[] } | { ok: false; error: string };
  hostStatusFor: (locationId: string) => ReturnType<typeof hostLocationStatus>;
  applyOnboarding: (
    payload: OnboardingPayload,
    packageIds?: string[],
  ) => { ok: true; orgId: string; locationIds: string[] } | { ok: false; error: string };
}

export const useSaasStore = create<SaasState>()(
  persist(
    (set, get) => ({
      platform: PLATFORM,
      org: EMPTY_ORG,
      orgs: [],
      activeOrgId: "",
      members: [],
      locations: [],
      merchants: [],
      operators: [],
      locationCategories: [],
      locationItems: [],
      pads: [],
      schedule: [],
      devices: [],
      invoices: [],
      onboarding: emptyOnboarding(),
      activeLocationId: "",
      platformAuthed: false,
      platformAdminName: "",
      platformAdminRole: "",

      setActiveLocation: (id) => set({ activeLocationId: id }),

      setActiveOrg: (id) => {
        const found = get().orgs.find((o) => o.id === id);
        if (!found) return;
        const locs = get().locations.filter((l) => l.orgId === id);
        set({
          activeOrgId: id,
          org: found,
          activeLocationId: locs[0]?.id ?? get().activeLocationId,
        });
      },

      loginPlatform: (name, role) =>
        set({
          platformAuthed: true,
          platformAdminName: name?.trim() || "Platform Admin",
          platformAdminRole: role || "owner",
        }),

      logoutPlatform: () =>
        set({
          platformAuthed: false,
          platformAdminName: "",
          platformAdminRole: "",
        }),

      toggleLocationOpen: (id) => {
        set({
          locations: get().locations.map((l) =>
            l.id === id ? { ...l, open: !l.open } : l,
          ),
        });
      },

      assignPad: (padId, merchantId) => {
        const m = get().merchants.find((x) => x.id === merchantId);
        if (!m) return;
        set({
          pads: get().pads.map((p) =>
            p.id === padId
              ? {
                  ...p,
                  status: "occupied",
                  merchantId: m.id,
                  merchantName: m.name,
                  leaseStart: Date.now(),
                  leaseEnd: Date.now() + 86400000 * 90,
                }
              : p,
          ),
        });
      },

      clearPad: (padId) => {
        set({
          pads: get().pads.map((p) =>
            p.id === padId
              ? {
                  ...p,
                  status: "vacant",
                  merchantId: undefined,
                  merchantName: undefined,
                  leaseStart: undefined,
                  leaseEnd: undefined,
                }
              : p,
          ),
        });
      },

      setPadStatus: (padId, status) => {
        set({
          pads: get().pads.map((p) =>
            p.id === padId
              ? {
                  ...p,
                  status,
                  ...(status === "vacant" || status === "maintenance"
                    ? {
                        merchantId: undefined,
                        merchantName: undefined,
                      }
                    : {}),
                }
              : p,
          ),
        });
      },

      generateLeaseInvoices: (locationId) => {
        const pads = get().pads.filter(
          (p) => p.locationId === locationId && p.merchantId,
        );
        const start = Date.now() - 86400000 * 30;
        const end = Date.now();
        const invoices: LeaseInvoice[] = pads.map((p) => {
          // demo GMV share — synthetic
          const gmv = 800000 + Math.floor(Math.random() * 400000);
          const gmvFee = Math.round(gmv * (p.gmvPercent / 100));
          const lines = [
            {
              kind: "pad_rent" as const,
              label: `Pad ${p.label} rent`,
              amountCents: p.monthlyRentCents,
            },
            {
              kind: "power" as const,
              label: `Power ${p.amps}A`,
              amountCents: p.powerFeeCents,
            },
            {
              kind: "gmv_percent" as const,
              label: `${p.gmvPercent}% of GMV`,
              amountCents: gmvFee,
            },
          ];
          const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
          return {
            id: uid("inv"),
            locationId,
            merchantId: p.merchantId!,
            merchantName: p.merchantName ?? "Merchant",
            periodStart: start,
            periodEnd: end,
            lines,
            totalCents,
            status: "sent" as const,
          };
        });
        set({ invoices: [...invoices, ...get().invoices] });
        return invoices.length;
      },

      markInvoicePaid: (id) => {
        set({
          invoices: get().invoices.map((i) =>
            i.id === id ? { ...i, status: "paid" } : i,
          ),
        });
      },

      completeOnboardingStep: (id) => {
        set({
          onboarding: get().onboarding.map((s) =>
            s.id === id ? { ...s, done: true } : s,
          ),
        });
      },

      enrollDevice: (partial) => {
        set({
          devices: [
            {
              ...partial,
              id: uid("dev"),
              status: "pending",
              lastSeenAt: Date.now(),
            },
            ...get().devices,
          ],
        });
      },

      updatePlan: (plan) => {
        const seats =
          plan === "starter" ? 10 : plan === "growth" ? 25 : 100;
        const locationsIncluded =
          plan === "starter" ? 1 : plan === "growth" ? 5 : 50;
        const merchantsIncluded =
          plan === "starter" ? 5 : plan === "growth" ? 40 : 500;
        set({
          org: {
            ...get().org,
            plan,
            seats,
            locationsIncluded,
            merchantsIncluded,
          },
        });
      },

      addMerchant: (m) => {
        set({
          merchants: [
            {
              ...m,
              id: uid("m"),
              orgId: get().org.id,
            },
            ...get().merchants,
          ],
        });
      },

      createOrganization: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Organization name is required" };
        const plan = input.plan ?? "growth";
        const seats = plan === "starter" ? 10 : plan === "growth" ? 25 : 100;
        const o: SaasOrganization = {
          id: uid("org"),
          name,
          legalName: (input.legalName ?? name).trim() || name,
          plan,
          seats,
          locationsIncluded: plan === "starter" ? 1 : plan === "growth" ? 5 : 50,
          merchantsIncluded:
            plan === "starter" ? 5 : plan === "growth" ? 40 : 500,
          billingEmail: (input.billingEmail ?? "").trim(),
          status: "trial",
          trialEndsAt: Date.now() + 86400000 * 14,
          createdAt: Date.now(),
        };
        const member: SaasMembership = {
          id: uid("mem"),
          orgId: o.id,
          name: get().platformAdminName || "Owner",
          email: o.billingEmail || "owner@org.local",
          role: "owner",
        };
        set({
          orgs: [...get().orgs, o],
          org: o,
          activeOrgId: o.id,
          members: [...get().members, member],
        });
        return { ok: true, orgId: o.id };
      },

      createLocation: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Location name is required" };
        const orgId = input.orgId ?? get().activeOrgId ?? get().org.id;
        if (!orgId) return { ok: false, error: "Create an organization first" };
        const org = get().orgs.find((o) => o.id === orgId) ?? get().org;
        if (!org.id) return { ok: false, error: "Create an organization first" };
        const existingForOrg = get().locations.filter((l) => l.orgId === org.id);
        if (existingForOrg.length >= org.locationsIncluded) {
          return {
            ok: false,
            error: `Plan includes ${org.locationsIncluded} location(s). Upgrade to add more.`,
          };
        }
        const operatingModel = input.operatingModel;
        const hostBrandName =
          (input.hostBrandName ?? (operatingModel === "host_multi_operator" ? name : name)).trim() ||
          name;
        if (operatingModel === "host_multi_operator" && !hostBrandName) {
          return { ok: false, error: "Host brand name is required" };
        }
        const loc: SaasLocation = {
          id: uid("loc"),
          orgId: org.id,
          name,
          code: (input.code ?? "").trim() || codeFromName(name),
          mode: input.mode,
          address: (input.address ?? "").trim(),
          timezone: input.timezone || "America/Los_Angeles",
          open: true,
          enabledPackages: packagesForLocation(input.mode, operatingModel),
          operatingModel,
          hostBrandName,
          createdBy: "ui",
        };
        set({
          locations: [...get().locations, loc],
          activeLocationId: loc.id,
        });
        return { ok: true, locationId: loc.id };
      },

      updateLocation: (locationId, patch) => {
        const loc = get().locations.find((l) => l.id === locationId);
        if (!loc) return { ok: false, error: "Location not found" };
        set({
          locations: get().locations.map((l) => {
            if (l.id !== locationId) return l;
            const updated = { ...l, ...patch };
            if (patch.operatingModel || patch.mode) {
              updated.enabledPackages = packagesForLocation(
                updated.mode,
                updated.operatingModel,
              );
            }
            return updated;
          }),
        });
        return { ok: true };
      },

      addOperator: (input) => {
        const loc = get().locations.find((l) => l.id === input.locationId);
        if (!loc) return { ok: false, error: "Location not found" };
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Operator name is required" };
        const last4 = input.payoutLast4.replace(/\D/g, "").slice(-4);
        if (last4.length !== 4) {
          return { ok: false, error: "Payout account needs a 4-digit placeholder" };
        }
        const label = input.payoutAccountLabel.trim() || `${name} payout`;
        const count = get().operators.filter(
          (o) => o.locationId === loc.id,
        ).length;
        const op: LocationOperator = {
          id: uid("op"),
          orgId: loc.orgId,
          locationId: loc.id,
          name,
          shortName: (input.shortName ?? name).trim() || name,
          payoutAccountLabel: label,
          payoutLast4: last4,
          stationType: input.stationType,
          ownedCategoryIds: [],
          ownedItemIds: [],
          color: nextOperatorColor(count),
          active: true,
        };
        set({ operators: [...get().operators, op] });
        return { ok: true, operatorId: op.id };
      },

      updateOperator: (operatorId, patch) => {
        if (!get().operators.some((o) => o.id === operatorId)) {
          return { ok: false, error: "Operator not found" };
        }
        set({
          operators: get().operators.map((o) =>
            o.id === operatorId ? { ...o, ...patch } : o,
          ),
        });
        return { ok: true };
      },

      removeOperator: (operatorId) => {
        set({
          operators: get().operators.filter((o) => o.id !== operatorId),
        });
      },

      addLocationCategory: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Category name is required" };
        const loc = get().locations.find((l) => l.id === input.locationId);
        if (!loc) return { ok: false, error: "Location not found" };
        const sort =
          get().locationCategories.filter((c) => c.locationId === loc.id)
            .length + 1;
        const cat: LocationMenuCategory = {
          id: uid("lcat"),
          locationId: loc.id,
          name,
          sort,
          color: input.color || (input.station === "bar" ? "#f87171" : "#94a3b8"),
          station: input.station,
        };
        set({ locationCategories: [...get().locationCategories, cat] });
        return { ok: true, categoryId: cat.id };
      },

      addLocationItem: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Item name is required" };
        const cat = get().locationCategories.find(
          (c) => c.id === input.categoryId,
        );
        if (!cat) return { ok: false, error: "Category not found" };
        const item: LocationMenuItem = {
          id: uid("lit"),
          locationId: input.locationId,
          categoryId: cat.id,
          name,
          priceCents: Math.max(0, Math.round(input.priceCents)),
          course:
            input.course ??
            (cat.station === "bar" ? "drink" : "entree"),
          station: input.station ?? cat.station,
          available: true,
        };
        set({ locationItems: [...get().locationItems, item] });
        return { ok: true, itemId: item.id };
      },

      removeLocationCategory: (categoryId) => {
        set({
          locationCategories: get().locationCategories.filter(
            (c) => c.id !== categoryId,
          ),
          locationItems: get().locationItems.filter(
            (i) => i.categoryId !== categoryId,
          ),
          operators: get().operators.map((o) => ({
            ...o,
            ownedCategoryIds: o.ownedCategoryIds.filter((id) => id !== categoryId),
          })),
        });
      },

      removeLocationItem: (itemId) => {
        set({
          locationItems: get().locationItems.filter((i) => i.id !== itemId),
          operators: get().operators.map((o) => ({
            ...o,
            ownedItemIds: o.ownedItemIds.filter((id) => id !== itemId),
          })),
        });
      },

      setOperatorRouting: (input) => {
        const op = get().operators.find((o) => o.id === input.operatorId);
        if (!op) return { ok: false, error: "Operator not found" };
        set({
          operators: get().operators.map((o) =>
            o.id === input.operatorId
              ? {
                  ...o,
                  stationType: input.stationType,
                  ownedCategoryIds: input.ownedCategoryIds,
                  ownedItemIds: input.ownedItemIds ?? o.ownedItemIds,
                }
              : o,
          ),
        });
        return { ok: true };
      },

      generateStarterCatalog: (locationId) => {
        const loc = get().locations.find((l) => l.id === locationId);
        if (!loc) return { ok: false, error: "Location not found" };
        const ops = get().operators.filter(
          (o) => o.locationId === locationId && o.active,
        );
        if (ops.length < 2) {
          return { ok: false, error: "Add two operators before generating a catalog" };
        }
        const draft = starterCatalogDraft();
        const cats: LocationMenuCategory[] = draft.categories.map((c, i) => ({
          ...c,
          id: uid("lcat"),
          locationId,
        }));
        const items: LocationMenuItem[] = cats.flatMap((cat, i) =>
          (draft.items[i] ?? []).map((it) => ({
            ...it,
            id: uid("lit"),
            locationId,
            categoryId: cat.id,
          })),
        );
        const barOp = ops.find((o) => o.stationType === "bar") ?? ops[0]!;
        const kitOp =
          ops.find((o) => o.id !== barOp.id && o.stationType === "kitchen") ??
          ops.find((o) => o.id !== barOp.id) ??
          ops[1]!;
        const barCat = cats.find((c) => c.station === "bar");
        const kitCat = cats.find((c) => c.station === "kitchen");
        set({
          locationCategories: [
            ...get().locationCategories.filter((c) => c.locationId !== locationId),
            ...cats,
          ],
          locationItems: [
            ...get().locationItems.filter((i) => i.locationId !== locationId),
            ...items,
          ],
          operators: get().operators.map((o) => {
            if (o.id === barOp.id) {
              return {
                ...o,
                stationType: o.stationType === "both" ? "both" : "bar",
                ownedCategoryIds: barCat ? [barCat.id] : [],
                ownedItemIds: [],
              };
            }
            if (o.id === kitOp.id) {
              return {
                ...o,
                stationType: o.stationType === "both" ? "both" : "kitchen",
                ownedCategoryIds: kitCat ? [kitCat.id] : [],
                ownedItemIds: [],
              };
            }
            return o;
          }),
        });
        return { ok: true, categoryIds: cats.map((c) => c.id) };
      },

      hostStatusFor: (locationId) => {
        const loc = get().locations.find((l) => l.id === locationId);
        return hostLocationStatus(
          loc,
          get().operators.filter((o) => o.locationId === locationId),
          get().locationCategories.filter((c) => c.locationId === locationId),
          get().locationItems.filter((i) => i.locationId === locationId),
        );
      },

      applyOnboarding: (payload, packageIds) => {
        const orgName = payload.orgName.trim();
        if (!orgName) return { ok: false, error: "Organization name is required" };
        const locDrafts = payload.locations.filter((l) => l.name.trim());
        if (locDrafts.length === 0) {
          return { ok: false, error: "Add at least one location" };
        }
        const owner = payload.invites.find(
          (i) => i.role === "owner" && i.email.trim(),
        );
        if (!owner) return { ok: false, error: "Add an owner invite" };
        const locN = locDrafts.length;
        const org: SaasOrganization = {
          id: uid("org"),
          name: orgName,
          legalName: payload.legalName.trim() || orgName,
          plan: locN > 5 ? "enterprise" : locN > 1 ? "growth" : "starter",
          seats: Math.max(25, payload.invites.length + 10),
          locationsIncluded: Math.max(locN, 50),
          merchantsIncluded: 500,
          billingEmail: payload.billingEmail.trim(),
          status: "active",
          createdAt: Date.now(),
        };
        const members: SaasMembership[] = payload.invites
          .filter((i) => i.email.trim())
          .map((i) => ({
            id: uid("mem"),
            orgId: org.id,
            name: i.name.trim() || i.email,
            email: i.email.trim(),
            role:
              i.role === "owner"
                ? "owner"
                : i.role === "manager"
                  ? "admin"
                  : "ops",
          }));
        const locations: SaasLocation[] = [];
        const operators: LocationOperator[] = [];
        const cats: LocationMenuCategory[] = [];
        for (const d of locDrafts) {
          const loc: SaasLocation = {
            id: uid("loc"),
            orgId: org.id,
            name: d.name.trim(),
            code: codeFromName(d.name),
            mode: d.mode,
            address: d.address.trim(),
            timezone: d.timezone || "America/Los_Angeles",
            open: true,
            enabledPackages: packageIds?.length
              ? (packageIds as PackageId[])
              : packagesForLocation(d.mode, d.operatingModel),
            operatingModel: d.operatingModel,
            hostBrandName: d.hostBrandName.trim() || d.name.trim(),
            createdBy: "ui",
          };
          locations.push(loc);
          d.operators
            .filter((o) => o.name.trim())
            .forEach((o, idx) => {
              const last4 = o.payoutLast4.replace(/\D/g, "").slice(-4) || "0000";
              operators.push({
                id: uid("op"),
                orgId: org.id,
                locationId: loc.id,
                name: o.name.trim(),
                shortName: o.name.trim(),
                payoutAccountLabel:
                  o.payoutAccountLabel.trim() || `${o.name.trim()} payout`,
                payoutLast4: last4,
                stationType: o.stationType,
                ownedCategoryIds: [],
                ownedItemIds: [],
                color: nextOperatorColor(idx),
                active: true,
              });
            });
          if (d.menuStart === "template_categories") {
            cats.push(
              {
                id: uid("lcat"),
                locationId: loc.id,
                name: "Drinks",
                sort: 1,
                color: "#f87171",
                station: "bar",
              },
              {
                id: uid("lcat"),
                locationId: loc.id,
                name: "Kitchen",
                sort: 2,
                color: "#94a3b8",
                station: "kitchen",
              },
            );
          }
        }
        const first = locations[0]!;
        set({
          orgs: [...get().orgs, org],
          org,
          activeOrgId: org.id,
          members: [...get().members, ...members],
          locations: [...get().locations, ...locations],
          operators: [...get().operators, ...operators],
          locationCategories: [...get().locationCategories, ...cats],
          activeLocationId: first.id,
        });
        return {
          ok: true,
          orgId: org.id,
          locationIds: locations.map((l) => l.id),
        };
      },

      toggleLocationPackage: (locationId, packageId) => {
        const pkg = PACKAGE_BY_ID[packageId];
        set({
          locations: get().locations.map((l) => {
            if (l.id !== locationId) return l;
            const cur = new Set(l.enabledPackages ?? []);
            if (cur.has(packageId)) {
              if (pkg?.required) return l;
              cur.delete(packageId);
            } else {
              cur.add(packageId);
            }
            return { ...l, enabledPackages: Array.from(cur) as string[] };
          }),
        });
      },

      setLocationPackages: (locationId, packages) => {
        const required = Object.values(PACKAGE_BY_ID)
          .filter((p) => p.required)
          .map((p) => p.id);
        const merged = Array.from(new Set([...required, ...packages]));
        set({
          locations: get().locations.map((l) =>
            l.id === locationId ? { ...l, enabledPackages: merged } : l,
          ),
        });
      },

      locationHasPackage: (locationId, packageId) => {
        const loc = get().locations.find((l) => l.id === locationId);
        if (!loc) return false;
        const pkgs = loc.enabledPackages ?? [];
        return pkgs.includes(packageId);
      },

      locationAllowsView: (locationId, view) => {
        const need = packageForView(view);
        if (!need) return true;
        return get().locationHasPackage(locationId, need);
      },

      todayLineup: () => {
        const loc = get().activeLocationId;
        const day = new Date().getDay();
        const pads = get().pads.filter((p) => p.locationId === loc);
        return pads.map((pad) => {
          const merchant = pad.merchantId
            ? get().merchants.find((m) => m.id === pad.merchantId)
            : undefined;
          // day-specific assignments can override display notes
          const asg = get().schedule.find(
            (s) =>
              s.padId === pad.id &&
              (s.dayOfWeek === -1 || s.dayOfWeek === day),
          );
          return { pad, merchant, assignment: asg };
        });
      },

      ampsUsed: (locationId) =>
        get()
          .pads.filter(
            (p) =>
              p.locationId === locationId &&
              (p.status === "occupied" || p.status === "reserved"),
          )
          .reduce((s, p) => s + p.amps, 0),
    }),
    {
      name: "zest-saas-v8-empty",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SaasState>;
        const orgs =
          p.orgs && p.orgs.length > 0
            ? p.orgs
            : p.org
              ? [p.org]
              : current.orgs;
        const activeOrgId = p.activeOrgId || p.org?.id || current.activeOrgId;
        const org =
          orgs.find((o) => o.id === activeOrgId) || orgs[0] || current.org;
        const locations = (p.locations ?? current.locations).map((l) => ({
          ...l,
          createdBy: l.createdBy ?? "seed",
          operatingModel: l.operatingModel ?? "single_operator",
          hostBrandName: l.hostBrandName ?? l.name,
        }));
        return {
          ...current,
          ...p,
          orgs,
          org,
          activeOrgId: org.id,
          locations,
          operators: p.operators ?? current.operators ?? [],
          locationCategories:
            p.locationCategories ?? current.locationCategories ?? [],
          locationItems: p.locationItems ?? current.locationItems ?? [],
        };
      },
    },
  ),
);

export { PLATFORM };
