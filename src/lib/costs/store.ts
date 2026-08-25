import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { usePosStore } from "@/lib/pos/store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { recordDecision, daypartOf } from "@/lib/ops-ai/learn-store";
import { canCost, costEntityScope } from "./permissions";
import { suggestPoLines } from "./ordering";
import { CONNECTORS } from "./connectors";
import { guessCategory, heuristicInvoiceExtract, normalizeVendorKey } from "./invoice-parse";
import { salesQtyByMenuItem, theoreticalUse, recipeCostCents } from "./theoretical";
import { buildPriceRecommendations } from "./price-recs";
import type {
  CostAudit,
  CostAuditAction,
  CostCategory,
  CostInvoice,
  CostInvoiceLine,
  CostLedgerEntry,
  CostPicture,
  CostSettings,
  CostSku,
  CostSupplier,
  CountKind,
  InventoryCount,
  InvoiceExtract,
  ItemRecipe,
  PendingPriceEdit,
  PriceRecommendation,
  PurchaseOrder,
  VarianceException,
  VarianceResponseCode,
  WasteLog,
} from "./types";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABEL,
  DEFAULT_TARGET_COST_PCT,
} from "./types";

const DEFAULT_SETTINGS: CostSettings = {
  targetCostPct: { ...DEFAULT_TARGET_COST_PCT },
  itemTargetCostPct: {},
  poApproveThresholdCents: 50_000,
  varianceAlertPct: 15,
  defaultWasteFactor: 0.03,
  categories: COST_CATEGORIES.map((id) => ({ id, label: COST_CATEGORY_LABEL[id] })),
};

function actor() {
  const pos = usePosStore.getState();
  const emp = pos.employees.find((e) => e.id === pos.currentEmployeeId) ?? null;
  return {
    emp,
    id: emp?.id ?? "staff",
    name: emp?.name ?? "Staff",
    entity: costEntityScope(emp),
  };
}

function seedSkus(): CostSku[] {
  return [
    {
      id: "sku_titos",
      name: "Tito's Handmade Vodka 1.75L",
      category: "liquor",
      entityId: HOST_SCOPE,
      unit: "bottle",
      packSize: 1750,
      packLabel: "ml",
      onHand: 0,
      par: 6,
      parMin: 3,
      parMax: 12,
      costCents: 2899,
      supplierId: "sup_sgws",
      supplierSku: "TITOS-175",
      leadDays: 2,
    },
    {
      id: "sku_house_vodka",
      name: "House Vodka 750ml",
      category: "liquor",
      entityId: HOST_SCOPE,
      unit: "bottle",
      packSize: 750,
      packLabel: "ml",
      onHand: 4,
      par: 6,
      parMin: 3,
      parMax: 10,
      costCents: 1800,
      supplierId: "sup_sgws",
      leadDays: 2,
    },
    {
      id: "sku_lime",
      name: "Limes",
      category: "food",
      entityId: HOST_SCOPE,
      unit: "each",
      packSize: 1,
      packLabel: "ea",
      onHand: 40,
      par: 60,
      parMin: 24,
      parMax: 80,
      costCents: 35,
      supplierId: "sup_sysco",
      leadDays: 1,
    },
    {
      id: "sku_patty",
      name: "Burger patties 6oz",
      category: "food",
      entityId: HOST_SCOPE,
      unit: "each",
      packSize: 1,
      packLabel: "ea",
      onHand: 48,
      par: 60,
      parMin: 24,
      parMax: 80,
      costCents: 220,
      supplierId: "sup_sysco",
      leadDays: 1,
    },
    {
      id: "sku_napkin",
      name: "Beverage napkins",
      category: "paper",
      entityId: HOST_SCOPE,
      unit: "case",
      packSize: 1,
      packLabel: "cs",
      onHand: 3,
      par: 4,
      parMin: 2,
      parMax: 8,
      costCents: 1800,
      supplierId: "sup_sysco",
      leadDays: 1,
    },
  ];
}

function seedSuppliers(): CostSupplier[] {
  return [
    {
      id: "sup_sgws",
      name: "Southern Glazer's",
      contacts: [{ name: "Orders", email: "orders@sgws.example" }],
      accountNumber: "SG-4410",
      terms: "Net 14",
      entityIds: [],
      orderMethod: "email",
      connectorId: "email_csv",
      category: "Spirits",
      minOrderCents: 50000,
      leadDays: 2,
    },
    {
      id: "sup_sysco",
      name: "Sysco",
      contacts: [{ name: "Ops", email: "ops@sysco.example" }],
      accountNumber: "SYS-902",
      terms: "Net 7",
      entityIds: [],
      orderMethod: "api",
      connectorId: "api_stub",
      category: "Foodservice",
      minOrderCents: 25000,
      leadDays: 1,
      apiEndpoint: "https://api.supplier.example/orders",
    },
  ];
}

function receiptsInWindow(
  invoices: CostInvoice[],
  skuId: string,
  from: number,
  to: number,
): number {
  let q = 0;
  for (const inv of invoices) {
    if (inv.status !== "posted" || !inv.postedAt) continue;
    if (inv.postedAt < from || inv.postedAt > to) continue;
    for (const l of inv.lines) {
      if (l.skuId === skuId) q += l.qty;
    }
  }
  return q;
}

interface CostState {
  skus: CostSku[];
  maps: VendorSkuMapRow[];
  invoices: CostInvoice[];
  ledger: CostLedgerEntry[];
  recipes: ItemRecipe[];
  counts: InventoryCount[];
  waste: WasteLog[];
  exceptions: VarianceException[];
  suppliers: CostSupplier[];
  pos: PurchaseOrder[];
  priceRecs: PriceRecommendation[];
  audits: CostAudit[];
  settings: CostSettings;
  pendingPriceEdit: PendingPriceEdit | null;
  lastPicture: CostPicture | null;

  audit: (action: CostAuditAction, detail: string, entityId?: string) => void;
  upsertSku: (input: Partial<CostSku> & { name: string }) => string;
  setSkuPar: (id: string, par: number, parMin?: number, parMax?: number) => void;
  rememberMap: (vendorName: string, rawName: string, skuId: string) => void;
  createInvoiceDraft: (extract: InvoiceExtract, entityId?: string) => string;
  mapInvoiceLine: (
    invoiceId: string,
    lineId: string,
    patch: Partial<Pick<CostInvoiceLine, "skuId" | "category" | "entityId" | "qty" | "unitCostCents" | "rawName">>,
  ) => void;
  postInvoice: (invoiceId: string) => { ok: boolean; error?: string };
  voidInvoice: (invoiceId: string) => void;
  upsertRecipe: (input: Partial<ItemRecipe> & {
    name: string;
    menuItemId: string;
    lines: ItemRecipe["lines"];
  }) => string;
  runCount: (kind: CountKind, lines: Array<{ skuId: string; qty: number }>, note?: string) => void;
  logWaste: (skuId: string, qty: number, reason: string) => void;
  scanVariance: (windowDays?: number) => VarianceException[];
  respondException: (
    id: string,
    code: VarianceResponseCode,
    note: string,
  ) => { ok: boolean; error?: string };
  upsertSupplier: (input: Partial<CostSupplier> & { name: string }) => string;
  linkInvoiceVendor: (invoiceId: string, supplierId: string) => void;
  draftPoFromPar: (
    supplierId: string,
    opts?: { overrideOpenException?: boolean; entityId?: string },
  ) => { ok: boolean; poId?: string; error?: string; blocked?: string[] };
  approvePo: (id: string) => { ok: boolean; error?: string };
  sendPo: (id: string, opts?: { email?: string }) => {
    ok: boolean;
    csv?: string;
    html?: string;
    detail?: string;
    error?: string;
  };
  receivePo: (id: string, received: Array<{ skuId: string; qty: number }>) => { ok: boolean; error?: string };
  matchInvoiceToPo: (invoiceId: string, poId: string) => string[];
  generatePriceRecs: (windowDays?: number) => PriceRecommendation[];
  acceptPriceRec: (id: string) => PendingPriceEdit | null;
  dismissPriceRec: (id: string) => void;
  clearPendingPriceEdit: () => void;
  buildCostPicture: (windowDays?: number, narrative?: string | null) => CostPicture;
  updateSettings: (patch: Partial<CostSettings>) => void;
}

type VendorSkuMapRow = {
  id: string;
  vendorKey: string;
  rawName: string;
  skuId: string;
};

export const useCostStore = create<CostState>()(
  persist(
    (set, get) => ({
      skus: seedSkus(),
      maps: [],
      invoices: [],
      ledger: [],
      recipes: [],
      counts: [],
      waste: [],
      exceptions: [],
      suppliers: seedSuppliers(),
      pos: [],
      priceRecs: [],
      audits: [],
      settings: DEFAULT_SETTINGS,
      pendingPriceEdit: null,
      lastPicture: null,

      audit: (action, detail, entityId) => {
        const a = actor();
        const row: CostAudit = {
          id: uid("cau"),
          at: Date.now(),
          actorId: a.id,
          actorName: a.name,
          action,
          detail,
          entityId,
        };
        set({ audits: [row, ...get().audits].slice(0, 200) });
        try {
          usePosStore.getState().audit?.("cost", `${action}: ${detail}`);
        } catch {
          /* optional */
        }
      },

      upsertSku: (input) => {
        const existing = input.id
          ? get().skus.find((s) => s.id === input.id)
          : get().skus.find(
              (s) => s.name.toLowerCase() === input.name.trim().toLowerCase(),
            );
        if (existing) {
          set({
            skus: get().skus.map((s) =>
              s.id === existing.id ? { ...s, ...input, id: existing.id } : s,
            ),
          });
          return existing.id;
        }
        const a = actor();
        const id = uid("sku");
        const sku: CostSku = {
          id,
          name: input.name.trim(),
          category: input.category ?? "other",
          entityId: input.entityId || a.entity || HOST_SCOPE,
          unit: input.unit ?? "each",
          packSize: input.packSize ?? 1,
          packLabel: input.packLabel ?? "ea",
          onHand: input.onHand ?? 0,
          par: input.par ?? 0,
          parMin: input.parMin ?? 0,
          parMax: input.parMax ?? 0,
          costCents: input.costCents ?? 0,
          supplierId: input.supplierId,
          supplierSku: input.supplierSku,
          leadDays: input.leadDays ?? 2,
        };
        set({ skus: [sku, ...get().skus] });
        return id;
      },

      setSkuPar: (id, par, parMin, parMax) => {
        set({
          skus: get().skus.map((s) =>
            s.id === id
              ? {
                  ...s,
                  par,
                  parMin: parMin ?? s.parMin,
                  parMax: parMax ?? s.parMax,
                }
              : s,
          ),
        });
      },

      rememberMap: (vendorName, rawName, skuId) => {
        const vendorKey = normalizeVendorKey(vendorName);
        const raw = rawName.trim().toLowerCase();
        const hit = get().maps.find(
          (m) => m.vendorKey === vendorKey && m.rawName === raw,
        );
        if (hit) {
          set({
            maps: get().maps.map((m) => (m.id === hit.id ? { ...m, skuId } : m)),
          });
          return;
        }
        set({
          maps: [
            { id: uid("map"), vendorKey, rawName: raw, skuId },
            ...get().maps,
          ],
        });
        get().audit("sku_map", `${vendorName}: ${rawName} → ${skuId}`);
      },

      createInvoiceDraft: (extract, entityId) => {
        const a = actor();
        const ent = entityId || a.entity || HOST_SCOPE;
        const vendorKey = normalizeVendorKey(extract.vendorName);
        const lines: CostInvoiceLine[] = extract.lines.map((l) => {
          const mapped = get().maps.find(
            (m) =>
              m.vendorKey === vendorKey &&
              m.rawName === l.name.trim().toLowerCase(),
          );
          const sku =
            (mapped && get().skus.find((s) => s.id === mapped.skuId)) ||
            get().skus.find((s) =>
              s.name.toLowerCase().includes(l.name.trim().toLowerCase().slice(0, 12)),
            ) ||
            (/\btito/i.test(l.name)
              ? get().skus.find((s) => /tito/i.test(s.name))
              : undefined);
          return {
            id: uid("il"),
            rawName: l.name,
            qty: l.qty,
            unitCostCents: l.unitCostCents,
            packSize: l.packSize,
            skuId: sku?.id,
            category: sku?.category ?? guessCategory(l.name),
            entityId: sku?.entityId ?? ent,
          };
        });
        const inv: CostInvoice = {
          id: uid("cinv"),
          vendorName: extract.vendorName,
          invoiceNumber: extract.invoiceNumber,
          date: Date.parse(extract.dateIso) || Date.now(),
          status: "extracted",
          entityId: ent,
          lines,
          source: extract.source === "ai" ? "ai" : "upload",
          parseNote: extract.note,
        };
        const sup = get().suppliers.find((s) =>
          normalizeVendorKey(s.name).includes(vendorKey.slice(0, 8)),
        );
        if (sup) inv.supplierId = sup.id;
        set({ invoices: [inv, ...get().invoices] });
        return inv.id;
      },

      mapInvoiceLine: (invoiceId, lineId, patch) => {
        set({
          invoices: get().invoices.map((inv) =>
            inv.id !== invoiceId
              ? inv
              : {
                  ...inv,
                  status: inv.status === "posted" ? inv.status : "mapped",
                  lines: inv.lines.map((l) =>
                    l.id === lineId ? { ...l, ...patch } : l,
                  ),
                },
          ),
        });
      },

      postInvoice: (invoiceId) => {
        const a = actor();
        if (!canCost(a.emp, "invoice:post")) {
          return { ok: false, error: "No permission to post invoices" };
        }
        const inv = get().invoices.find((i) => i.id === invoiceId);
        if (!inv) return { ok: false, error: "Invoice missing" };
        if (inv.status === "posted") return { ok: false, error: "Already posted" };
        const unmapped = inv.lines.filter((l) => !l.skuId);
        if (unmapped.length) {
          return { ok: false, error: `Map ${unmapped.length} line(s) to a SKU` };
        }
        const now = Date.now();
        const ledger: CostLedgerEntry[] = [];
        let skus = get().skus;
        for (const line of inv.lines) {
          const skuId = line.skuId!;
          get().rememberMap(inv.vendorName, line.rawName, skuId);
          skus = skus.map((s) =>
            s.id === skuId
              ? {
                  ...s,
                  onHand: s.onHand + line.qty,
                  costCents: line.unitCostCents || s.costCents,
                  lastReceivedAt: now,
                  lastReceivedQty: line.qty,
                  lastPoPriceCents: s.lastPoPriceCents,
                }
              : s,
          );
          const amt = Math.round(line.qty * line.unitCostCents);
          ledger.push({
            id: uid("gl"),
            at: now,
            category: line.category,
            entityId: line.entityId,
            amountCents: amt,
            invoiceId: inv.id,
            skuId,
            memo: `${inv.vendorName} ${inv.invoiceNumber} · ${line.rawName}`,
          });
        }
        set({
          skus,
          ledger: [...ledger, ...get().ledger],
          invoices: get().invoices.map((i) =>
            i.id === invoiceId ? { ...i, status: "posted" as const, postedAt: now } : i,
          ),
        });
        get().audit(
          "invoice_post",
          `${inv.vendorName} ${inv.invoiceNumber} · ${inv.lines.length} lines`,
          inv.entityId,
        );
        get().scanVariance(7);
        return { ok: true };
      },

      voidInvoice: (invoiceId) => {
        const inv = get().invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.status !== "posted") {
          set({
            invoices: get().invoices.map((i) =>
              i.id === invoiceId ? { ...i, status: "void" } : i,
            ),
          });
          return;
        }
        let skus = get().skus;
        for (const line of inv.lines) {
          if (!line.skuId) continue;
          skus = skus.map((s) =>
            s.id === line.skuId
              ? { ...s, onHand: Math.max(0, s.onHand - line.qty) }
              : s,
          );
        }
        set({
          skus,
          invoices: get().invoices.map((i) =>
            i.id === invoiceId ? { ...i, status: "void" } : i,
          ),
          ledger: get().ledger.filter((e) => e.invoiceId !== invoiceId),
        });
        get().audit("invoice_void", inv.invoiceNumber, inv.entityId);
      },

      upsertRecipe: (input) => {
        const a = actor();
        const id = input.id ?? uid("rcp");
        const menuItemIds = [
          ...new Set(
            [input.menuItemId, ...(input.menuItemIds ?? [])].filter(Boolean),
          ),
        ];
        const rec: ItemRecipe = {
          id,
          menuItemId: input.menuItemId,
          menuItemIds: menuItemIds.length ? menuItemIds : [input.menuItemId],
          name: input.name.trim(),
          entityId: input.entityId || a.entity || HOST_SCOPE,
          station: input.station,
          wasteFactor: input.wasteFactor ?? get().settings.defaultWasteFactor,
          yieldQty: input.yieldQty && input.yieldQty > 0 ? input.yieldQty : 1,
          yieldUnit: input.yieldUnit || "portion",
          glassware: input.glassware,
          garnish: input.garnish,
          allergens: input.allergens ?? [],
          dietary: input.dietary ?? [],
          notes: input.notes,
          steps: input.steps ?? [],
          lines: input.lines.map((l) => ({
            name: (l.name || l.skuId || "Ingredient").trim(),
            skuId: l.skuId || undefined,
            qty: Number(l.qty) || 0,
            unit: l.unit || "each",
          })),
        };
        const exists = get().recipes.some((r) => r.id === id);
        set({
          recipes: exists
            ? get().recipes.map((r) => (r.id === id ? rec : r))
            : [rec, ...get().recipes],
        });
        return id;
      },

      runCount: (kind, lines, note) => {
        const a = actor();
        if (!canCost(a.emp, "count")) return;
        const now = Date.now();
        const count: InventoryCount = {
          id: uid("cnt"),
          at: now,
          entityId: a.entity || HOST_SCOPE,
          kind,
          byUserId: a.id,
          byName: a.name,
          lines,
          note,
        };
        set({
          counts: [count, ...get().counts],
          skus: get().skus.map((s) => {
            const hit = lines.find((l) => l.skuId === s.id);
            return hit ? { ...s, onHand: hit.qty } : s;
          }),
        });
        get().audit("count", `${kind} · ${lines.length} SKUs`, count.entityId);
        get().scanVariance(7);
      },

      logWaste: (skuId, qty, reason) => {
        const a = actor();
        if (!canCost(a.emp, "waste")) return;
        const sku = get().skus.find((s) => s.id === skuId);
        if (!sku) return;
        const row: WasteLog = {
          id: uid("wst"),
          at: Date.now(),
          skuId,
          qty,
          reason,
          userId: a.id,
          userName: a.name,
          entityId: sku.entityId,
        };
        set({
          waste: [row, ...get().waste],
          skus: get().skus.map((s) =>
            s.id === skuId ? { ...s, onHand: Math.max(0, s.onHand - qty) } : s,
          ),
        });
        get().audit("waste", `${sku.name} × ${qty} · ${reason}`, sku.entityId);
      },

      scanVariance: (windowDays = 7) => {
        const life = usePosStore.getState().settings;
        const training =
          life.lifecycleStatus && life.lifecycleStatus !== "live";
        if (training && !life.trainingTrackInventory) return [];
        const now = Date.now();
        const from = now - windowDays * 86400000;
        const pos = usePosStore.getState();
        const sales = salesQtyByMenuItem(pos.orders, from, now);
        const use = theoreticalUse({
          recipes: get().recipes,
          skus: get().skus,
          sales,
        });
        const created: VarianceException[] = [];
        const settings = get().settings;
        for (const sku of get().skus) {
          const theoretical = use[sku.id] ?? 0;
          const receipts = receiptsInWindow(get().invoices, sku.id, from, now);
          const wasteQty = get()
            .waste.filter((w) => w.skuId === sku.id && w.at >= from && w.at <= now)
            .reduce((s, w) => s + w.qty, 0);
          const lastCount = get().counts.find((c) =>
            c.lines.some((l) => l.skuId === sku.id),
          );
          const counted = lastCount
            ? lastCount.lines.find((l) => l.skuId === sku.id)?.qty
            : undefined;
          const opening = Math.max(
            0,
            sku.onHand - receipts + theoretical + wasteQty,
          );
          const expected = Math.max(0, opening + receipts - theoretical - wasteQty);
          const actual = counted ?? sku.onHand;
          const denom = Math.max(expected, theoretical, receipts, 0.25);
          const purchaseGap = receipts - theoretical;
          const countGap = actual - expected;
          const pct = Math.abs(purchaseGap) / denom * 100;
          const already = get().exceptions.find(
            (e) =>
              e.skuId === sku.id &&
              e.status === "open" &&
              e.at > now - 86400000,
          );
          if (already) continue;

          const evidence = {
            windowStart: from,
            windowEnd: now,
            salesQty: Object.entries(sales).reduce((n, [mid, q]) => {
              const r = get().recipes.find(
                (x) =>
                  (x.menuItemIds ?? [x.menuItemId]).includes(mid) &&
                  x.lines.some((l) => l.skuId === sku.id || l.name),
              );
              return n + (r ? q : 0);
            }, 0),
            receiptsQty: receipts,
            theoretical: round2(theoretical),
            expected: round2(expected),
            actual: round2(actual),
            opening: round2(opening),
          };

          if (receipts >= 1 && theoretical < receipts * 0.25 && pct >= settings.varianceAlertPct) {
            created.push({
              id: uid("vex"),
              at: now,
              kind: "purchase_vs_sales",
              severity: receipts >= 4 && theoretical < 0.5 ? "urgent" : "watch",
              skuId: sku.id,
              skuName: sku.name,
              entityId: sku.entityId,
              status: "open",
              summary: `${sku.name}: received ${round2(receipts)} vs theoretical use ${round2(theoretical)} in ${windowDays}d. Review pours, waste, or events — do not treat this as an accusation.`,
              evidence,
              assigneeRole: "manager",
            });
          } else if (
            counted != null &&
            Math.abs(countGap) / Math.max(expected, 0.25) * 100 >= settings.varianceAlertPct
          ) {
            created.push({
              id: uid("vex"),
              at: now,
              kind: "count_variance",
              severity: Math.abs(countGap) > 2 ? "watch" : "info",
              skuId: sku.id,
              skuName: sku.name,
              entityId: sku.entityId,
              status: "open",
              summary: `${sku.name}: counted ${round2(actual)} vs expected ${round2(expected)} (opening + receipts − sales theoretical).`,
              evidence,
              assigneeRole: "manager",
            });
          }
        }
        if (created.length) {
          set({ exceptions: [...created, ...get().exceptions].slice(0, 80) });
        }
        return created;
      },

      respondException: (id, code, note) => {
        const a = actor();
        if (!canCost(a.emp, "alert:respond")) {
          return { ok: false, error: "Manager or operator response required" };
        }
        if (!note.trim()) return { ok: false, error: "Note required — cannot dismiss silently" };
        const ex = get().exceptions.find((e) => e.id === id);
        if (!ex) return { ok: false, error: "Alert missing" };
        set({
          exceptions: get().exceptions.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "responded" as const,
                  response: {
                    code,
                    note: note.trim(),
                    byId: a.id,
                    byName: a.name,
                    at: Date.now(),
                  },
                }
              : e,
          ),
        });
        get().audit("alert_response", `${ex.skuName}: ${code} · ${note.trim()}`, ex.entityId);
        try {
          const locId = usePosStore.getState().tenantLocationId || "local";
          recordDecision({
            locationId: locId,
            operatorId: ex.entityId === HOST_SCOPE ? null : ex.entityId,
            recId: ex.id,
            recType: "cost_variance",
            action: "accept",
            features: {
              daypart: daypartOf(),
              laborHeadcount: 0,
              serverCount: 0,
              kitchenCount: 0,
              salesCents: 0,
              kitchenAvgSec: 0,
              waitlistWaiting: 0,
              idleTables: 0,
              openChecks: 0,
              laborPct: null,
            },
            userId: a.id,
          });
        } catch {
          /* learning log optional */
        }
        return { ok: true };
      },

      upsertSupplier: (input) => {
        const existing = input.id
          ? get().suppliers.find((s) => s.id === input.id)
          : undefined;
        if (existing) {
          set({
            suppliers: get().suppliers.map((s) =>
              s.id === existing.id ? { ...s, ...input, id: existing.id } : s,
            ),
          });
          return existing.id;
        }
        const id = uid("sup");
        const row: CostSupplier = {
          id,
          name: input.name.trim(),
          contacts: input.contacts ?? [],
          accountNumber: input.accountNumber ?? "",
          terms: input.terms ?? "Net 14",
          entityIds: input.entityIds ?? [],
          orderMethod: input.orderMethod ?? "email",
          connectorId: input.connectorId ?? "email_csv",
          category: input.category ?? "General",
          minOrderCents: input.minOrderCents ?? 0,
          leadDays: input.leadDays ?? 2,
          apiEndpoint: input.apiEndpoint,
        };
        set({ suppliers: [row, ...get().suppliers] });
        return id;
      },

      linkInvoiceVendor: (invoiceId, supplierId) => {
        set({
          invoices: get().invoices.map((i) =>
            i.id === invoiceId ? { ...i, supplierId } : i,
          ),
        });
      },

      draftPoFromPar: (supplierId, opts) => {
        const a = actor();
        if (!canCost(a.emp, "po:create")) {
          return { ok: false, error: "No permission to create POs" };
        }
        const sup = get().suppliers.find((s) => s.id === supplierId);
        if (!sup) return { ok: false, error: "Supplier missing" };
        const entityId = opts?.entityId || a.entity || HOST_SCOPE;
        const { lines, blocked } = suggestPoLines({
          skus: get().skus,
          supplierId,
          entityId,
          exceptions: get().exceptions,
          overrideOpenException: opts?.overrideOpenException,
        });
        if (!lines.length) {
          return {
            ok: false,
            error: blocked.length
              ? `Open variance on ${blocked.join(", ")} — respond or override`
              : "Nothing below PAR for this supplier",
            blocked,
          };
        }
        const totalCents = lines.reduce((s, l) => s + l.qty * l.unitCostCents, 0);
        const needsApprove = totalCents >= get().settings.poApproveThresholdCents;
        const po: PurchaseOrder = {
          id: uid("po"),
          supplierId,
          supplierName: sup.name,
          entityId,
          status: needsApprove ? "pending_approval" : "draft",
          lines,
          expectedDate: Date.now() + sup.leadDays * 86400000,
          createdAt: Date.now(),
          createdById: a.id,
          createdByName: a.name,
          overrideOpenException: opts?.overrideOpenException,
          totalCents,
        };
        set({ pos: [po, ...get().pos] });
        get().audit("po_create", `${sup.name} · ${lines.length} lines · $${(totalCents / 100).toFixed(2)}`, entityId);
        return { ok: true, poId: po.id, blocked };
      },

      approvePo: (id) => {
        const a = actor();
        if (!canCost(a.emp, "po:approve")) {
          return { ok: false, error: "Approver role required" };
        }
        const po = get().pos.find((p) => p.id === id);
        if (!po) return { ok: false, error: "PO missing" };
        set({
          pos: get().pos.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "draft",
                  approvedById: a.id,
                  approvedByName: a.name,
                }
              : p,
          ),
        });
        get().audit("po_approve", po.supplierName, po.entityId);
        return { ok: true };
      },

      sendPo: (id, opts) => {
        const po = get().pos.find((p) => p.id === id);
        if (!po) return { ok: false, error: "PO missing" };
        if (po.status === "pending_approval") {
          return { ok: false, error: "Needs approval before send" };
        }
        const sup = get().suppliers.find((s) => s.id === po.supplierId);
        const conn = CONNECTORS[sup?.connectorId ?? "email_csv"];
        const email = opts?.email || sup?.contacts[0]?.email;
        const result = conn.send(po, email);
        set({
          pos: get().pos.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "sent",
                  sentAt: Date.now(),
                  sendMethod: sup?.orderMethod ?? "email",
                  sendDetail: result.detail,
                }
              : p,
          ),
        });
        get().audit("po_send", `${po.supplierName} via ${result.method}`, po.entityId);
        return {
          ok: true,
          csv: result.csv,
          detail: result.detail,
        };
      },

      receivePo: (id, received) => {
        const a = actor();
        if (!canCost(a.emp, "po:receive")) {
          return { ok: false, error: "No receive permission" };
        }
        const po = get().pos.find((p) => p.id === id);
        if (!po) return { ok: false, error: "PO missing" };
        const now = Date.now();
        const flags: string[] = [];
        set({
          pos: get().pos.map((p) => {
            if (p.id !== id) return p;
            const lines = p.lines.map((l) => {
              const add = received.find((r) => r.skuId === l.skuId)?.qty ?? 0;
              return { ...l, receivedQty: l.receivedQty + add };
            });
            const allIn = lines.every((l) => l.receivedQty >= l.qty);
            const any = lines.some((l) => l.receivedQty > 0);
            return {
              ...p,
              lines,
              status: allIn ? "received" : any ? "partial" : p.status,
            };
          }),
          skus: get().skus.map((s) => {
            const add = received.find((r) => r.skuId === s.id)?.qty ?? 0;
            if (!add) return s;
            const line = po.lines.find((l) => l.skuId === s.id);
            if (line && s.lastPoPriceCents && line.unitCostCents !== s.lastPoPriceCents) {
              flags.push(`${s.name} price ${s.lastPoPriceCents} → ${line.unitCostCents}`);
            }
            return {
              ...s,
              onHand: s.onHand + add,
              lastReceivedAt: now,
              lastReceivedQty: add,
              lastPoPriceCents: line?.unitCostCents ?? s.lastPoPriceCents,
              costCents: line?.unitCostCents ?? s.costCents,
            };
          }),
        });
        if (flags.length) {
          const first = flags[0]!;
          set({
            exceptions: [
              {
                id: uid("vex"),
                at: now,
                kind: "price_change",
                severity: "info",
                skuId: received[0]?.skuId ?? po.lines[0]?.skuId ?? "",
                skuName: first,
                entityId: po.entityId,
                status: "open",
                summary: `PO receive price change: ${flags.join("; ")}`,
                evidence: {
                  windowStart: now,
                  windowEnd: now,
                  salesQty: 0,
                  receiptsQty: received.reduce((s, r) => s + r.qty, 0),
                  theoretical: 0,
                  expected: 0,
                  opening: 0,
                },
              },
              ...get().exceptions,
            ],
          });
        }
        get().audit("po_receive", po.supplierName, po.entityId);
        return { ok: true };
      },

      matchInvoiceToPo: (invoiceId, poId) => {
        const inv = get().invoices.find((i) => i.id === invoiceId);
        const po = get().pos.find((p) => p.id === poId);
        if (!inv || !po) return [];
        const flags: string[] = [];
        for (const line of inv.lines) {
          const pl = po.lines.find(
            (l) =>
              l.skuId === line.skuId ||
              l.name.toLowerCase() === line.rawName.toLowerCase(),
          );
          if (pl && pl.unitCostCents && line.unitCostCents && pl.unitCostCents !== line.unitCostCents) {
            flags.push(
              `${line.rawName}: PO ${(pl.unitCostCents / 100).toFixed(2)} vs invoice ${(line.unitCostCents / 100).toFixed(2)}`,
            );
          }
        }
        set({
          invoices: get().invoices.map((i) =>
            i.id === invoiceId ? { ...i, poId } : i,
          ),
        });
        return flags;
      },

      generatePriceRecs: (windowDays = 14) => {
        const now = Date.now();
        const from = now - windowDays * 86400000;
        const pos = usePosStore.getState();
        const sales = salesQtyByMenuItem(pos.orders, from, now);
        const recs = buildPriceRecommendations({
          menuItems: pos.menuItems,
          recipes: get().recipes,
          skus: get().skus,
          sales,
          settings: get().settings,
          now,
        });
        set({
          priceRecs: [...recs, ...get().priceRecs.filter((r) => r.status !== "open")].slice(
            0,
            60,
          ),
        });
        return recs;
      },

      acceptPriceRec: (id) => {
        const rec = get().priceRecs.find((r) => r.id === id);
        if (!rec) return null;
        set({
          priceRecs: get().priceRecs.map((r) =>
            r.id === id ? { ...r, status: "accepted" } : r,
          ),
          pendingPriceEdit:
            rec.suggestedPriceCents != null
              ? {
                  menuItemId: rec.menuItemId,
                  suggestedPriceCents: rec.suggestedPriceCents,
                  recId: rec.id,
                }
              : null,
        });
        get().audit(
          "price_rec",
          `accept ${rec.action} ${rec.menuItemName}`,
          rec.entityId,
        );
        try {
          const locId = usePosStore.getState().tenantLocationId || "local";
          recordDecision({
            locationId: locId,
            operatorId: rec.entityId === HOST_SCOPE ? null : rec.entityId,
            recId: rec.id,
            recType: "price_rec",
            action: "accept",
            features: {
              daypart: daypartOf(),
              laborHeadcount: 0,
              serverCount: 0,
              kitchenCount: 0,
              salesCents: rec.currentPriceCents * rec.salesQty,
              kitchenAvgSec: 0,
              waitlistWaiting: 0,
              idleTables: 0,
              openChecks: 0,
              laborPct: null,
            },
            userId: actor().id,
          });
        } catch {
          /* */
        }
        return get().pendingPriceEdit;
      },

      dismissPriceRec: (id) => {
        const rec = get().priceRecs.find((r) => r.id === id);
        set({
          priceRecs: get().priceRecs.map((r) =>
            r.id === id ? { ...r, status: "dismissed" } : r,
          ),
        });
        if (rec) {
          get().audit("price_rec", `dismiss ${rec.menuItemName}`, rec.entityId);
          try {
            recordDecision({
              locationId: usePosStore.getState().tenantLocationId || "local",
              operatorId: rec.entityId === HOST_SCOPE ? null : rec.entityId,
              recId: rec.id,
              recType: "price_rec",
              action: "dismiss",
              features: {
                daypart: daypartOf(),
                laborHeadcount: 0,
                serverCount: 0,
                kitchenCount: 0,
                salesCents: 0,
                kitchenAvgSec: 0,
                waitlistWaiting: 0,
                idleTables: 0,
                openChecks: 0,
                laborPct: null,
              },
              userId: actor().id,
            });
          } catch {
            /* */
          }
        }
      },

      clearPendingPriceEdit: () => set({ pendingPriceEdit: null }),

      buildCostPicture: (windowDays = 7, narrative) => {
        const now = Date.now();
        const from = now - windowDays * 86400000;
        const pos = usePosStore.getState();
        const salesCents = pos.orders
          .filter((o) => (o.closedAt ?? o.createdAt) >= from)
          .reduce(
            (s, o) =>
              s +
              o.lines
                .filter((l) => !l.voided)
                .reduce((n, l) => n + l.quantity * l.unitPriceCents, 0),
            0,
          );
        const cogsCents = get()
          .ledger.filter((e) => e.at >= from)
          .reduce((s, e) => s + e.amountCents, 0);
        const ops = useOpsStore.getState();
        let laborPct: number | null = null;
        if (ops) {
          const punches = ops.punches.filter(
            (p) => p.clockInAt >= from && p.clockOutAt,
          );
          const mins = punches.reduce(
            (s, p) => s + (p.regularMinutes ?? 0) + (p.otMinutes ?? 0),
            0,
          );
          const laborCents = Math.round((mins / 60) * 1800);
          laborPct = salesCents > 0 ? Math.round((laborCents / salesCents) * 1000) / 10 : null;
        }
        const categoryMargins = COST_CATEGORIES.map((cat) => {
          const spendCents = get()
            .ledger.filter((e) => e.at >= from && e.category === cat)
            .reduce((s, e) => s + e.amountCents, 0);
          return {
            category: cat,
            spendCents,
            salesCents: 0,
            marginPct: null as number | null,
          };
        });
        const varianceCents = get()
          .exceptions.filter((e) => e.at >= from)
          .reduce((s, e) => {
            const gap = (e.evidence.receiptsQty - e.evidence.theoretical) *
              (get().skus.find((x) => x.id === e.skuId)?.costCents ?? 0);
            return s + Math.round(gap);
          }, 0);
        const cogsPct = salesCents > 0 ? Math.round((cogsCents / salesCents) * 1000) / 10 : null;
        const openExceptions = get().exceptions.filter((e) => e.status === "open").length;
        const guided =
          `COGS ${cogsPct == null ? "n/a" : `${cogsPct}%`} on $${(salesCents / 100).toFixed(0)} sales. ` +
          `Posted spend $${(cogsCents / 100).toFixed(0)}. Open variance items: ${openExceptions}. ` +
          `Labor ${laborPct == null ? "n/a (no punches)" : `${laborPct}%`}. ` +
          `Recommendations stay human-confirmed.`;
        const picture: CostPicture = {
          generatedAt: now,
          source: narrative ? "ai" : "guided",
          windowDays,
          cogsCents,
          salesCents,
          cogsPct,
          laborPct,
          varianceCents,
          categoryMargins,
          narrative: narrative?.trim() || guided,
          openExceptions,
        };
        set({ lastPicture: picture });
        return picture;
      },

      updateSettings: (patch) => {
        const a = actor();
        if (!canCost(a.emp, "settings")) return;
        set({ settings: { ...get().settings, ...patch } });
      },
    }),
    {
      name: "summex-costs-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        skus: s.skus,
        maps: s.maps,
        invoices: s.invoices,
        ledger: s.ledger,
        recipes: s.recipes,
        counts: s.counts,
        waste: s.waste,
        exceptions: s.exceptions,
        suppliers: s.suppliers,
        pos: s.pos,
        priceRecs: s.priceRecs,
        audits: s.audits,
        settings: s.settings,
        lastPicture: s.lastPicture,
      }),
    },
  ),
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function heuristicExtract(text: string, fileName?: string): InvoiceExtract {
  return heuristicInvoiceExtract(text, fileName);
}

export function recipePlateCost(menuItemId: string): number {
  const s = useCostStore.getState();
  const r = s.recipes.find((x) =>
    (x.menuItemIds?.length ? x.menuItemIds : [x.menuItemId]).includes(menuItemId),
  );
  return recipeCostCents(r, s.skus);
}
