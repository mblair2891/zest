/** Venue receipt printer. Section map is source of truth; station bind is fallback. */

import { resolveReceiptPrinterForCheck as resolveAssignedReceipt } from "./printer-assignment";

export type ReceiptBindRole = "order" | "ods" | "host" | "kiosk";

export type ReceiptBindDevice = {
  id: string;
  type: string;
  label?: string;
  status?: string;
  assignment?: { function?: string };
  receiptPrinterId?: string | null;
  print?: {
    station?: string;
    routes?: string[];
    boundStationIds?: string[];
    kickStationIds?: string[];
    sectionIds?: string[];
    serveNoSection?: boolean;
    venueDefault?: boolean;
  };
  stationClass?: string | null;
};

export type TableRef = {
  id?: string;
  section?: string;
  sectionId?: string;
} | null | undefined;

export type SectionRef = { id: string; name: string };

export const PAY_AT_FALLBACK = "Pay at a register or host stand.";
export const CASH_AT_FALLBACK = "Cash at a register or host stand.";

const RECEIPT_TYPES = new Set(["receipt_printer", "printer"]);

function isPrinterType(type: string): boolean {
  return (
    type === "printer" ||
    type === "receipt_printer" ||
    type === "order_printer" ||
    type === "kitchen_printer" ||
    type === "bar_printer" ||
    type === "label_printer"
  );
}

export function isReceiptPrinterRow(d: ReceiptBindDevice): boolean {
  if (d.status === "inactive") return false;
  if (!isPrinterType(d.type)) return false;
  if (RECEIPT_TYPES.has(d.type)) return true;
  return d.print?.station === "receipt" || Boolean(d.print?.routes?.includes("receipts"));
}

/** Section map: Dining table → Dining receipt printers. Venue default, then any receipt printer. */
export function resolveReceiptPrinterForCheck(opts: {
  devices: ReceiptBindDevice[] | undefined;
  stationDeviceId?: string | null;
  table?: TableRef;
  tables?: TableRef[];
  tableId?: string | null;
  sections?: SectionRef[];
  orderType?: string | null;
}): ReceiptBindDevice | undefined {
  return resolveAssignedReceipt(opts) as ReceiptBindDevice | undefined;
}

export function roleFromFunction(fn: string | undefined): ReceiptBindRole {
  switch (fn) {
    case "kitchen_kds":
    case "bar_kds":
    case "expo":
    case "split":
      return "ods";
    case "host_stand":
    case "busser":
      return "host";
    case "kiosk":
      return "kiosk";
    default:
      return "order";
  }
}

export function receiptPrinterServesStation(
  printer: ReceiptBindDevice,
  opts: {
    stationDeviceId?: string | null;
    role?: ReceiptBindRole | null;
    devices?: ReceiptBindDevice[];
    table?: TableRef;
    tables?: TableRef[];
    tableId?: string | null;
    sections?: SectionRef[];
    orderType?: string | null;
  },
): boolean {
  if (!isReceiptPrinterRow(printer)) return false;
  const devices = opts.devices ?? [];
  const row = opts.stationDeviceId ? devices.find((d) => d.id === opts.stationDeviceId) : undefined;
  const role =
    opts.role ??
    (row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : "order");
  if (role === "ods" || role === "kiosk") return false;
  const resolved = resolveReceiptPrinterForCheck({
    devices,
    stationDeviceId: opts.stationDeviceId,
    table: opts.table,
    tables: opts.tables,
    tableId: opts.tableId,
    sections: opts.sections,
    orderType: opts.orderType,
  });
  if (resolved?.id === printer.id) return true;
  if (row?.receiptPrinterId === printer.id) return true;
  const bound = printer.print?.boundStationIds ?? [];
  if (opts.stationDeviceId && bound.includes(opts.stationDeviceId)) return true;
  return false;
}

function kickIdsForPrinter(printer: ReceiptBindDevice): string[] {
  const kick = printer.print?.kickStationIds;
  if (Array.isArray(kick)) return kick;
  return printer.print?.boundStationIds ?? [];
}

/** Drawer kick / cash / Print check / No sale — terminals on the kick list. */
export function receiptPrinterKicksForStation(
  printer: ReceiptBindDevice,
  opts: {
    stationDeviceId?: string | null;
    role?: ReceiptBindRole | null;
    devices?: ReceiptBindDevice[];
  },
): boolean {
  if (!isReceiptPrinterRow(printer)) return false;
  const devices = opts.devices ?? [];
  const row = opts.stationDeviceId ? devices.find((d) => d.id === opts.stationDeviceId) : undefined;
  const role =
    opts.role ??
    (row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : "order");
  if (role === "ods" || role === "kiosk") return false;
  if (row && parseClass(row) !== "terminal") return false;
  const ids = kickIdsForPrinter(printer);
  if (opts.stationDeviceId && ids.includes(opts.stationDeviceId)) return true;
  return false;
}

function parseClass(row: ReceiptBindDevice): "handheld" | "terminal" {
  if (row.stationClass === "terminal" || row.stationClass === "handheld") return row.stationClass;
  const fn = row.assignment?.function;
  if (row.type === "host_stand" || fn === "host_stand" || fn === "cashier") return "terminal";
  return "handheld";
}

export function resolveReceiptKickPrinter(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): ReceiptBindDevice | undefined {
  const list = devices ?? [];
  const receipts = list.filter(isReceiptPrinterRow);
  const resolvedRole =
    role ??
    (() => {
      const row = stationDeviceId ? list.find((d) => d.id === stationDeviceId) : undefined;
      return row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : undefined;
    })();
  return receipts.find((d) =>
    receiptPrinterKicksForStation(d, {
      stationDeviceId,
      role: resolvedRole,
      devices: list,
    }),
  );
}

export function stationMayPrintReceipt(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): boolean {
  return Boolean(resolveReceiptPrinter(devices, stationDeviceId, role));
}

export function stationMayKickDrawer(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): boolean {
  return Boolean(resolveReceiptKickPrinter(devices, stationDeviceId, role));
}

/** Terminals on a receipt printer kick list — cash, Print check, No sale. */
export function payStationDevices(devices: ReceiptBindDevice[] | undefined): ReceiptBindDevice[] {
  const list = devices ?? [];
  return list.filter((d) => {
    if (isPrinterType(d.type)) return false;
    if (d.status === "inactive") return false;
    const role = roleFromFunction(d.assignment?.function);
    if (role === "ods" || role === "kiosk") return false;
    return Boolean(resolveReceiptKickPrinter(list, d.id, role));
  });
}

export function payAtCopy(devices: ReceiptBindDevice[] | undefined): string {
  return cashAtCopy(devices);
}

export function cashAtCopy(devices: ReceiptBindDevice[] | undefined): string {
  const names = payStationDevices(devices)
    .map((d) => String(d.label ?? "").trim())
    .filter(Boolean);
  if (!names.length) return CASH_AT_FALLBACK;
  if (names.length === 1) return `Cash at ${names[0]}.`;
  if (names.length === 2) return `Cash at ${names[0]} or ${names[1]}.`;
  return `Cash at ${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}.`;
}

export function resolveReceiptPrinter(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
  check?: {
    table?: TableRef;
    tables?: TableRef[];
    tableId?: string | null;
    sections?: SectionRef[];
    orderType?: string | null;
  },
): ReceiptBindDevice | undefined {
  const list = devices ?? [];
  const row = stationDeviceId ? list.find((d) => d.id === stationDeviceId) : undefined;
  const resolvedRole =
    role ??
    (row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : undefined);
  if (resolvedRole === "ods" || resolvedRole === "kiosk") return undefined;
  const byMap = resolveReceiptPrinterForCheck({
    devices: list,
    stationDeviceId,
    table: check?.table,
    tables: check?.tables,
    tableId: check?.tableId,
    sections: check?.sections,
    orderType: check?.orderType,
  });
  if (byMap) return byMap as ReceiptBindDevice;
  return undefined;
}

export function stationHasBoundReceiptPrinter(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
  check?: {
    table?: TableRef;
    tables?: TableRef[];
    tableId?: string | null;
    sections?: SectionRef[];
    orderType?: string | null;
  },
): boolean {
  return Boolean(resolveReceiptPrinter(devices, stationDeviceId, role, check));
}
