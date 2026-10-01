/**
 * Pull a business day from the POS into each selling entity’s books.
 * Idempotent per day. Training stays sandbox. Does not run payroll.
 */
import type { CostInvoice } from "@/lib/costs/types";
import { useCostStore } from "@/lib/costs/store";
import { cashPolicyFromSettings, cardPriceCents } from "@/lib/pos/cash-discount";
import { computeTotals } from "@/lib/pos/calculations";
import { useOpsStore } from "@/lib/pos/ops-store";
import {
  isDrinkLine,
  isFoodLine,
  shareLinesForOrders,
  venueYmd,
} from "@/lib/pos/revenue-share";
import { usePosStore } from "@/lib/pos/store";
import type { Order, OrderLine } from "@/lib/pos/types";
import {
  accrueLabor,
  approveAp,
  codeApLine,
  emptyBook,
  postApInvoice,
  postPosDay,
  recordSale,
  saveApInvoice,
  submitAp,
  upsertRecipe,
  upsertSku,
  upsertVendor,
  withAvtAlerts,
} from "./engine";
import { useFinanceStore } from "./store";
import type { EntityBook, FinCategory, PosDayInput, RevenueShareLeg } from "./types";

function finCategory(raw: string): FinCategory {
  if (raw === "food") return "food";
  if (raw === "liquor" || raw === "beer" || raw === "wine") return "bev";
  if (raw === "paper" || raw === "supplies") return "supplies";
  return "other";
}

function lineEntity(line: OrderLine): string {
  return String(line.entityId || line.vendorId || "").trim();
}

function lineMerch(line: OrderLine): number {
  const mods = line.modifiers.reduce((sum, mod) => sum + mod.priceCents, 0);
  return Math.max(0, line.quantity * (line.unitPriceCents + mods) - (line.discountCents || 0));
}

function absorbCatalog(book: EntityBook): EntityBook {
  const cost = useCostStore.getState();
  let next = book;
  for (const sku of cost.skus) {
    if (sku.entityId !== book.entityId) continue;
    if (next.skus.some((row) => row.id === sku.id)) continue;
    next = upsertSku(next, {
      id: sku.id,
      entityId: book.entityId,
      name: sku.name,
      unit: sku.unit || "each",
      onHand: sku.onHand,
      costCents: sku.costCents,
      lastPayCents: sku.lastPoPriceCents,
      category: finCategory(sku.category),
    });
  }
  for (const recipe of cost.recipes) {
    if (recipe.entityId && recipe.entityId !== book.entityId) continue;
    const menuItemId = recipe.menuItemId;
    if (!menuItemId || next.recipes.some((row) => row.menuItemId === menuItemId)) continue;
    const lines = recipe.lines
      .filter((line) => line.skuId && line.qty > 0)
      .map((line) => ({ skuId: line.skuId as string, qty: line.qty, unit: line.unit || "each" }));
    if (!lines.length) continue;
    next = upsertRecipe(next, {
      id: recipe.id,
      entityId: book.entityId,
      menuItemId,
      name: recipe.name,
      kind: recipe.station === "bar" ? "bev" : "food",
      yieldQty: recipe.yieldQty > 0 ? recipe.yieldQty : 1,
      wasteFactor: recipe.wasteFactor || 0,
      lines,
    });
  }
  return next;
}

function dayOrders(orders: Order[], date: string, timeZone?: string): Order[] {
  return orders.filter((order) => {
    if (order.status !== "closed") return false;
    const at = order.closedAt ?? order.createdAt;
    return venueYmd(at, timeZone) === date;
  });
}

function buildDay(entityId: string, orders: Order[], date: string, live: boolean, locationId: string): PosDayInput {
  const pos = usePosStore.getState();
  const menu = pos.menuItems;
  let food = 0;
  let bev = 0;
  let other = 0;
  let discounts = 0;
  let comps = 0;
  let tax = 0;
  let tips = 0;
  let giftSold = 0;
  let cash = 0;
  let card = 0;
  let giftRedeem = 0;
  let otherTender = 0;
  for (const order of orders) {
    const lines = order.lines.filter((line) => line.sent && lineEntity(line) === entityId);
    let entityMerch = 0;
    let orderMerch = 0;
    for (const line of order.lines) {
      if (!line.sent || line.voided) continue;
      const merch = lineMerch(line);
      if (!line.comped) orderMerch += merch;
      if (lineEntity(line) !== entityId) continue;
      if (line.comped) {
        comps += lineMerch({ ...line, discountCents: 0 });
        continue;
      }
      if (line.taxCategory === "gift") {
        giftSold += merch;
        continue;
      }
      entityMerch += merch;
      discounts += line.discountCents || 0;
      if (isDrinkLine(line, menu)) bev += merch;
      else if (isFoodLine(line, menu)) food += merch;
      else other += merch;
    }
    const share = orderMerch > 0 ? entityMerch / orderMerch : lines.length ? 1 : 0;
    if (share <= 0) continue;
    discounts += Math.round((order.discountCents || 0) * share);
    try {
      tax += Math.round(computeTotals(order, pos.settings).taxCents * share);
    } catch {
      /* tax stays on the lines already counted */
    }
    for (const pay of order.payments) {
      const amount = Math.round(Math.abs(pay.amountCents) * share);
      const tip = Math.round(Math.abs(pay.tipCents || 0) * share);
      tips += tip;
      if (pay.method === "cash") cash += amount + tip;
      else if (pay.method === "card" || pay.method === "room_charge") card += amount + tip;
      else if (pay.method === "gift_card") giftRedeem += amount;
      else if (pay.method !== "comp") otherTender += amount;
    }
  }
  const shareLines = shareLinesForOrders({
    orders,
    config: pos.settings.revenueShare,
    tables: pos.tables,
    sections: pos.floorSections,
    menuItems: menu,
    settings: pos.settings,
    timeZone: pos.settings.timezone,
  }).filter((line) => line.day === date);
  const legs = new Map<string, RevenueShareLeg>();
  for (const line of shareLines) {
    if (line.fromEntityId === entityId) {
      const key = `pay:${line.toEntityId}`;
      const prev = legs.get(key);
      legs.set(key, {
        direction: "pay",
        counterpartyId: line.toEntityId,
        cents: (prev?.cents ?? 0) + line.amountCents,
      });
    }
    if (line.toEntityId === entityId) {
      const key = `recv:${line.fromEntityId}`;
      const prev = legs.get(key);
      legs.set(key, {
        direction: "receive",
        counterpartyId: line.fromEntityId,
        cents: (prev?.cents ?? 0) + line.amountCents,
      });
    }
  }
  return {
    entityId,
    locationId,
    businessDate: date,
    at: Date.now(),
    live,
    foodSalesCents: food,
    bevSalesCents: bev + other,
    discountCents: discounts,
    compCents: comps,
    taxCents: tax,
    tipsCents: tips,
    giftSoldCents: giftSold,
    tenders: { cashCents: cash, cardCents: card, giftRedeemCents: giftRedeem, otherCents: otherTender },
    cashOverShortCents: 0,
    revenueShare: [...legs.values()],
  };
}

export function businessDateNow(): string {
  const tz = usePosStore.getState().settings.timezone;
  return venueYmd(Date.now(), tz);
}

export function postBooksForBusinessDate(date = businessDateNow()): void {
  const pos = usePosStore.getState();
  const live = pos.settings.lifecycleStatus === "live";
  useFinanceStore.getState().setLive(live);
  const locationId = pos.tenantLocationId || "";
  const orders = dayOrders(pos.orders, date, pos.settings.timezone);
  const entities = new Set<string>();
  for (const vendor of pos.vendors) {
    if (vendor.id) entities.add(vendor.id);
  }
  for (const order of orders) {
    for (const line of order.lines) {
      const id = lineEntity(line);
      if (id) entities.add(id);
    }
  }
  const punches = useOpsStore.getState().punches;
  for (const entityId of entities) {
    let book = useFinanceStore.getState().byEntity[entityId] ?? emptyBook(entityId, locationId);
    book = { ...book, locationId: book.locationId || locationId };
    book = absorbCatalog(book);
    book = postPosDay(book, buildDay(entityId, orders, date, live, locationId));
    const policy = cashPolicyFromSettings(pos.settings);
    for (const order of orders) {
      for (const line of order.lines) {
        if (!line.sent || line.voided || line.comped) continue;
        if (lineEntity(line) !== entityId) continue;
        const merch = lineMerch(line);
        const cashUnit = line.quantity > 0 ? Math.round(merch / line.quantity) : merch;
        book = recordSale(book, {
          menuItemId: line.menuItemId,
          qty: line.quantity,
          businessDate: date,
          at: order.closedAt ?? order.createdAt,
          live,
          cashPriceCents: cashUnit,
          cardPriceCents: policy ? cardPriceCents(cashUnit, policy) : cashUnit,
          locationId,
          key: `sale:${order.id}:${line.id}`,
        });
      }
    }
    const wage = book.accrualWageCents;
    if (wage > 0) {
      book = accrueLabor(
        book,
        punches
          .filter((punch) => punchEntity(punch.operatorId, punch.employeeId) === entityId)
          .map((punch) => ({
            approved: punch.status === "approved" || punch.status === "auto_approved" || punch.status === "corrected",
            minutes: (punch.regularMinutes || 0) + (punch.otMinutes || 0) || minutesOf(punch.clockInAt, punch.clockOutAt),
            wageCentsPerHour: wage,
            businessDate: venueYmd(punch.clockInAt, pos.settings.timezone),
            entityId,
          })),
        { at: Date.now(), live, locationId },
      );
    }
    book = withAvtAlerts(book, date);
    const result = useFinanceStore.getState().commit(entityId, entityId, book);
    if (result.ok) pushAvt(book);
  }
}

function punchEntity(operatorId: string | undefined, employeeId: string): string {
  if (operatorId) return operatorId;
  const emp = usePosStore.getState().employees.find((row) => row.id === employeeId);
  return emp?.operatorId || emp?.entityId || "";
}

function minutesOf(start: number, end?: number): number {
  if (!end || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

function pushAvt(book: EntityBook): void {
  const cost = useCostStore.getState();
  const fresh = book.alerts.filter((alert) => !cost.exceptions.some((row) => row.id === alert.id));
  if (!fresh.length) return;
  useCostStore.setState({
    exceptions: [
      ...fresh.map((alert) => ({
        id: alert.id,
        at: Date.now(),
        kind: "avt" as const,
        severity: "watch" as const,
        skuId: alert.skuId,
        skuName: alert.skuName,
        entityId: book.entityId,
        status: "open" as const,
        summary: alert.summary,
        evidence: {
          windowStart: 0,
          windowEnd: Date.now(),
          salesQty: 0,
          receiptsQty: 0,
          theoretical: alert.theoretical,
          expected: alert.theoretical,
          actual: alert.actual,
          opening: 0,
        },
      })),
      ...cost.exceptions,
    ],
  });
}

/** A cost-module post already changed on-hand. Book AP and the latest unit cost. */
export function ingestPostedCostInvoice(invoice: CostInvoice): void {
  if (invoice.status !== "posted") return;
  const entityId = invoice.entityId;
  if (!entityId) return;
  const lines = invoice.lines.filter((line) => line.skuId && line.entityId === entityId);
  if (!lines.length) return;
  const live = usePosStore.getState().settings.lifecycleStatus === "live";
  const locationId = usePosStore.getState().tenantLocationId || "";
  let book = useFinanceStore.getState().ensure(entityId, locationId);
  if (book.invoices.some((row) => row.id === `cost_${invoice.id}`)) return;
  const cost = useCostStore.getState();
  for (const line of lines) {
    const sku = cost.skus.find((row) => row.id === line.skuId);
    if (!sku) continue;
    book = upsertSku(book, {
      id: sku.id,
      entityId,
      name: sku.name,
      unit: sku.unit || "each",
      onHand: sku.onHand,
      costCents: line.unitCostCents || sku.costCents,
      lastPayCents: line.unitCostCents,
      category: finCategory(line.category),
    });
  }
  book = upsertVendor(book, invoice.vendorName || "Vendor");
  const vendorId = book.vendors.find((row) => row.name === (invoice.vendorName || "Vendor"))?.id || book.vendors[0]?.id;
  if (!vendorId) return;
  book = saveApInvoice(book, {
    id: `cost_${invoice.id}`,
    vendorId,
    number: invoice.invoiceNumber || invoice.id,
    businessDate: venueYmd(invoice.date || Date.now(), usePosStore.getState().settings.timezone),
    stockAlreadyApplied: true,
    connector: "manual",
    lines: lines.map((line) => ({
      skuId: line.skuId as string,
      qty: line.qty,
      unitCostCents: line.unitCostCents,
      category: finCategory(line.category),
      glAccount: finCategory(line.category) === "bev" ? "1210" : finCategory(line.category) === "food" ? "1200" : "1220",
    })),
  });
  const row = book.invoices.find((item) => item.id === `cost_${invoice.id}`);
  if (!row) return;
  for (const line of row.lines) {
    if (!line.glAccount) continue;
    book = codeApLine(book, row.id, line.id, line.glAccount);
  }
  book = submitAp(book, row.id);
  book = approveAp(book, row.id);
  book = postApInvoice(book, row.id, { at: Date.now(), live, locationId });
  useFinanceStore.getState().commit(entityId, entityId, book);
}
