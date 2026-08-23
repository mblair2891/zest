import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type {
  DailyCloseout,
  DrinkSuggestion,
  DrinkWizardAnswers,
  InventoryAiReport,
  LaborSettings,
  PayPeriod,
  PourRecipe,
  PunchStatus,
  StockItem,
  SupervisorAlert,
  Supplier,
  SupplierOrder,
  TimePunch,
} from "./ops-types";

const DEFAULT_LABOR: LaborSettings = {
  clockInEarlyMinutes: 15,
  clockInLateMinutes: 10,
  clockOutRedFlagMinutes: 20,
  dailyCloseoutTime: "04:00",
  payPeriodType: "biweekly",
  payPeriodEndDay: 0,
  payrollMode: "auto_export",
  defaultSupervisorId: "emp_mgr",
  payrollProcessorId: "adp",
  requirePublishedShiftToClockIn: true,
};

function seedStock(): StockItem[] {
  return [];
}

function seedRecipes(): PourRecipe[] {
  return [];
}

function seedSuppliers(): Supplier[] {
  return [];
}

/** Simulated sold qty for AI theoretical use (demo sales for the period) */
function demoSalesCounts(_period: "daily" | "weekly" | "monthly"): Record<string, number> {
  return {};
}

function toBottles(stock: StockItem, qtyInBase: number): number {
  if (stock.unitSizeLabel === "ml" && stock.unit === "bottle") {
    return qtyInBase / stock.unitSize;
  }
  return qtyInBase;
}

export function suggestDrinks(
  answers: DrinkWizardAnswers,
  foodNames: string[] = [],
): DrinkSuggestion[] {
  const library: (DrinkSuggestion & {
    spirits: string[];
    profiles: string[];
  })[] = [
    {
      id: "ds_1",
      name: "Citrus Snap Martini",
      tagline: "Clean gin, bright lemon oil, dry finish",
      spirit: "Gin",
      profile: "sour_citrus",
      ingredients: ["2 oz gin", "0.25 oz dry vermouth", "lemon twist"],
      build: "Stir, strain, coupe",
      glass: "Coupe",
      spirits: ["gin", "any"],
      profiles: ["sour_citrus", "light_refreshing", "savory"],
      confidence: 0.9,
    },
    {
      id: "ds_2",
      name: "Velvet Cosmo",
      tagline: "Vodka, cranberry, orange liqueur — soft and fruity",
      spirit: "Vodka",
      profile: "sweet_fruity",
      ingredients: ["1.5 oz vodka", "0.5 oz triple sec", "1 oz cranberry", "lime"],
      build: "Shake hard, strain",
      glass: "Martini",
      spirits: ["vodka", "any"],
      profiles: ["sweet_fruity"],
      menuItemId: "mi_cosmo",
      confidence: 0.92,
      pairsWith: "lighter apps, salads",
    },
    {
      id: "ds_3",
      name: "Smoke & Cherry Old Fashioned",
      tagline: "Bourbon, demerara, cherry bark bitters",
      spirit: "Whiskey",
      profile: "savory",
      ingredients: ["2 oz bourbon", "1 barspoon demerara", "2 dash bitters"],
      build: "Stir over ice, rocks",
      glass: "Rocks",
      spirits: ["whiskey", "any"],
      profiles: ["savory", "bitter", "spicy"],
      menuItemId: "mi_oldf",
      confidence: 0.88,
      pairsWith: "burgers, wings, steak",
    },
    {
      id: "ds_4",
      name: "Lot Daiquiri",
      tagline: "Rum, lime, simple — sharp and sessionable",
      spirit: "Rum",
      profile: "sour_citrus",
      ingredients: ["2 oz white rum", "1 oz lime", "0.75 oz simple"],
      build: "Shake, coupe",
      glass: "Coupe",
      spirits: ["rum", "any"],
      profiles: ["sour_citrus", "sweet_fruity", "light_refreshing"],
      menuItemId: "mi_daiquiri",
      confidence: 0.9,
    },
    {
      id: "ds_5",
      name: "Salt Rim Margarita",
      tagline: "Tequila, citrus, triple sec — bright heat",
      spirit: "Tequila",
      profile: "sour_citrus",
      ingredients: ["2 oz blanco", "1 oz lime", "0.75 oz triple sec"],
      build: "Shake, rocks, salt rim",
      glass: "Rocks",
      spirits: ["tequila", "any"],
      profiles: ["sour_citrus", "spicy", "savory"],
      menuItemId: "mi_marg",
      confidence: 0.91,
      pairsWith: "tacos, wings, fries",
    },
    {
      id: "ds_6",
      name: "Garden Highball",
      tagline: "Gin, cucumber, soda — savory & light",
      spirit: "Gin",
      profile: "savory",
      ingredients: ["1.5 oz gin", "cucumber", "soda", "pinch salt"],
      build: "Build tall",
      glass: "Highball",
      spirits: ["gin", "vodka", "any"],
      profiles: ["savory", "light_refreshing"],
      confidence: 0.84,
      pairsWith: "salads, seafood",
    },
    {
      id: "ds_7",
      name: "Espresso Cream",
      tagline: "Vodka, coffee liqueur, cream",
      spirit: "Vodka",
      profile: "creamy",
      ingredients: ["1 oz vodka", "1 oz coffee liqueur", "1 oz cream"],
      build: "Shake, coupe",
      glass: "Coupe",
      spirits: ["vodka", "any"],
      profiles: ["creamy", "sweet_fruity"],
      confidence: 0.82,
      pairsWith: "dessert",
    },
    {
      id: "ds_8",
      name: "Spiced Rum Mule",
      tagline: "Rum, ginger, lime — spicy kick",
      spirit: "Rum",
      profile: "spicy",
      ingredients: ["2 oz rum", "ginger beer", "lime"],
      build: "Build copper mug",
      glass: "Mug",
      spirits: ["rum", "vodka", "any"],
      profiles: ["spicy", "light_refreshing"],
      confidence: 0.86,
    },
  ];

  const scored = library
    .map((d) => {
      let score = d.confidence;
      if (answers.spirit !== "any" && answers.spirit !== "none") {
        if (d.spirits.includes(answers.spirit)) score += 0.25;
        else score -= 0.4;
      }
      if (d.profiles.includes(answers.profile)) score += 0.2;
      else score -= 0.15;
      if (answers.strength === "session" && d.ingredients.some((i) => i.includes("soda")))
        score += 0.08;
      if (answers.strength === "strong" && d.ingredients.some((i) => i.startsWith("2 oz")))
        score += 0.06;
      // food pairing boost
      const foodBlob = foodNames.join(" ").toLowerCase();
      if (foodBlob && d.pairsWith) {
        const pw = d.pairsWith.toLowerCase();
        if (
          (foodBlob.includes("burger") && pw.includes("burger")) ||
          (foodBlob.includes("wing") && pw.includes("wing")) ||
          (foodBlob.includes("fries") && pw.includes("fries")) ||
          (foodBlob.includes("taco") && pw.includes("taco"))
        ) {
          score += 0.15;
        }
      }
      return { ...d, confidence: Math.min(0.99, Math.max(0.1, score)) };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(({ spirits: _s, profiles: _p, ...rest }) => rest);

  return scored;
}

interface OpsState {
  labor: LaborSettings;
  punches: TimePunch[];
  alerts: SupervisorAlert[];
  closeouts: DailyCloseout[];
  payPeriods: PayPeriod[];
  stock: StockItem[];
  pourRecipes: PourRecipe[];
  inventoryReports: InventoryAiReport[];
  suppliers: Supplier[];
  supplierOrders: SupplierOrder[];
  /** last ticket closed timestamp by employeeId */
  lastTicketByEmployee: Record<string, number>;
  /** demo scheduled shifts for today window checks */
  todayShifts: {
    id: string;
    employeeId: string;
    start: number;
    end: number;
    published: boolean;
  }[];

  updateLabor: (patch: Partial<LaborSettings>) => void;
  recordTicketClosed: (employeeId: string, at?: number) => void;
  clockIn: (
    employeeId: string,
    employeeName: string,
    opts?: { force?: boolean },
  ) => { ok: boolean; error?: string; punchId?: string };
  clockOut: (
    employeeId: string,
    employeeName: string,
  ) => {
    ok: boolean;
    error?: string;
    status?: PunchStatus;
    redFlag?: boolean;
    minutesFromLastTicket?: number;
  };
  approvePunch: (punchId: string, supervisorName: string) => void;
  correctPunch: (
    punchId: string,
    patch: Partial<Pick<TimePunch, "clockInAt" | "clockOutAt" | "notes">>,
    supervisorName: string,
  ) => void;
  rejectPunch: (punchId: string, supervisorName: string, notes: string) => void;
  resolveAlert: (id: string) => void;
  runDailyCloseout: () => DailyCloseout;
  runPayroll: () => { ok: boolean; message: string; period?: PayPeriod };
  setPar: (stockId: string, par: number, reorderPoint?: number) => void;
  receiveStock: (stockId: string, qty: number) => void;
  generateInventoryReport: (
    period: "daily" | "weekly" | "monthly",
  ) => InventoryAiReport;
  toggleSupplier: (id: string) => void;
  createReorderDraft: (supplierId: string) => SupplierOrder | null;
  submitSupplierOrder: (id: string) => void;
  seedTodayShifts: (employeeIds: string[]) => void;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function minutesBetween(a: number, b: number) {
  return Math.round(Math.abs(b - a) / 60000);
}

export const useOpsStore = create<OpsState>()(
  persist(
    (set, get) => ({
      labor: DEFAULT_LABOR,
      punches: [],
      alerts: [],
      closeouts: [],
      payPeriods: [],
      stock: seedStock(),
      pourRecipes: seedRecipes(),
      inventoryReports: [],
      suppliers: seedSuppliers(),
      supplierOrders: [],
      lastTicketByEmployee: {},
      todayShifts: [],

      updateLabor: (patch) =>
        set({ labor: { ...get().labor, ...patch } }),

      recordTicketClosed: (employeeId, at = Date.now()) => {
        set({
          lastTicketByEmployee: {
            ...get().lastTicketByEmployee,
            [employeeId]: at,
          },
        });
      },

      seedTodayShifts: (employeeIds) => {
        const sod = startOfDay();
        const shifts = employeeIds.map((id, i) => {
          const start = sod + (11 + (i % 4)) * 3600000;
          const end = start + 8 * 3600000;
          return {
            id: `ts_${id}`,
            employeeId: id,
            start,
            end,
            published: true,
          };
        });
        set({ todayShifts: shifts });
      },

      clockIn: (employeeId, employeeName, opts) => {
        const open = get().punches.find(
          (p) => p.employeeId === employeeId && p.status === "open",
        );
        if (open) return { ok: false, error: "Already clocked in" };

        const labor = get().labor;
        const now = Date.now();
        let shift = get().todayShifts.find((s) => s.employeeId === employeeId);
        if (!shift && get().todayShifts.length === 0) {
          // auto seed a shift window around now for demo
          shift = {
            id: uid("ts"),
            employeeId,
            start: now - 5 * 60000,
            end: now + 8 * 3600000,
            published: true,
          };
          set({ todayShifts: [...get().todayShifts, shift] });
        }

        if (labor.requirePublishedShiftToClockIn && !opts?.force) {
          if (!shift || !shift.published) {
            return {
              ok: false,
              error: "No published shift — manager override required",
            };
          }
          const early = shift.start - labor.clockInEarlyMinutes * 60000;
          const late = shift.start + labor.clockInLateMinutes * 60000;
          if (now < early) {
            return {
              ok: false,
              error: `Too early — clock-in opens ${labor.clockInEarlyMinutes}m before shift`,
            };
          }
          if (now > late) {
            return {
              ok: false,
              error: `Outside clock-in window (+${labor.clockInLateMinutes}m). Supervisor can force.`,
            };
          }
        }

        const punch: TimePunch = {
          id: uid("tp"),
          employeeId,
          employeeName,
          shiftId: shift?.id,
          scheduledStart: shift?.start,
          scheduledEnd: shift?.end,
          clockInAt: now,
          status: "open",
          redFlag: false,
        };
        set({ punches: [punch, ...get().punches] });
        return { ok: true, punchId: punch.id };
      },

      clockOut: (employeeId, employeeName) => {
        const punch = get().punches.find(
          (p) => p.employeeId === employeeId && p.status === "open",
        );
        if (!punch) return { ok: false, error: "Not clocked in" };

        const now = Date.now();
        const lastTicket = get().lastTicketByEmployee[employeeId];
        const labor = get().labor;
        let minutesFromLastTicket: number | undefined;
        let redFlag = false;
        let status: PunchStatus = "auto_approved";
        let redFlagReason: string | undefined;

        if (lastTicket) {
          minutesFromLastTicket = minutesBetween(lastTicket, now);
          if (minutesFromLastTicket <= labor.clockOutRedFlagMinutes) {
            status = "auto_approved";
            redFlag = false;
          } else {
            status = "pending_review";
            redFlag = true;
            redFlagReason = `Clock-out ${minutesFromLastTicket}m after last closed ticket (window ${labor.clockOutRedFlagMinutes}m)`;
          }
        } else {
          // no tickets closed — flag for review (may be host/manager)
          status = "pending_review";
          redFlag = true;
          redFlagReason = "No closed tickets on this shift — needs supervisor review";
        }

        const regularMinutes = Math.min(
          8 * 60,
          minutesBetween(punch.clockInAt, now),
        );
        const otMinutes = Math.max(
          0,
          minutesBetween(punch.clockInAt, now) - 8 * 60,
        );

        const updated: TimePunch = {
          ...punch,
          employeeName,
          clockOutAt: now,
          lastTicketClosedAt: lastTicket,
          minutesFromLastTicket,
          status,
          redFlag,
          redFlagReason,
          regularMinutes,
          otMinutes,
          approvedAt: status === "auto_approved" ? now : undefined,
          approvedBy: status === "auto_approved" ? "system" : undefined,
        };

        let alerts = get().alerts;
        if (redFlag) {
          alerts = [
            {
              id: uid("al"),
              at: now,
              punchId: punch.id,
              employeeName,
              reason: redFlagReason ?? "Red flag",
              resolved: false,
            },
            ...alerts,
          ];
        }

        set({
          punches: get().punches.map((p) => (p.id === punch.id ? updated : p)),
          alerts,
        });

        return {
          ok: true,
          status,
          redFlag,
          minutesFromLastTicket,
        };
      },

      approvePunch: (punchId, supervisorName) => {
        set({
          punches: get().punches.map((p) =>
            p.id === punchId
              ? {
                  ...p,
                  status: "approved",
                  redFlag: false,
                  approvedBy: supervisorName,
                  approvedAt: Date.now(),
                }
              : p,
          ),
          alerts: get().alerts.map((a) =>
            a.punchId === punchId ? { ...a, resolved: true } : a,
          ),
        });
      },

      correctPunch: (punchId, patch, supervisorName) => {
        set({
          punches: get().punches.map((p) => {
            if (p.id !== punchId) return p;
            const clockInAt = patch.clockInAt ?? p.clockInAt;
            const clockOutAt = patch.clockOutAt ?? p.clockOutAt ?? Date.now();
            const mins = minutesBetween(clockInAt, clockOutAt);
            return {
              ...p,
              ...patch,
              clockInAt,
              clockOutAt,
              regularMinutes: Math.min(8 * 60, mins),
              otMinutes: Math.max(0, mins - 8 * 60),
              status: "corrected",
              redFlag: false,
              approvedBy: supervisorName,
              approvedAt: Date.now(),
            };
          }),
          alerts: get().alerts.map((a) =>
            a.punchId === punchId ? { ...a, resolved: true } : a,
          ),
        });
      },

      rejectPunch: (punchId, supervisorName, notes) => {
        set({
          punches: get().punches.map((p) =>
            p.id === punchId
              ? {
                  ...p,
                  status: "rejected",
                  notes,
                  approvedBy: supervisorName,
                  approvedAt: Date.now(),
                }
              : p,
          ),
          alerts: get().alerts.map((a) =>
            a.punchId === punchId ? { ...a, resolved: true } : a,
          ),
        });
      },

      resolveAlert: (id) => {
        set({
          alerts: get().alerts.map((a) =>
            a.id === id ? { ...a, resolved: true } : a,
          ),
        });
      },

      runDailyCloseout: () => {
        const now = Date.now();
        const open = get().punches.filter((p) => p.status === "open");
        // force-close open punches as pending review
        const forced = open.length;
        const punches = get().punches.map((p) => {
          if (p.status !== "open") return p;
          return {
            ...p,
            clockOutAt: now,
            status: "pending_review" as const,
            redFlag: true,
            redFlagReason: "Forced at daily closeout — was still clocked in",
            regularMinutes: minutesBetween(p.clockInAt, now),
            otMinutes: 0,
          };
        });
        const pending = punches.filter((p) => p.status === "pending_review").length;
        const co: DailyCloseout = {
          id: uid("co"),
          dateKey: new Date().toISOString().slice(0, 10),
          closedAt: now,
          openPunchesForced: forced,
          pendingReviews: pending,
          notes: `Closeout at ${get().labor.dailyCloseoutTime} setting (manual run)`,
        };
        set({
          punches,
          closeouts: [co, ...get().closeouts],
        });
        return co;
      },

      runPayroll: () => {
        const labor = get().labor;
        const finished = get().punches.filter(
          (p) => p.clockOutAt && p.status !== "open" && p.status !== "rejected",
        );
        const unapproved = finished.filter(
          (p) =>
            p.status === "pending_review" ||
            (p.redFlag && p.status !== "approved" && p.status !== "corrected" && p.status !== "auto_approved"),
        );
        // auto_approved counts as approved
        const stillPending = finished.filter((p) => p.status === "pending_review");

        if (stillPending.length > 0) {
          return {
            ok: false,
            message: `${stillPending.length} shift(s) still pending supervisor approval. Resolve red flags first.`,
          };
        }

        if (labor.payrollMode === "manual") {
          const period: PayPeriod = {
            id: uid("pp"),
            start: startOfDay() - 13 * 86400000,
            end: Date.now(),
            status: "manual_hold",
            punchIds: finished.map((p) => p.id),
            totalRegularMinutes: finished.reduce(
              (s, p) => s + (p.regularMinutes ?? 0),
              0,
            ),
            totalOtMinutes: finished.reduce((s, p) => s + (p.otMinutes ?? 0), 0),
          };
          set({ payPeriods: [period, ...get().payPeriods] });
          return {
            ok: true,
            message: "Payroll held for manual processing — export when ready.",
            period,
          };
        }

        const period: PayPeriod = {
          id: uid("pp"),
          start: startOfDay() - 13 * 86400000,
          end: Date.now(),
          status: "exported",
          punchIds: finished.map((p) => p.id),
          totalRegularMinutes: finished.reduce(
            (s, p) => s + (p.regularMinutes ?? 0),
            0,
          ),
          totalOtMinutes: finished.reduce((s, p) => s + (p.otMinutes ?? 0), 0),
          exportedAt: Date.now(),
          exportPayload: JSON.stringify(
            {
              processor: labor.payrollProcessorId,
              employees: finished.map((p) => ({
                employeeId: p.employeeId,
                name: p.employeeName,
                regularHours: ((p.regularMinutes ?? 0) / 60).toFixed(2),
                otHours: ((p.otMinutes ?? 0) / 60).toFixed(2),
                status: p.status,
              })),
            },
            null,
            2,
          ),
        };
        set({ payPeriods: [period, ...get().payPeriods] });
        return {
          ok: true,
          message: `Exported to ${labor.payrollProcessorId.toUpperCase()} — all shifts approved.`,
          period,
        };
      },

      setPar: (stockId, par, reorderPoint) => {
        set({
          stock: get().stock.map((s) =>
            s.id === stockId
              ? {
                  ...s,
                  par,
                  reorderPoint: reorderPoint ?? s.reorderPoint,
                }
              : s,
          ),
        });
      },

      receiveStock: (stockId, qty) => {
        set({
          stock: get().stock.map((s) =>
            s.id === stockId
              ? {
                  ...s,
                  onHand: s.onHand + qty,
                  lastReceivedAt: Date.now(),
                  lastReceivedQty: qty,
                }
              : s,
          ),
        });
      },

      generateInventoryReport: (period) => {
        const sales = demoSalesCounts(period);
        const recipes = get().pourRecipes;
        const usage: Record<string, number> = {};

        for (const r of recipes) {
          const sold = sales[r.menuItemId] ?? 0;
          if (!sold) continue;
          for (const line of r.lines) {
            usage[line.stockItemId] =
              (usage[line.stockItemId] ?? 0) + line.qty * sold;
          }
        }

        const lines = get().stock.map((s) => {
          const rawUse = usage[s.id] ?? 0;
          const theoreticalUse = toBottles(s, rawUse);
          // expected = last received batch or current + theoretical back-calc
          const starting =
            (s.lastReceivedQty ?? s.onHand + theoreticalUse * 0.3) || s.par;
          const expectedOnHand = Math.max(0, starting - theoreticalUse);
          // for demo: counted is current onHand
          const countedOnHand = s.onHand;
          const variance = countedOnHand - expectedOnHand;
          const variancePct =
            expectedOnHand > 0 ? (variance / expectedOnHand) * 100 : 0;
          const belowPar = countedOnHand < s.par;
          let suggestion = "On track";
          if (belowPar) suggestion = `Reorder to par (${s.par} ${s.unit})`;
          if (variance < -0.15 * Math.max(expectedOnHand, 0.01))
            suggestion = "Variance high — check pours, spillage, or theft";
          if (variance > 0.2 * Math.max(expectedOnHand, 0.01))
            suggestion = "Over theoretical — confirm receiving or recipe yields";
          if (countedOnHand <= s.reorderPoint)
            suggestion = `Below reorder point — draft PO to supplier`;

          return {
            stockItemId: s.id,
            name: s.name,
            theoreticalUse: Math.round(theoreticalUse * 100) / 100,
            countedOnHand,
            expectedOnHand: Math.round(expectedOnHand * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            variancePct: Math.round(variancePct),
            par: s.par,
            belowPar,
            suggestion,
          };
        });

        const below = lines.filter((l) => l.belowPar).length;
        const report: InventoryAiReport = {
          id: uid("ir"),
          period,
          generatedAt: Date.now(),
          lines,
          summary: `AI ${period} audit: ${lines.length} items, ${below} below par. Theoretical use from POS recipes × sold qty. Liquor converted to bottle fractions (e.g. 45ml pours from 750ml).`,
        };
        set({
          inventoryReports: [report, ...get().inventoryReports].slice(0, 20),
        });
        return report;
      },

      toggleSupplier: (id) => {
        set({
          suppliers: get().suppliers.map((s) =>
            s.id === id ? { ...s, connected: !s.connected } : s,
          ),
        });
      },

      createReorderDraft: (supplierId) => {
        const sup = get().suppliers.find((s) => s.id === supplierId);
        if (!sup) return null;
        const lines = get()
          .stock.filter(
            (s) => s.supplierId === supplierId && s.onHand < s.par,
          )
          .map((s) => ({
            stockItemId: s.id,
            name: s.name,
            qty: Math.max(1, Math.ceil(s.par - s.onHand)),
            unitCostCents: s.costCents,
          }));
        if (lines.length === 0) return null;
        const order: SupplierOrder = {
          id: uid("so"),
          supplierId,
          supplierName: sup.name,
          status: "draft",
          lines,
          createdAt: Date.now(),
          totalCents: lines.reduce((s, l) => s + l.qty * l.unitCostCents, 0),
        };
        set({ supplierOrders: [order, ...get().supplierOrders] });
        return order;
      },

      submitSupplierOrder: (id) => {
        set({
          supplierOrders: get().supplierOrders.map((o) =>
            o.id === id ? { ...o, status: "submitted" } : o,
          ),
        });
      },
    }),
    {
      name: "zest-ops-v3-empty",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
