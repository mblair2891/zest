import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import * as seed from "./full-seed";
import type {
  AlcoholServiceLog,
  AllergenIncident,
  AnomalyAlert,
  ApiKey,
  BreakEvent,
  CycleCount,
  GuestFeedback,
  HardwareDevice,
  IncidentReport,
  Localization,
  OfflineOp,
  PackagePhase,
  PciChecklistItem,
  PrepListItem,
  PrivateRoom,
  RolePermissions,
  SafeDrop,
  SectionAssignment,
  ShiftSwap,
  TempLog,
  TipPoolRule,
  TrainingModule,
  WasteEntry,
  WebhookEvent,
  PettyCashTxn,
  ReviewRequest,
} from "./full-types";

interface FullState {
  phasesCompleted: PackagePhase[];
  trainingMode: boolean;
  lastPhaseAt: number;
  permissions: typeof seed.PERMISSIONS;
  rolePerms: RolePermissions[];
  hardware: HardwareDevice[];
  webhooks: WebhookEvent[];
  offlineQueue: OfflineOp[];
  waste: WasteEntry[];
  tipPool: TipPoolRule[];
  alcoholLog: AlcoholServiceLog[];
  tempLogs: TempLog[];
  incidents: IncidentReport[];
  shiftSwaps: ShiftSwap[];
  breaks: BreakEvent[];
  training: TrainingModule[];
  compBudgets: typeof seed.COMP_BUDGETS;
  taxJurisdictions: typeof seed.TAX_JURISDICTIONS;
  dayparts: typeof seed.DAYPARTS;
  channelPrices: typeof seed.CHANNEL_PRICES;
  bundles: typeof seed.BUNDLES;
  prixFixe: typeof seed.PRIX_FIXE;
  wineCellar: typeof seed.WINE_CELLAR;
  bottleService: typeof seed.BOTTLE_SERVICE;
  sections: SectionAssignment[];
  forecast: typeof seed.FORECAST;
  anomalies: AnomalyAlert[];
  safeDrops: SafeDrop[];
  petty: PettyCashTxn[];
  prepList: PrepListItem[];
  cycleCounts: CycleCount[];
  feedback: GuestFeedback[];
  reviewRequests: ReviewRequest[];
  resDeposits: typeof seed.RES_DEPOSITS;
  kioskSessions: typeof seed.KIOSK_SESSIONS;
  apiKeys: ApiKey[];
  configVersions: typeof seed.CONFIG_VERSIONS;
  royalties: typeof seed.ROYALTIES;
  brandAudits: typeof seed.BRAND_AUDITS;
  pci: PciChecklistItem[];
  mystery: typeof seed.MYSTERY;
  perf: typeof seed.PERF;
  flashPL: typeof seed.FLASH_PL;
  courseSlas: typeof seed.COURSE_SLAS;
  privateRooms: PrivateRoom[];
  allergenIncidents: AllergenIncident[];
  corkage: typeof seed.CORKAGE;
  overbooking: typeof seed.OVERBOOKING;
  pacing: typeof seed.PACING;
  localization: Localization;

  markPhase: (p: PackagePhase) => void;
  setTrainingMode: (on: boolean) => void;
  can: (role: string, perm: string) => boolean;
  toggleRolePerm: (role: string, perm: string) => void;
  setDeviceStatus: (id: string, status: HardwareDevice["status"]) => void;
  pushWebhook: (topic: string, payload: string) => void;
  retryWebhook: (id: string) => void;
  queueOffline: (type: string, detail: string) => void;
  syncOffline: () => void;
  logWaste: (entry: Omit<WasteEntry, "id" | "at">) => void;
  toggleTipPool: (id: string) => void;
  calcTipOut: (tipsCents: number) => { role: string; amount: number }[];
  logAlcohol: (entry: Omit<AlcoholServiceLog, "id" | "at">) => void;
  verifyAge: (birthYear: number) => { ok: boolean; age: number; message: string };
  logTemp: (station: string, tempF: number, employeeId: string) => void;
  addIncident: (entry: Omit<IncidentReport, "id" | "at" | "resolved">) => void;
  resolveIncident: (id: string) => void;
  approveSwap: (id: string) => void;
  denySwap: (id: string) => void;
  startBreak: (employeeId: string, type: BreakEvent["type"]) => void;
  endBreak: (id: string) => void;
  completeTraining: (moduleId: string, employeeId: string) => void;
  useCompBudget: (role: string, cents: number) => { ok: boolean; error?: string };
  assignSection: (section: string, serverId: string | null) => void;
  ackAnomaly: (id: string) => void;
  addSafeDrop: (amountCents: number, envelope: string, employeeId: string) => void;
  addPetty: (amountCents: number, memo: string, employeeId: string) => void;
  togglePrep: (id: string) => void;
  submitCycleCount: (id: string, counted: number) => void;
  addFeedback: (score: number, comment: string) => void;
  sendReviewRequest: (guestName: string) => void;
  captureDeposit: (reservationId: string) => void;
  forfeitDeposit: (reservationId: string) => void;
  rotateApiKey: (id: string) => void;
  publishConfig: (label: string, author: string, notes: string) => void;
  payRoyalty: (period: string, locationId: string) => void;
  togglePci: (id: string) => void;
  bookRoom: (id: string, eventName: string) => void;
  freeRoom: (id: string) => void;
  reportAllergen: (guestName: string, allergen: string) => void;
  escalateAllergen: (id: string) => void;
  setLanguage: (lang: Localization["language"]) => void;
  setCorkage: (partial: Partial<typeof seed.CORKAGE>) => void;
  updatePacing: (time: string, booked: number) => void;
  refreshFlashPL: (sales: number, cogs: number, labor: number) => void;
}

function bootstrap() {
  return {
    phasesCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as PackagePhase[],
    trainingMode: false,
    lastPhaseAt: Date.now(),
    permissions: seed.PERMISSIONS.map((p) => ({ ...p })),
    rolePerms: seed.ROLE_PERMS.map((r) => ({ ...r, allow: [...r.allow] })),
    hardware: seed.HARDWARE.map((h) => ({ ...h })),
    webhooks: seed.WEBHOOKS.map((w) => ({ ...w })),
    offlineQueue: seed.OFFLINE_QUEUE.map((o) => ({ ...o })),
    waste: seed.WASTE.map((w) => ({ ...w })),
    tipPool: seed.TIP_POOL.map((t) => ({ ...t, roles: [...t.roles] })),
    alcoholLog: [] as AlcoholServiceLog[],
    tempLogs: seed.TEMP_LOGS.map((t) => ({ ...t })),
    incidents: seed.INCIDENTS.map((i) => ({ ...i })),
    shiftSwaps: seed.SHIFT_SWAPS.map((s) => ({ ...s })),
    breaks: [] as BreakEvent[],
    training: seed.TRAINING.map((t) => ({
      ...t,
      requiredFor: [...t.requiredFor],
      completedBy: [...t.completedBy],
    })),
    compBudgets: seed.COMP_BUDGETS.map((c) => ({ ...c })),
    taxJurisdictions: seed.TAX_JURISDICTIONS.map((t) => ({ ...t })),
    dayparts: seed.DAYPARTS.map((d) => ({
      ...d,
      categoryIds: [...d.categoryIds],
    })),
    channelPrices: seed.CHANNEL_PRICES.map((c) => ({ ...c })),
    bundles: seed.BUNDLES.map((b) => ({ ...b, itemIds: [...b.itemIds] })),
    prixFixe: seed.PRIX_FIXE.map((p) => ({
      ...p,
      courses: p.courses.map((c) => ({ ...c, choices: [...c.choices] })),
    })),
    wineCellar: seed.WINE_CELLAR.map((w) => ({ ...w })),
    bottleService: seed.BOTTLE_SERVICE.map((b) => ({
      ...b,
      mixersIncluded: [...b.mixersIncluded],
    })),
    sections: seed.SECTIONS.map((s) => ({
      ...s,
      tableIds: [...s.tableIds],
    })),
    forecast: seed.FORECAST.map((f) => ({ ...f })),
    anomalies: seed.ANOMALIES.map((a) => ({ ...a })),
    safeDrops: seed.SAFE_DROPS.map((s) => ({ ...s })),
    petty: seed.PETTY.map((p) => ({ ...p })),
    prepList: seed.PREP_LIST.map((p) => ({ ...p })),
    cycleCounts: seed.CYCLE_COUNTS.map((c) => ({ ...c })),
    feedback: seed.FEEDBACK.map((f) => ({ ...f })),
    reviewRequests: seed.REVIEW_REQUESTS.map((r) => ({ ...r })),
    resDeposits: seed.RES_DEPOSITS.map((r) => ({ ...r })),
    kioskSessions: [] as typeof seed.KIOSK_SESSIONS,
    apiKeys: seed.API_KEYS.map((a) => ({ ...a, scopes: [...a.scopes] })),
    configVersions: seed.CONFIG_VERSIONS.map((c) => ({ ...c })),
    royalties: seed.ROYALTIES.map((r) => ({ ...r })),
    brandAudits: seed.BRAND_AUDITS.map((b) => ({ ...b })),
    pci: seed.PCI_CHECKLIST.map((p) => ({ ...p })),
    mystery: seed.MYSTERY.map((m) => ({ ...m })),
    perf: seed.PERF.map((p) => ({ ...p })),
    flashPL: { ...seed.FLASH_PL },
    courseSlas: seed.COURSE_SLAS.map((c) => ({ ...c })),
    privateRooms: seed.PRIVATE_ROOMS.map((r) => ({ ...r })),
    allergenIncidents: [] as AllergenIncident[],
    corkage: { ...seed.CORKAGE },
    overbooking: { ...seed.OVERBOOKING },
    pacing: seed.PACING.map((p) => ({ ...p })),
    localization: { ...seed.LOCALIZATION },
  };
}

export const useFullStore = create<FullState>()(
  persist(
    (set, get) => ({
      ...bootstrap(),

      markPhase: (p) =>
        set({
          phasesCompleted: Array.from(
            new Set([...get().phasesCompleted, p]),
          ).sort((a, b) => a - b) as PackagePhase[],
          lastPhaseAt: Date.now(),
        }),
      setTrainingMode: (on) => set({ trainingMode: on }),
      can: (role, perm) =>
        !!get().rolePerms.find((r) => r.role === role)?.allow.includes(perm),
      toggleRolePerm: (role, perm) =>
        set({
          rolePerms: get().rolePerms.map((r) => {
            if (r.role !== role) return r;
            const has = r.allow.includes(perm);
            return {
              ...r,
              allow: has
                ? r.allow.filter((x) => x !== perm)
                : [...r.allow, perm],
            };
          }),
        }),
      setDeviceStatus: (id, status) =>
        set({
          hardware: get().hardware.map((h) =>
            h.id === id ? { ...h, status, lastSeenAt: Date.now() } : h,
          ),
        }),
      pushWebhook: (topic, payload) => {
        const event: WebhookEvent = {
          id: uid("wh"),
          at: Date.now(),
          topic,
          payload,
          status: "delivered",
        };
        set({ webhooks: [event, ...get().webhooks].slice(0, 100) });
      },
      retryWebhook: (id) =>
        set({
          webhooks: get().webhooks.map((w) =>
            w.id === id ? { ...w, status: "delivered" as const } : w,
          ),
        }),
      queueOffline: (type, detail) =>
        set({
          offlineQueue: [
            {
              id: uid("off"),
              at: Date.now(),
              type,
              detail,
              synced: false,
            },
            ...get().offlineQueue,
          ],
        }),
      syncOffline: () =>
        set({
          offlineQueue: get().offlineQueue.map((o) => ({
            ...o,
            synced: true,
          })),
        }),
      logWaste: (entry) =>
        set({
          waste: [{ ...entry, id: uid("w"), at: Date.now() }, ...get().waste],
        }),
      toggleTipPool: (id) =>
        set({
          tipPool: get().tipPool.map((t) =>
            t.id === id ? { ...t, active: !t.active } : t,
          ),
        }),
      calcTipOut: (tipsCents) => {
        const out: { role: string; amount: number }[] = [];
        for (const rule of get().tipPool.filter((t) => t.active)) {
          const amount = Math.round(tipsCents * (rule.percentOfTips / 100));
          for (const role of rule.roles) {
            out.push({
              role,
              amount: Math.round(amount / rule.roles.length),
            });
          }
        }
        return out;
      },
      logAlcohol: (entry) =>
        set({
          alcoholLog: [
            { ...entry, id: uid("alc"), at: Date.now() },
            ...get().alcoholLog,
          ],
        }),
      verifyAge: (birthYear) => {
        const age = new Date().getFullYear() - birthYear;
        if (age >= 21)
          return { ok: true, age, message: `Age ${age} — OK to serve` };
        return { ok: false, age, message: `Age ${age} — UNDER 21` };
      },
      logTemp: (station, tempF, employeeId) => {
        const ok = tempF >= 33 && tempF <= 41;
        set({
          tempLogs: [
            {
              id: uid("tl"),
              at: Date.now(),
              station,
              tempF,
              ok,
              employeeId,
            },
            ...get().tempLogs,
          ],
        });
      },
      addIncident: (entry) =>
        set({
          incidents: [
            {
              ...entry,
              id: uid("inc"),
              at: Date.now(),
              resolved: false,
            },
            ...get().incidents,
          ],
        }),
      resolveIncident: (id) =>
        set({
          incidents: get().incidents.map((i) =>
            i.id === id ? { ...i, resolved: true } : i,
          ),
        }),
      approveSwap: (id) =>
        set({
          shiftSwaps: get().shiftSwaps.map((s) =>
            s.id === id ? { ...s, status: "approved" } : s,
          ),
        }),
      denySwap: (id) =>
        set({
          shiftSwaps: get().shiftSwaps.map((s) =>
            s.id === id ? { ...s, status: "denied" } : s,
          ),
        }),
      startBreak: (employeeId, type) =>
        set({
          breaks: [
            {
              id: uid("brk"),
              employeeId,
              type,
              start: Date.now(),
              compliant: true,
            },
            ...get().breaks,
          ],
        }),
      endBreak: (id) =>
        set({
          breaks: get().breaks.map((b) => {
            if (b.id !== id) return b;
            const mins = (Date.now() - b.start) / 60000;
            return {
              ...b,
              end: Date.now(),
              compliant: b.type === "meal" ? mins >= 30 : mins >= 10,
            };
          }),
        }),
      completeTraining: (moduleId, employeeId) =>
        set({
          training: get().training.map((t) =>
            t.id === moduleId && !t.completedBy.includes(employeeId)
              ? { ...t, completedBy: [...t.completedBy, employeeId] }
              : t,
          ),
        }),
      useCompBudget: (role, cents) => {
        const b = get().compBudgets.find((c) => c.role === role);
        if (!b) return { ok: false, error: "No budget" };
        if (b.usedCents + cents > b.dailyLimitCents)
          return { ok: false, error: "Over daily comp budget" };
        set({
          compBudgets: get().compBudgets.map((c) =>
            c.role === role ? { ...c, usedCents: c.usedCents + cents } : c,
          ),
        });
        return { ok: true };
      },
      assignSection: (section, serverId) =>
        set({
          sections: get().sections.map((s) =>
            s.section === section ? { ...s, serverId } : s,
          ),
        }),
      ackAnomaly: (id) =>
        set({
          anomalies: get().anomalies.map((a) =>
            a.id === id ? { ...a, acknowledged: true } : a,
          ),
        }),
      addSafeDrop: (amountCents, envelope, employeeId) =>
        set({
          safeDrops: [
            {
              id: uid("sd"),
              at: Date.now(),
              amountCents,
              envelope,
              employeeId,
            },
            ...get().safeDrops,
          ],
        }),
      addPetty: (amountCents, memo, employeeId) =>
        set({
          petty: [
            {
              id: uid("pc"),
              at: Date.now(),
              amountCents,
              memo,
              employeeId,
            },
            ...get().petty,
          ],
        }),
      togglePrep: (id) =>
        set({
          prepList: get().prepList.map((p) =>
            p.id === id ? { ...p, done: !p.done } : p,
          ),
        }),
      submitCycleCount: (id, counted) =>
        set({
          cycleCounts: get().cycleCounts.map((c) =>
            c.id === id
              ? { ...c, counted, variance: counted - c.expected }
              : c,
          ),
        }),
      addFeedback: (score, comment) =>
        set({
          feedback: [
            {
              id: uid("fb"),
              at: Date.now(),
              score,
              comment,
              channel: "table",
            },
            ...get().feedback,
          ],
        }),
      sendReviewRequest: (guestName) =>
        set({
          reviewRequests: [
            {
              id: uid("rr"),
              guestName,
              channel: "google",
              status: "sent",
              at: Date.now(),
            },
            ...get().reviewRequests,
          ],
        }),
      captureDeposit: (reservationId) =>
        set({
          resDeposits: get().resDeposits.map((d) =>
            d.reservationId === reservationId
              ? { ...d, status: "captured" }
              : d,
          ),
        }),
      forfeitDeposit: (reservationId) =>
        set({
          resDeposits: get().resDeposits.map((d) =>
            d.reservationId === reservationId
              ? { ...d, status: "forfeited" }
              : d,
          ),
        }),
      rotateApiKey: (id) =>
        set({
          apiKeys: get().apiKeys.map((a) =>
            a.id === id
              ? {
                  ...a,
                  prefix: `summex_live_${Math.random().toString(36).slice(2, 6)}`,
                  createdAt: Date.now(),
                }
              : a,
          ),
        }),
      publishConfig: (label, author, notes) =>
        set({
          configVersions: [
            { id: uid("cv"), label, at: Date.now(), author, notes },
            ...get().configVersions,
          ],
        }),
      payRoyalty: (period, locationId) =>
        set({
          royalties: get().royalties.map((r) =>
            r.period === period && r.locationId === locationId
              ? { ...r, paid: true }
              : r,
          ),
        }),
      togglePci: (id) =>
        set({
          pci: get().pci.map((p) =>
            p.id === id ? { ...p, done: !p.done } : p,
          ),
        }),
      bookRoom: (id, eventName) =>
        set({
          privateRooms: get().privateRooms.map((r) =>
            r.id === id ? { ...r, booked: true, eventName } : r,
          ),
        }),
      freeRoom: (id) =>
        set({
          privateRooms: get().privateRooms.map((r) =>
            r.id === id
              ? { ...r, booked: false, eventName: undefined }
              : r,
          ),
        }),
      reportAllergen: (guestName, allergen) =>
        set({
          allergenIncidents: [
            {
              id: uid("ai"),
              at: Date.now(),
              guestName,
              allergen,
              status: "open",
            },
            ...get().allergenIncidents,
          ],
        }),
      escalateAllergen: (id) =>
        set({
          allergenIncidents: get().allergenIncidents.map((a) =>
            a.id === id ? { ...a, status: "escalated" } : a,
          ),
        }),
      setLanguage: (lang) =>
        set({ localization: { ...get().localization, language: lang } }),
      setCorkage: (partial) =>
        set({ corkage: { ...get().corkage, ...partial } }),
      updatePacing: (time, booked) =>
        set({
          pacing: get().pacing.map((p) =>
            p.time === time ? { ...p, booked } : p,
          ),
        }),
      refreshFlashPL: (sales, cogs, labor) => {
        const prime = sales > 0 ? ((cogs + labor) / sales) * 100 : 0;
        set({
          flashPL: {
            salesCents: sales,
            cogsCents: cogs,
            laborCents: labor,
            primeCostPct: Math.round(prime * 10) / 10,
            netEstimateCents: Math.round(sales * 0.12),
          },
        });
      },
    }),
    {
      name: "summex-full-package-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
