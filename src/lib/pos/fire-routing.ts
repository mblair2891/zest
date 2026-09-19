import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  isOrderPrinterType,
  isReceiptPrinterType,
  normalizeDestinationName,
  type LocationDevice,
} from "@/lib/pos/location-devices";
import {
  DEFAULT_ORDER_DESTINATION,
  destinationForGroup,
  ticketStationForDestination,
} from "@/lib/pos/order-destinations";
import {
  isBarOrderPrinter,
  resolveBarPrinterForCheck,
  type SectionRef,
  type TableRef,
} from "@/lib/print/printer-assignment";
import type { Course, KitchenTicketItem, MenuCategory, MenuItem, TicketStation } from "@/lib/pos/types";

export type FireLineInput = {
  id: string;
  name: string;
  quantity: number;
  modifiers: Array<{ optionName: string } | string>;
  note?: string;
  seat?: number;
  course: Course;
  station: TicketStation;
  vendorId?: string;
  vendorName?: string;
  menuItemId?: string;
  categoryId?: string;
};

export type FireSlip = {
  destinationName: string;
  printerId?: string;
  station: TicketStation;
  vendorId?: string;
  vendorName?: string;
  course: Course;
  items: KitchenTicketItem[];
};

function destKey(name: string): string {
  return normalizeDestinationName(name).toLowerCase();
}

export function isActiveOrderPrinter(d: LocationDevice | null | undefined): boolean {
  if (!d || d.status === "inactive") return false;
  if (isReceiptPrinterType(d.type) || d.print?.station === "receipt") return false;
  return isOrderPrinterType(d.type) || Boolean(d.print?.station);
}

function printerDestination(d: LocationDevice): string {
  return (
    normalizeDestinationName(d.print?.destinationName) ||
    (d.print?.station === "bar" ? "Bar" : DEFAULT_ORDER_DESTINATION)
  );
}

function entityPool(
  list: LocationDevice[],
  operatorId?: string | null,
): LocationDevice[] {
  if (!operatorId || operatorId === HOST_SCOPE) return list;
  const scoped = list.filter(
    (d) => d.assignment.operatorId === HOST_SCOPE || d.assignment.operatorId === operatorId,
  );
  return scoped.length ? scoped : list.filter((d) => d.assignment.operatorId === HOST_SCOPE);
}

function matchDestination(list: LocationDevice[], destinationName: string): LocationDevice[] {
  const key = destKey(destinationName);
  return list.filter((d) => destKey(printerDestination(d)) === key);
}

/**
 * Order printers for a fire. Receipt printers never match.
 * Food: menu group destination + printer. Bar: floor section.
 * Named override wins. Bar with no bar printer → Kitchen.
 */
export function resolveOrderPrinters(opts: {
  devices: LocationDevice[] | undefined;
  destinationName: string;
  printerId?: string | null;
  operatorId?: string | null;
  stationDeviceId?: string | null;
  table?: TableRef;
  tables?: TableRef[];
  tableId?: string | null;
  sections?: SectionRef[];
  orderType?: string | null;
}): LocationDevice[] {
  const order = (opts.devices ?? []).filter(isActiveOrderPrinter);
  if (opts.printerId) {
    const named = order.find((d) => d.id === opts.printerId);
    if (named) return [named];
  }
  const dest = normalizeDestinationName(opts.destinationName) || DEFAULT_ORDER_DESTINATION;
  if (destKey(dest) === "bar") {
    const bar = resolveBarPrinterForCheck({
      devices: opts.devices,
      table: opts.table,
      tables: opts.tables,
      tableId: opts.tableId,
      sections: opts.sections,
      orderType: opts.orderType,
    });
    if (bar) {
      const hit = order.find((d) => d.id === bar.id);
      if (hit) return [hit];
    }
    const kitchen = entityPool(matchDestination(order, DEFAULT_ORDER_DESTINATION), opts.operatorId);
    return kitchen;
  }
  const pool = order.filter((d) => !isBarOrderPrinter(d));
  return entityPool(matchDestination(pool.length ? pool : order, dest), opts.operatorId);
}

export function resolveFireTarget(
  line: FireLineInput,
  ctx: {
    categories: MenuCategory[];
    menuItems: MenuItem[];
    devices: LocationDevice[];
    stationDeviceId?: string | null;
    table?: TableRef;
    tables?: TableRef[];
    tableId?: string | null;
    sections?: SectionRef[];
    orderType?: string | null;
  },
): { destinationName: string; printerId?: string; station: TicketStation } {
  const item = line.menuItemId
    ? ctx.menuItems.find((m) => m.id === line.menuItemId)
    : undefined;
  const cat =
    (item?.categoryId ? ctx.categories.find((c) => c.id === item.categoryId) : undefined) ??
    (line.categoryId ? ctx.categories.find((c) => c.id === line.categoryId) : undefined);
  const destinationName = destinationForGroup(cat, item?.station ?? line.station);
  const barDest = destKey(destinationName) === "bar";
  const override = barDest ? "" : cat?.printerId?.trim() || "";
  const printers = resolveOrderPrinters({
    devices: ctx.devices,
    destinationName,
    printerId: override || null,
    operatorId: line.vendorId,
    stationDeviceId: ctx.stationDeviceId,
    table: ctx.table,
    tables: ctx.tables,
    tableId: ctx.tableId,
    sections: ctx.sections,
    orderType: ctx.orderType,
  });
  const printerId =
    override && printers.some((p) => p.id === override)
      ? override
      : printers.length === 1
        ? printers[0]!.id
        : undefined;
  return {
    destinationName,
    printerId,
    station: ticketStationForDestination(destinationName),
  };
}

function modifierNames(mods: FireLineInput["modifiers"]): string[] {
  return mods.map((m) => (typeof m === "string" ? m : m.optionName)).filter(Boolean);
}

/**
 * One Send → one slip per destination + printer.
 * Menu group is not a cut. Course is not a cut unless separateCourseTickets is on.
 */
export function groupFireSlips(
  lines: FireLineInput[],
  ctx: {
    categories: MenuCategory[];
    menuItems: MenuItem[];
    devices: LocationDevice[];
    separateCourseTickets?: boolean;
    stationDeviceId?: string | null;
    table?: TableRef;
    tables?: TableRef[];
    tableId?: string | null;
    sections?: SectionRef[];
    orderType?: string | null;
  },
): FireSlip[] {
  const byKey = new Map<string, FireSlip>();
  const order: string[] = [];
  for (const line of lines) {
    const target = resolveFireTarget(line, ctx);
    const coursePart = ctx.separateCourseTickets ? `|${line.course}` : "";
    const key = `${destKey(target.destinationName)}|${target.printerId ?? ""}${coursePart}`;
    let slip = byKey.get(key);
    if (!slip) {
      slip = {
        destinationName: target.destinationName,
        printerId: target.printerId,
        station: target.station,
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        course: line.course,
        items: [],
      };
      byKey.set(key, slip);
      order.push(key);
    }
    slip.items.push({
      lineId: line.id,
      name: line.name,
      quantity: line.quantity,
      modifiers: modifierNames(line.modifiers),
      note: line.note,
      course: line.course,
      seat: line.seat,
    });
  }
  return order.map((k) => byKey.get(k)!);
}

export function printStationForDestination(dest: string): "kitchen" | "bar" | "expo" {
  const st = ticketStationForDestination(dest);
  if (st === "bar") return "bar";
  if (st === "expo") return "expo";
  return "kitchen";
}

/** True when a kitchen fire would never land on this device. */
export function receiptPrinterNeverGetsKitchenFire(d: LocationDevice): boolean {
  return isReceiptPrinterType(d.type) || d.print?.station === "receipt" || !isActiveOrderPrinter(d);
}
