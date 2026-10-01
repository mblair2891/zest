import type {
  CostInvoice,
  CostSku,
  InventoryCount,
  ItemRecipe,
  WasteLog,
} from "@/lib/costs/types";
import type { ServerCloseout } from "@/lib/pos/closeout";
import type { TimePunch } from "@/lib/pos/ops-types";
import type { CateringEvent } from "@/lib/pos/platform-types";
import { venueYmd } from "@/lib/pos/revenue-share";
import type { Employee, Order, OrderLine } from "@/lib/pos/types";
import type { OwnerEvent, OwnerInput, OwnerInvoice, OwnerRecipe, OwnerSale, OwnerSku } from "./home";

type Vendor = { id: string };

function categoryOf(raw: string): OwnerSku["category"] {
  if (raw === "food") return "food";
  if (raw === "liquor" || raw === "beer" || raw === "wine") return "bev";
  return "other";
}

function lineEntity(line: OrderLine, vendors: Vendor[]): string {
  return line.entityId || line.vendorId || (vendors.length === 1 ? vendors[0].id : "");
}

function drink(line: OrderLine): boolean {
  return line.station === "bar" || line.course === "drink";
}

function marketplaceChannel(order: Order): OwnerSale["channel"] {
  const marketplace = order.marketplace || order.payments.some((pay) => pay.method === "marketplace");
  if (!marketplace) return "house";
  if (order.deliveryVendor === "doordash" || order.diningOption === "Delivery-DoorDash") return "doordash";
  if (order.deliveryVendor === "ubereats" || order.diningOption === "Delivery-UberEats") return "ubereats";
  return "delivery";
}

export function collectOwnerFacts(args: {
  today: string;
  timeZone?: string;
  now: number;
  vendors: Vendor[];
  orders: Order[];
  employees: Employee[];
  punches: TimePunch[];
  skus: CostSku[];
  recipes: ItemRecipe[];
  invoices: CostInvoice[];
  counts: InventoryCount[];
  waste: WasteLog[];
  events: CateringEvent[];
}): Omit<OwnerInput, "entityId" | "wageCentsPerHour" | "cash" | "marks"> {
  const zone = args.timeZone;
  const sales: OwnerSale[] = [];
  for (const order of args.orders) {
    if (order.status === "voided" || order.status === "cancelled") continue;
    const businessDate = venueYmd(order.closedAt ?? order.createdAt, zone);
    const lines = order.lines.filter((line) => !line.voided && lineEntity(line, args.vendors));
    const merch = lines.reduce((sum, line) => {
      if (line.comped) return sum;
      return sum + Math.max(0, line.unitPriceCents * line.quantity - (line.discountCents || 0));
    }, 0);
    const cashPay = order.payments.filter((pay) => pay.method === "cash").reduce((sum, pay) => sum + pay.amountCents, 0);
    const cardPay = order.payments.filter((pay) => pay.method === "card").reduce((sum, pay) => sum + pay.amountCents, 0);
    for (const line of lines) {
      const entityId = lineEntity(line, args.vendors);
      const gross = Math.max(0, line.unitPriceCents * line.quantity - (line.discountCents || 0));
      const share = !line.comped && merch > 0 ? gross / merch : 0;
      sales.push({
        entityId,
        businessDate,
        menuItemId: line.menuItemId,
        name: line.name,
        kind: drink(line) ? "bev" : "food",
        qty: line.quantity,
        netCents: line.comped ? 0 : gross,
        compCents: line.comped ? gross : 0,
        cashCents: Math.round(cashPay * share),
        cardCents: Math.round(cardPay * share),
        cashPriceCents: line.quantity > 0 ? Math.round(gross / line.quantity) : line.unitPriceCents,
        channel: marketplaceChannel(order),
      });
    }
  }

  const skus: OwnerSku[] = args.skus.map((sku) => ({
    id: sku.id,
    entityId: sku.entityId,
    name: sku.name,
    unit: sku.unit,
    onHand: sku.onHand,
    costCents: sku.costCents,
    category: categoryOf(sku.category),
  }));

  const recipes: OwnerRecipe[] = [];
  for (const recipe of args.recipes) {
    if (!recipe.entityId) continue;
    const ids = recipe.menuItemIds?.length ? recipe.menuItemIds : [recipe.menuItemId];
    for (const menuItemId of ids) {
      recipes.push({
        entityId: recipe.entityId,
        menuItemId,
        name: recipe.name,
        kind: recipe.station === "bar" ? "bev" : "food",
        yieldQty: recipe.yieldQty > 0 ? recipe.yieldQty : 1,
        lines: recipe.lines
          .filter((line) => line.skuId)
          .map((line) => ({ skuId: line.skuId as string, qty: line.qty, unit: line.unit || skuUnit(skus, line.skuId) })),
      });
    }
  }

  const invoices: OwnerInvoice[] = args.invoices
    .filter((invoice) => invoice.status !== "void" && invoice.status !== "draft")
    .map((invoice) => ({
      id: invoice.id,
      entityId: invoice.entityId,
      vendorName: invoice.vendorName,
      businessDate: venueYmd(invoice.date, zone),
      dueDate: venueYmd(invoice.date + 7 * 86400000, zone),
      status: invoice.paidAt ? "paid" : "open",
      totalCents: invoice.lines.reduce((sum, line) => sum + Math.round(line.qty * line.unitCostCents), 0),
      lines: invoice.lines.map((line) => ({
        skuId: line.skuId || line.id,
        name: line.rawName,
        qty: line.qty,
        unitCostCents: line.unitCostCents,
        category: categoryOf(line.category),
      })),
    }));

  const punches = args.punches.flatMap((punch) => {
    if (punch.status === "rejected") return [];
    const entityId = punchEntity(punch, args.employees, args.vendors);
    if (!entityId) return [];
    const minutes =
      punch.clockOutAt && (punch.regularMinutes != null || punch.otMinutes != null)
        ? (punch.regularMinutes ?? 0) + (punch.otMinutes ?? 0)
        : Math.max(0, Math.round(((punch.clockOutAt ?? args.now) - punch.clockInAt) / 60000));
    return [
      {
        entityId,
        businessDate: venueYmd(punch.clockInAt, zone),
        minutes,
        status: punch.clockOutAt ? ("closed" as const) : ("open" as const),
      },
    ];
  });

  const latestCount = new Map<string, { at: number; qty: number; entityId: string; skuId: string; businessDate: string }>();
  for (const count of args.counts) {
    const businessDate = venueYmd(count.at, zone);
    for (const line of count.lines) {
      const key = `${count.entityId}:${line.skuId}:${businessDate}`;
      const prev = latestCount.get(key);
      if (!prev || count.at >= prev.at) {
        latestCount.set(key, { at: count.at, qty: line.qty, entityId: count.entityId, skuId: line.skuId, businessDate });
      }
    }
  }

  const events: OwnerEvent[] = args.events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      businessDate: venueYmd(event.startsAt, zone),
      name: event.name,
      extraHeads: event.guestCount >= 40 ? 2 : 1,
    }));

  const history = sales
    .filter((row) => row.businessDate < args.today)
    .reduce<OwnerInput["history"]>((rows, row) => {
      const hit = rows.find((item) => item.entityId === row.entityId && item.businessDate === row.businessDate);
      if (hit) hit.netSalesCents += row.netCents;
      else rows.push({ entityId: row.entityId, businessDate: row.businessDate, netSalesCents: row.netCents });
      return rows;
    }, []);

  return {
    today: args.today,
    sales,
    invoices,
    punches,
    skus,
    recipes,
    counts: [...latestCount.values()].map(({ entityId, skuId, businessDate, qty }) => ({
      entityId,
      skuId,
      businessDate,
      qty,
    })),
    waste: args.waste.map((row) => ({
      entityId: row.entityId,
      skuId: row.skuId,
      businessDate: venueYmd(row.at, zone),
      qty: row.qty,
    })),
    history,
    events,
  };
}

function skuUnit(skus: OwnerSku[], skuId: string | undefined): string {
  return skus.find((sku) => sku.id === skuId)?.unit || "ea";
}

function punchEntity(punch: TimePunch, employees: Employee[], vendors: Vendor[]): string | null {
  if (punch.operatorId) return punch.operatorId;
  const employee = employees.find((row) => row.id === punch.employeeId);
  if (employee?.operatorId) return employee.operatorId;
  if (vendors.length === 1) return vendors[0].id;
  return null;
}

export function cashForEntity(args: {
  entityId: string;
  today: string;
  timeZone?: string;
  vendors: Vendor[];
  employees: Employee[];
  closeouts: ServerCloseout[];
  fallbackCashCents: number;
}): { systemCashCents: number; blindCountCents: number | null; depositCents: number | null } {
  const single = args.vendors.length === 1;
  const staff = new Set(
    args.employees
      .filter((employee) => employee.operatorId === args.entityId || (single && !employee.operatorId))
      .map((employee) => employee.id),
  );
  const rows = args.closeouts.filter(
    (row) => staff.has(row.employeeId) && venueYmd(row.at, args.timeZone) === args.today,
  );
  if (!rows.length) {
    return { systemCashCents: args.fallbackCashCents, blindCountCents: null, depositCents: null };
  }
  const counted = rows.filter((row) => row.countedBlind && row.countedCents != null);
  const system = rows.reduce((sum, row) => sum + (row.expectedCents ?? 0), 0);
  return {
    systemCashCents: system || args.fallbackCashCents,
    blindCountCents: counted.length ? counted.reduce((sum, row) => sum + (row.countedCents ?? 0), 0) : null,
    depositCents: rows.reduce((sum, row) => sum + (row.dropsCents || 0), 0),
  };
}
