import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type {
  DeviceEnrollment,
  LeaseInvoice,
  OnboardingStep,
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
  PACKAGE_BY_ID,
} from "./packages";

const PLATFORM: PlatformCompany = {
  name: "Zest",
  legalName: "Zest Platform LLC",
  proprietors: [
    { name: "Michael Blair", role: "Co-founder & Proprietor" },
    { name: "Andy Baida", role: "Co-founder & Proprietor" },
  ],
  tagline: "Service, sharp. — restaurants, halls & truck pods under one canopy.",
  supportEmail: "support@zest.app",
  version: "1.0.0-demo",
};

function seedOrg(): SaasOrganization {
  return {
    id: "org_demo",
    name: "Seaport Collective",
    legalName: "Seaport Collective Markets LLC",
    plan: "growth",
    seats: 25,
    locationsIncluded: 5,
    merchantsIncluded: 40,
    billingEmail: "ops@seaport.example",
    status: "active",
    createdAt: Date.now() - 86400000 * 90,
  };
}

function seedMembers(): SaasMembership[] {
  return [
    {
      id: "mem_1",
      orgId: "org_demo",
      name: "Morgan Blair",
      email: "morgan@zest.app",
      role: "owner",
    },
    {
      id: "mem_admin",
      orgId: "org_demo",
      name: "Alex Rivera",
      email: "alex@zest.app",
      role: "admin",
    },
    {
      id: "mem_2",
      orgId: "org_demo",
      name: "Sam Okonkwo",
      email: "sam@seaport.example",
      role: "ops",
    },
    {
      id: "mem_3",
      orgId: "org_demo",
      name: "Jordan Lee",
      email: "jordan@seaport.example",
      role: "accountant",
    },
    {
      id: "mem_sup",
      orgId: "org_demo",
      name: "Riley Chen",
      email: "riley@zest.app",
      role: "support",
    },
  ];
}

function seedLocations(): SaasLocation[] {
  return [
    {
      id: "loc_hall",
      orgId: "org_demo",
      name: "Zest Market Hall",
      code: "ZS-HALL",
      mode: "food_hall",
      address: "42 Pier Avenue, Seaport",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("food_hall"),
    },
    {
      id: "loc_pod",
      orgId: "org_demo",
      name: "Westside Truck Pod",
      code: "ZS-POD",
      mode: "truck_pod",
      address: "880 Lot B, Industrial District",
      timezone: "America/Los_Angeles",
      open: true,
      padCapacity: 12,
      powerAmpsTotal: 600,
      enabledPackages: defaultPackagesForMode("truck_pod"),
    },
    {
      id: "loc_rest",
      orgId: "org_demo",
      name: "Forge Bistro",
      code: "ZS-BISTRO",
      mode: "restaurant",
      address: "12 Oak Street",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("restaurant"),
    },
    {
      id: "loc_ghost",
      orgId: "org_demo",
      name: "Forge Cloud Kitchen",
      code: "ZS-CLOUD",
      mode: "ghost_kitchen",
      address: "200 Commissary Way",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("ghost_kitchen"),
    },
    {
      id: "loc_cater",
      orgId: "org_demo",
      name: "Zest Occasions",
      code: "ZS-EVT",
      mode: "catering",
      address: "42 Pier Avenue",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("catering"),
    },
    {
      id: "loc_bar",
      orgId: "org_demo",
      name: "Pier Room",
      code: "ZS-LOUNGE",
      mode: "bar_lounge",
      address: "42 Pier Avenue",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("bar_lounge"),
    },
    {
      id: "loc_cafe",
      orgId: "org_demo",
      name: "Dockside Café",
      code: "ZS-CAFE",
      mode: "cafe",
      address: "8 Wharf Walk",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("cafe"),
    },
    {
      id: "loc_qsr",
      orgId: "org_demo",
      name: "Salty Window",
      code: "ZS-QSR",
      mode: "qsr",
      address: "14 Harbor Drive",
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: defaultPackagesForMode("qsr"),
    },
  ];
}

function seedMerchants(): PodMerchant[] {
  return [
    {
      id: "m_forge",
      orgId: "org_demo",
      name: "Forge Kitchen Co",
      cuisine: "New American",
      contactName: "Chris Forge",
      phone: "(555) 100-2001",
      bankLast4: "4821",
      w9OnFile: true,
      active: true,
      permitNumber: "MH-2201",
    },
    {
      id: "m_noodle",
      orgId: "org_demo",
      name: "Pier Noodle Co",
      cuisine: "Ramen",
      contactName: "Mina Park",
      phone: "(555) 100-2002",
      bankLast4: "9912",
      w9OnFile: true,
      active: true,
      permitNumber: "MH-2202",
    },
    {
      id: "m_taco",
      orgId: "org_demo",
      name: "Salty Taco",
      cuisine: "Mexican",
      contactName: "Diego Ruiz",
      phone: "(555) 100-2003",
      bankLast4: "3340",
      w9OnFile: true,
      active: true,
    },
    {
      id: "m_gelato",
      orgId: "org_demo",
      name: "Dockside Gelato",
      cuisine: "Dessert",
      contactName: "Elena Rossi",
      phone: "(555) 100-2004",
      bankLast4: "7788",
      w9OnFile: false,
      active: true,
    },
    {
      id: "m_bbq",
      orgId: "org_demo",
      name: "Smoke Stack BBQ",
      cuisine: "BBQ",
      contactName: "Ray Cole",
      phone: "(555) 100-3001",
      bankLast4: "5510",
      w9OnFile: true,
      active: true,
      permitNumber: "POD-441",
    },
    {
      id: "m_bao",
      orgId: "org_demo",
      name: "Bao Wow",
      cuisine: "Asian street",
      contactName: "Lin Wei",
      phone: "(555) 100-3002",
      bankLast4: "6621",
      w9OnFile: true,
      active: true,
      permitNumber: "POD-442",
    },
    {
      id: "m_vegan",
      orgId: "org_demo",
      name: "Green Grid",
      cuisine: "Vegan",
      contactName: "Avery Moss",
      phone: "(555) 100-3003",
      bankLast4: "7732",
      w9OnFile: true,
      active: true,
      permitNumber: "POD-443",
    },
    {
      id: "m_coffee",
      orgId: "org_demo",
      name: "Lot Roast",
      cuisine: "Coffee & pastry",
      contactName: "Pat Nguyen",
      phone: "(555) 100-3004",
      bankLast4: "8843",
      w9OnFile: true,
      active: true,
      permitNumber: "POD-444",
    },
  ];
}

function seedPads(): TruckPad[] {
  const loc = "loc_pod";
  const pads: TruckPad[] = [];
  const labels = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4"];
  const occ = [
    { merchantId: "m_bbq", merchantName: "Smoke Stack BBQ" },
    { merchantId: "m_bao", merchantName: "Bao Wow" },
    { merchantId: "m_vegan", merchantName: "Green Grid" },
    { merchantId: "m_coffee", merchantName: "Lot Roast" },
  ];
  labels.forEach((label, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const o = occ[i];
    pads.push({
      id: `pad_${label}`,
      locationId: loc,
      label,
      x: 12 + col * 22,
      y: 15 + row * 28,
      amps: i % 3 === 0 ? 50 : 30,
      status: o ? "occupied" : i === 7 ? "reserved" : i === 11 ? "maintenance" : "vacant",
      merchantId: o?.merchantId,
      merchantName: o?.merchantName,
      leaseStart: o ? Date.now() - 86400000 * 14 : undefined,
      leaseEnd: o ? Date.now() + 86400000 * 76 : undefined,
      monthlyRentCents: 120000 + (i % 3) * 15000,
      powerFeeCents: i % 3 === 0 ? 35000 : 20000,
      gmvPercent: 5,
    });
  });
  return pads;
}

function seedSchedule(): PadAssignment[] {
  return [
    {
      id: "as_1",
      padId: "pad_A1",
      merchantId: "m_bbq",
      merchantName: "Smoke Stack BBQ",
      dayOfWeek: -1,
      startDate: "2026-07-01",
    },
    {
      id: "as_2",
      padId: "pad_A2",
      merchantId: "m_bao",
      merchantName: "Bao Wow",
      dayOfWeek: -1,
      startDate: "2026-07-01",
    },
    {
      id: "as_3",
      padId: "pad_A3",
      merchantId: "m_vegan",
      merchantName: "Green Grid",
      dayOfWeek: 5,
      startDate: "2026-08-01",
      notes: "Fri–Sun peak",
    },
    {
      id: "as_4",
      padId: "pad_A4",
      merchantId: "m_coffee",
      merchantName: "Lot Roast",
      dayOfWeek: -1,
      startDate: "2026-06-15",
    },
  ];
}

function seedDevices(): DeviceEnrollment[] {
  return [
    {
      id: "dev_galaxy_a",
      locationId: "loc_hall",
      name: "Galaxy tablet A — Floor / Server",
      type: "handheld",
      status: "online",
      lastSeenAt: Date.now() - 15000,
      serial: "SAM-TAB-A-001",
    },
    {
      id: "dev_galaxy_b",
      locationId: "loc_hall",
      name: "Galaxy tablet B — Bar / Manager",
      type: "pos",
      status: "online",
      lastSeenAt: Date.now() - 20000,
      serial: "SAM-TAB-B-002",
    },
    {
      id: "dev_android_27",
      locationId: "loc_hall",
      name: '27" Android touch — Kitchen KDS',
      type: "kds",
      status: "online",
      lastSeenAt: Date.now() - 10000,
      serial: "AND-KDS-27-001",
    },
    {
      id: "dev_3",
      locationId: "loc_pod",
      name: "Lot kiosk 1",
      type: "kiosk",
      status: "online",
      lastSeenAt: Date.now() - 60000,
      serial: "ZS-KIO-3001",
    },
    {
      id: "dev_5",
      locationId: "loc_hall",
      name: "Receipt printer bar (planned)",
      type: "printer",
      status: "offline",
      lastSeenAt: Date.now() - 86400000,
      serial: "ZS-PR-5001",
    },
  ];
}

function seedOnboarding(): OnboardingStep[] {
  return [
    { id: "ob_1", title: "Create organization", done: true },
    { id: "ob_2", title: "Add first location", done: true },
    { id: "ob_3", title: "Invite team members", done: true },
    { id: "ob_4", title: "Onboard merchants / trucks", done: true },
    { id: "ob_5", title: "Configure settlement & host cut", done: true },
    { id: "ob_6", title: "Enroll devices", done: false },
    { id: "ob_7", title: "Connect integrations", done: false },
    { id: "ob_8", title: "Run first period close", done: false },
  ];
}

interface SaasState {
  platform: PlatformCompany;
  org: SaasOrganization;
  members: SaasMembership[];
  locations: SaasLocation[];
  merchants: PodMerchant[];
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
}

export const useSaasStore = create<SaasState>()(
  persist(
    (set, get) => ({
      platform: PLATFORM,
      org: seedOrg(),
      members: seedMembers(),
      locations: seedLocations(),
      merchants: seedMerchants(),
      pads: seedPads(),
      schedule: seedSchedule(),
      devices: seedDevices(),
      invoices: [],
      onboarding: seedOnboarding(),
      activeLocationId: "loc_pod",
      platformAuthed: false,
      platformAdminName: "",
      platformAdminRole: "",

      setActiveLocation: (id) => set({ activeLocationId: id }),

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
      name: "zest-saas-v7",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export { PLATFORM };
