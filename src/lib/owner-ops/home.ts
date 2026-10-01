/**
 * Owner ops for one selling entity.
 * Summex does not process payroll. A price test does not change the menu price.
 */

export type AvtMark = "event" | "take_home" | "count_error" | "investigate";

export type OwnerSale = {
  entityId: string;
  businessDate: string;
  menuItemId: string;
  name: string;
  kind: "food" | "bev";
  qty: number;
  netCents: number;
  compCents: number;
  cashCents: number;
  cardCents: number;
  cashPriceCents: number;
};

export type OwnerInvoiceLine = {
  skuId: string;
  name: string;
  qty: number;
  unitCostCents: number;
  category: "food" | "bev" | "other";
};

export type OwnerInvoice = {
  id: string;
  entityId: string;
  vendorName: string;
  businessDate: string;
  dueDate: string;
  status: "open" | "paid";
  totalCents: number;
  lines: OwnerInvoiceLine[];
};

export type OwnerPunch = {
  entityId: string;
  businessDate: string;
  minutes: number;
  /** Rejected punches are omitted by the caller. */
  status: "open" | "closed";
};

export type OwnerSku = {
  id: string;
  entityId: string;
  name: string;
  unit: string;
  onHand: number;
  costCents: number;
  category: "food" | "bev" | "other";
  lastPayCents?: number;
};

export type OwnerRecipe = {
  entityId: string;
  menuItemId: string;
  name: string;
  kind: "food" | "bev";
  yieldQty: number;
  lines: Array<{ skuId: string; qty: number; unit: string }>;
};

export type OwnerCount = { entityId: string; skuId: string; businessDate: string; qty: number };
export type OwnerWaste = { entityId: string; skuId: string; businessDate: string; qty: number };
export type OwnerEvent = { businessDate: string; name: string; extraHeads?: number };
export type OwnerHistory = { entityId: string; businessDate: string; netSalesCents: number };

export type OwnerInput = {
  entityId: string;
  today: string;
  wageCentsPerHour: number;
  sales: OwnerSale[];
  invoices: OwnerInvoice[];
  punches: OwnerPunch[];
  skus: OwnerSku[];
  recipes: OwnerRecipe[];
  counts: OwnerCount[];
  waste: OwnerWaste[];
  history: OwnerHistory[];
  events: OwnerEvent[];
  marks?: Record<string, AvtMark>;
  cash?: {
    systemCashCents: number;
    blindCountCents: number | null;
    depositCents: number | null;
  };
};

export type OwnerMetrics = {
  netSalesCents: number;
  cashCents: number;
  cardCents: number;
  compCents: number;
  foodSalesCents: number;
  bevSalesCents: number;
  foodCostCents: number;
  bevCostCents: number;
  laborCents: number;
  primeCents: number;
  primePct: number | null;
  laborPct: number | null;
  foodCostPct: number | null;
  bevCostPct: number | null;
};

export type AvtRow = {
  id: string;
  entityId: string;
  skuId: string;
  item: string;
  category: "food" | "bev";
  businessDate: string;
  expected: number;
  actual: number;
  gapCents: number;
  mark?: AvtMark;
};

export type PriceFlag = {
  invoiceId: string;
  skuId: string;
  item: string;
  unitCostCents: number;
  lastPayCents: number;
};

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export type MenuRow = {
  menuItemId: string;
  name: string;
  qty: number;
  cashMarginCents: number;
  klass: MenuClass;
  suggestion: string;
};

export type DraftShift = {
  entityId: string;
  businessDate: string;
  role: string;
  heads: number;
  start: string;
  end: string;
  note: string;
  status: "draft";
};

export type CountSheetRow = { skuId: string; name: string; unit: string; onHand: number };

export type CashNight = {
  systemCashCents: number;
  blindCountCents: number | null;
  overShortCents: number | null;
  depositCents: number | null;
};

export type OwnerHome = {
  entityId: string;
  today: string;
  weekStart: string;
  weekEnd: string;
  todayMetrics: OwnerMetrics;
  weekMetrics: OwnerMetrics;
  foodFlag: boolean;
  avt: AvtRow[];
  invoices: Array<OwnerInvoice & { dueThisWeek: boolean }>;
  priceFlags: PriceFlag[];
  menu: MenuRow[];
  drafts: DraftShift[];
  countSheet: CountSheetRow[];
  cash: CashNight;
};

function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

function weekday(iso: string): number {
  return parseDay(iso).getUTCDay();
}

export function weekBounds(today: string): { start: string; end: string } {
  const day = weekday(today);
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  return { start, end: addDays(start, 6) };
}

export function nextWeekStart(today: string): string {
  return addDays(weekBounds(today).end, 1);
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function mine<T extends { entityId: string }>(rows: T[], entityId: string): T[] {
  return rows.filter((row) => row.entityId === entityId);
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function recipeCostCents(recipe: OwnerRecipe | undefined, skus: OwnerSku[]): number {
  if (!recipe) return 0;
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  let cents = 0;
  for (const line of recipe.lines) {
    const sku = skus.find((row) => row.id === line.skuId);
    if (!sku) continue;
    cents += (line.qty / yieldQty) * sku.costCents;
  }
  return Math.round(cents);
}

function metrics(
  sales: OwnerSale[],
  punches: OwnerPunch[],
  recipes: OwnerRecipe[],
  skus: OwnerSku[],
  wageCentsPerHour: number,
  start: string,
  end: string,
): OwnerMetrics {
  const windowSales = sales.filter((row) => inRange(row.businessDate, start, end));
  const windowPunches = punches.filter((row) => inRange(row.businessDate, start, end));
  let netSalesCents = 0;
  let cashCents = 0;
  let cardCents = 0;
  let compCents = 0;
  let foodSalesCents = 0;
  let bevSalesCents = 0;
  let foodCostCents = 0;
  let bevCostCents = 0;
  for (const row of windowSales) {
    netSalesCents += row.netCents;
    cashCents += row.cashCents;
    cardCents += row.cardCents;
    compCents += row.compCents;
    const recipe = recipes.find((item) => item.menuItemId === row.menuItemId);
    const cost = recipeCostCents(recipe, skus) * row.qty;
    if (row.kind === "bev") {
      bevSalesCents += row.netCents;
      bevCostCents += cost;
    } else {
      foodSalesCents += row.netCents;
      foodCostCents += cost;
    }
  }
  const minutes = windowPunches.reduce((sum, row) => sum + row.minutes, 0);
  const laborCents = Math.round((minutes / 60) * wageCentsPerHour);
  const primeCents = foodCostCents + bevCostCents + laborCents;
  return {
    netSalesCents,
    cashCents,
    cardCents,
    compCents,
    foodSalesCents,
    bevSalesCents,
    foodCostCents,
    bevCostCents,
    laborCents,
    primeCents,
    primePct: pct(primeCents, netSalesCents),
    laborPct: pct(laborCents, netSalesCents),
    foodCostPct: pct(foodCostCents, foodSalesCents),
    bevCostPct: pct(bevCostCents, bevSalesCents),
  };
}

function actualUse(
  skuId: string,
  businessDate: string,
  invoices: OwnerInvoice[],
  counts: OwnerCount[],
  waste: OwnerWaste[],
): number {
  const skuCounts = counts.filter((row) => row.skuId === skuId).sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const closing = [...skuCounts].reverse().find((row) => row.businessDate === businessDate)?.qty;
  const opening = [...skuCounts].reverse().find((row) => row.businessDate < businessDate)?.qty ?? 0;
  const received = invoices
    .filter((row) => row.businessDate === businessDate)
    .reduce(
      (sum, row) => sum + row.lines.filter((line) => line.skuId === skuId).reduce((lineSum, line) => lineSum + line.qty, 0),
      0,
    );
  const wasted = waste.filter((row) => row.skuId === skuId && row.businessDate === businessDate).reduce((sum, row) => sum + row.qty, 0);
  if (closing == null) return opening + received - wasted;
  return opening + received - closing - wasted;
}

function avtRows(
  entityId: string,
  businessDate: string,
  sales: OwnerSale[],
  recipes: OwnerRecipe[],
  skus: OwnerSku[],
  invoices: OwnerInvoice[],
  counts: OwnerCount[],
  waste: OwnerWaste[],
  marks: Record<string, AvtMark>,
): AvtRow[] {
  const expected: Record<string, number> = {};
  for (const sale of sales.filter((row) => row.businessDate === businessDate)) {
    const recipe = recipes.find((item) => item.menuItemId === sale.menuItemId);
    if (!recipe) continue;
    const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
    for (const line of recipe.lines) {
      expected[line.skuId] = (expected[line.skuId] ?? 0) + (line.qty / yieldQty) * sale.qty;
    }
  }
  const rows: AvtRow[] = [];
  for (const skuId of Object.keys(expected)) {
    const theoretical = expected[skuId] ?? 0;
    if (theoretical <= 0) continue;
    const sku = skus.find((row) => row.id === skuId);
    if (!sku || sku.category === "other") continue;
    const actual = actualUse(skuId, businessDate, invoices, counts, waste);
    const gap = Math.abs(actual - theoretical) / theoretical;
    if (gap < 0.1 && Math.abs(actual - theoretical) < 1) continue;
    const id = `avt:${entityId}:${skuId}:${businessDate}`;
    rows.push({
      id,
      entityId,
      skuId,
      item: sku.name,
      category: sku.category,
      businessDate,
      expected: theoretical,
      actual,
      gapCents: Math.round(Math.abs(actual - theoretical) * sku.costCents),
      mark: marks[id],
    });
  }
  return rows.sort((a, b) => b.gapCents - a.gapCents);
}

function priceFlags(invoices: OwnerInvoice[], skus: OwnerSku[]): PriceFlag[] {
  const flags: PriceFlag[] = [];
  const ordered = [...invoices].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  for (const invoice of ordered) {
    if (invoice.status === "paid") continue;
    for (const line of invoice.lines) {
      const sku = skus.find((row) => row.id === line.skuId);
      let last = sku?.lastPayCents;
      for (const prior of ordered) {
        if (prior.businessDate >= invoice.businessDate) break;
        const hit = prior.lines.find((row) => row.skuId === line.skuId);
        if (hit) last = hit.unitCostCents;
      }
      if (last == null || line.unitCostCents <= last) continue;
      flags.push({
        invoiceId: invoice.id,
        skuId: line.skuId,
        item: line.name || sku?.name || line.skuId,
        unitCostCents: line.unitCostCents,
        lastPayCents: last,
      });
    }
  }
  return flags;
}

function suggestion(klass: MenuClass): string {
  if (klass === "star") return "Keep this cash price. A price test is optional, and the menu price does not change.";
  if (klass === "plowhorse") return "Price test: it sells and the contribution is thin. The cash price does not change.";
  if (klass === "puzzle") return "Price test: contribution is strong and it sells less often. The cash price does not change.";
  return "Price test: try another cash price on the next menu pass. The cash price does not change.";
}

function menuRows(sales: OwnerSale[], recipes: OwnerRecipe[], skus: OwnerSku[], start: string, end: string): MenuRow[] {
  const windowSales = sales.filter((row) => inRange(row.businessDate, start, end) && row.qty > 0);
  const total = windowSales.reduce((sum, row) => sum + row.qty, 0);
  if (!total) return [];
  const byItem = new Map<string, MenuRow>();
  for (const row of windowSales) {
    const recipe = recipes.find((item) => item.menuItemId === row.menuItemId);
    const cost = recipeCostCents(recipe, skus);
    const current = byItem.get(row.menuItemId);
    const qty = (current?.qty ?? 0) + row.qty;
    byItem.set(row.menuItemId, {
      menuItemId: row.menuItemId,
      name: recipe?.name || row.name,
      qty,
      cashMarginCents: row.cashPriceCents - cost,
      klass: "dog",
      suggestion: "",
    });
  }
  const rows = [...byItem.values()];
  const avgPop = rows.reduce((sum, row) => sum + row.qty / total, 0) / rows.length;
  const avgMargin = rows.reduce((sum, row) => sum + row.cashMarginCents, 0) / rows.length;
  return rows.map((row) => {
    const popular = row.qty / total >= avgPop;
    const rich = row.cashMarginCents >= avgMargin;
    const klass: MenuClass = popular && rich ? "star" : popular ? "plowhorse" : rich ? "puzzle" : "dog";
    return { ...row, klass, suggestion: suggestion(klass) };
  });
}

function bandHeads(salesCents: number): number {
  if (salesCents <= 0) return 0;
  if (salesCents < 50_000) return 1;
  if (salesCents < 150_000) return 2;
  return 3;
}

export function draftNextWeek(input: {
  entityId: string;
  today: string;
  history: OwnerHistory[];
  events: OwnerEvent[];
}): DraftShift[] {
  const history = input.history.filter((row) => row.entityId === input.entityId && row.businessDate < input.today);
  const start = nextWeekStart(input.today);
  const drafts: DraftShift[] = [];
  for (let i = 0; i < 7; i += 1) {
    const businessDate = addDays(start, i);
    const dow = weekday(businessDate);
    const same = history
      .filter((row) => weekday(row.businessDate) === dow)
      .sort((a, b) => a.businessDate.localeCompare(b.businessDate))
      .slice(-4);
    const avg = same.length ? Math.round(same.reduce((sum, row) => sum + row.netSalesCents, 0) / same.length) : 0;
    const event = input.events.find((row) => row.businessDate === businessDate);
    const extra = event ? event.extraHeads ?? 1 : 0;
    const heads = bandHeads(avg) + extra;
    const note = event
      ? `${event.name}. Draft only. PIN clock remains the hours.`
      : same.length
        ? "Draft from the last four same weekdays. PIN clock remains the hours."
        : "No same-weekday sales yet. PIN clock remains the hours.";
    for (const role of ["Line", "Service"]) {
      drafts.push({
        entityId: input.entityId,
        businessDate,
        role,
        heads,
        start: "11:00",
        end: "22:00",
        note,
        status: "draft",
      });
    }
  }
  return drafts;
}

export function editDraft(drafts: DraftShift[], businessDate: string, role: string, heads: number): DraftShift[] {
  return drafts.map((row) =>
    row.businessDate === businessDate && row.role === role ? { ...row, heads: Math.max(0, Math.round(heads)) } : row,
  );
}

export function nightCash(input: {
  systemCashCents: number;
  blindCountCents: number | null;
  depositCents: number | null;
}): CashNight {
  return {
    systemCashCents: input.systemCashCents,
    blindCountCents: input.blindCountCents,
    overShortCents: input.blindCountCents == null ? null : input.blindCountCents - input.systemCashCents,
    depositCents: input.depositCents,
  };
}

export function countSheet(skus: OwnerSku[], entityId: string): CountSheetRow[] {
  return mine(skus, entityId).map((sku) => ({
    skuId: sku.id,
    name: sku.name,
    unit: sku.unit,
    onHand: sku.onHand,
  }));
}

export function buildOwnerHome(input: OwnerInput): OwnerHome {
  const entityId = input.entityId;
  const sales = mine(input.sales, entityId);
  const invoices = mine(input.invoices, entityId);
  const punches = mine(input.punches, entityId);
  const skus = mine(input.skus, entityId);
  const recipes = mine(input.recipes, entityId);
  const counts = mine(input.counts, entityId);
  const waste = mine(input.waste, entityId);
  const bounds = weekBounds(input.today);
  const avt = avtRows(entityId, input.today, sales, recipes, skus, invoices, counts, waste, input.marks ?? {});
  const openInvoices = invoices
    .filter((row) => row.status === "open")
    .map((row) => ({ ...row, dueThisWeek: inRange(row.dueDate, bounds.start, bounds.end) }));
  return {
    entityId,
    today: input.today,
    weekStart: bounds.start,
    weekEnd: bounds.end,
    todayMetrics: metrics(sales, punches, recipes, skus, input.wageCentsPerHour, input.today, input.today),
    weekMetrics: metrics(sales, punches, recipes, skus, input.wageCentsPerHour, bounds.start, bounds.end),
    foodFlag: avt.some((row) => row.category === "food"),
    avt,
    invoices: openInvoices,
    priceFlags: priceFlags(invoices, skus),
    menu: menuRows(sales, recipes, skus, bounds.start, bounds.end),
    drafts: draftNextWeek(input),
    countSheet: countSheet(skus, entityId),
    cash: nightCash({
      systemCashCents: input.cash?.systemCashCents ?? 0,
      blindCountCents: input.cash?.blindCountCents ?? null,
      depositCents: input.cash?.depositCents ?? null,
    }),
  };
}

export function markAvt(input: OwnerInput, id: string, mark: AvtMark): OwnerInput {
  const row = buildOwnerHome(input).avt.find((item) => item.id === id);
  if (!row || row.entityId !== input.entityId) return input;
  return { ...input, marks: { ...input.marks, [id]: mark } };
}

export function markInvoicePaid(input: OwnerInput, invoiceId: string): OwnerInput {
  return {
    ...input,
    invoices: input.invoices.map((row) =>
      row.id === invoiceId && row.entityId === input.entityId ? { ...row, status: "paid" } : row,
    ),
  };
}
