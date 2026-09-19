/**
 * Venue printer map: receipts and bar tickets follow floor sections;
 * food tickets follow menu groups. Stations fire; they do not own routing.
 */

import type { FloorSection, OrderType, Table } from "../pos/types";

export type ReceiptLane = "section" | "no_section" | "venue_default";

export type PrinterAssignmentDevice = {
  id: string;
  type: string;
  status?: string;
  receiptPrinterId?: string | null;
  stationClass?: string | null;
  assignment?: { function?: string };
  print?: {
    station?: string;
    routes?: string[];
    destinationName?: string;
    boundStationIds?: string[];
    kickStationIds?: string[];
    sectionIds?: string[];
    serveNoSection?: boolean;
    venueDefault?: boolean;
  };
};

export type TableRef = Pick<Table, "id" | "section" | "sectionId"> | null | undefined;
export type SectionRef = Pick<FloorSection, "id" | "name">;

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

export function isReceiptAssignmentRow(d: PrinterAssignmentDevice): boolean {
  if (d.status === "inactive") return false;
  if (!isPrinterType(d.type)) return false;
  if (RECEIPT_TYPES.has(d.type)) return true;
  return d.print?.station === "receipt" || Boolean(d.print?.routes?.includes("receipts"));
}

function destName(raw: string | null | undefined): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function isBarOrderPrinter(d: PrinterAssignmentDevice): boolean {
  if (d.status === "inactive") return false;
  if (isReceiptAssignmentRow(d)) return false;
  const order =
    d.type === "order_printer" ||
    d.type === "bar_printer" ||
    d.type === "kitchen_printer" ||
    d.type === "label_printer" ||
    Boolean(d.print?.station);
  if (!order) return false;
  const dest = destName(d.print?.destinationName).toLowerCase();
  return (
    dest === "bar" ||
    d.print?.station === "bar" ||
    Boolean(d.print?.routes?.includes("bar_tickets")) ||
    d.type === "bar_printer"
  );
}

export function isFoodOrderPrinter(d: PrinterAssignmentDevice): boolean {
  if (d.status === "inactive") return false;
  if (isReceiptAssignmentRow(d)) return false;
  if (
    d.type !== "order_printer" &&
    d.type !== "kitchen_printer" &&
    d.type !== "label_printer"
  ) {
    return false;
  }
  return !isBarOrderPrinter(d);
}

export function receiptLaneForOrder(opts: {
  orderType?: string | null;
  table?: TableRef;
}): ReceiptLane {
  const t = String(opts.orderType ?? "");
  if (t === "takeout" || t === "delivery" || t === "online" || t === "kiosk") {
    return "venue_default";
  }
  if (!opts.table) {
    if (t === "bar_tab" || t === "dine_in") return "no_section";
    return "venue_default";
  }
  return "section";
}

export function sectionIdForTable(
  table: TableRef,
  sections: SectionRef[] | undefined,
): string | null {
  if (!table) return null;
  const sid = String(table.sectionId ?? "").trim();
  if (sid) return sid;
  const name = String(table.section ?? "").trim();
  if (!name) return null;
  const hit = (sections ?? []).find((s) => s.id === name || s.name === name);
  return hit?.id ?? null;
}

export function printerSectionIds(d: PrinterAssignmentDevice): string[] | undefined {
  return d.print?.sectionIds;
}

export function printerServesSection(
  d: PrinterAssignmentDevice,
  sectionId: string | null,
): boolean {
  if (!sectionId) return d.print?.serveNoSection === true;
  const ids = printerSectionIds(d);
  return Array.isArray(ids) && ids.includes(sectionId);
}

function sole<T>(list: T[]): T | undefined {
  return list.length === 1 ? list[0] : undefined;
}

function stationFallbackReceipt(
  receipts: PrinterAssignmentDevice[],
  devices: PrinterAssignmentDevice[],
  stationDeviceId?: string | null,
): PrinterAssignmentDevice | undefined {
  if (!stationDeviceId) return undefined;
  const row = devices.find((d) => d.id === stationDeviceId);
  const mappedId = row?.receiptPrinterId?.trim();
  if (mappedId) {
    const mapped = receipts.find((d) => d.id === mappedId);
    if (mapped) return mapped;
  }
  return receipts.find((d) => (d.print?.boundStationIds ?? []).includes(stationDeviceId));
}

/**
 * Receipt printer for a guest check / paid receipt.
 * Section map wins. Station bind is fallback when the section has none.
 */
export function resolveReceiptPrinterForCheck(opts: {
  devices: PrinterAssignmentDevice[] | undefined;
  stationDeviceId?: string | null;
  table?: TableRef;
  tables?: TableRef[];
  tableId?: string | null;
  sections?: SectionRef[];
  orderType?: OrderType | string | null;
}): PrinterAssignmentDevice | undefined {
  const list = opts.devices ?? [];
  const receipts = list.filter(isReceiptAssignmentRow);
  if (!receipts.length) return undefined;
  const table =
    opts.table ??
    (opts.tableId ? (opts.tables ?? []).find((t) => t?.id === opts.tableId) : undefined);
  const lane = receiptLaneForOrder({ orderType: opts.orderType, table });
  const sectionId = lane === "section" ? sectionIdForTable(table, opts.sections) : null;

  if (lane === "section" && sectionId) {
    const bySection = receipts.find((d) => printerServesSection(d, sectionId));
    if (bySection) return bySection;
    const fallback = stationFallbackReceipt(receipts, list, opts.stationDeviceId);
    if (fallback) return fallback;
    return sole(receipts);
  }

  if (lane === "no_section") {
    const byLane = receipts.find((d) => d.print?.serveNoSection === true);
    if (byLane) return byLane;
    const fallback = stationFallbackReceipt(receipts, list, opts.stationDeviceId);
    if (fallback) return fallback;
    return sole(receipts);
  }

  const venue = receipts.find((d) => d.print?.venueDefault === true);
  if (venue) return venue;
  const fallback = stationFallbackReceipt(receipts, list, opts.stationDeviceId);
  if (fallback) return fallback;
  return sole(receipts);
}

/**
 * Bar order printer for a drink fire. Not assigned by menu group.
 * One bar printer maps every section.
 */
export function resolveBarPrinterForCheck(opts: {
  devices: PrinterAssignmentDevice[] | undefined;
  table?: TableRef;
  tables?: TableRef[];
  tableId?: string | null;
  sections?: SectionRef[];
  orderType?: OrderType | string | null;
}): PrinterAssignmentDevice | undefined {
  const bars = (opts.devices ?? []).filter(isBarOrderPrinter);
  if (!bars.length) return undefined;
  const only = sole(bars);
  if (only) return only;
  const table =
    opts.table ??
    (opts.tableId ? (opts.tables ?? []).find((t) => t?.id === opts.tableId) : undefined);
  const lane = receiptLaneForOrder({ orderType: opts.orderType, table });
  const sectionId = lane === "section" ? sectionIdForTable(table, opts.sections) : null;
  if (lane === "section" && sectionId) {
    const hit = bars.find((d) => printerServesSection(d, sectionId));
    if (hit) return hit;
  }
  if (lane === "no_section" || !table) {
    const hit = bars.find((d) => d.print?.serveNoSection === true);
    if (hit) return hit;
  }
  return bars[0];
}

export function venueHasReceiptPrinter(devices: PrinterAssignmentDevice[] | undefined): boolean {
  return (devices ?? []).some(isReceiptAssignmentRow);
}

/**
 * Default single-line venue: one receipt printer covers every section + to-go + bar tabs;
 * one bar printer covers every section. Does not overwrite an explicit empty list.
 */
export function seedDefaultPrinterAssignments<T extends PrinterAssignmentDevice>(
  devices: T[],
  sections: SectionRef[] | undefined,
): T[] {
  const sectionIds = (sections ?? []).map((s) => s.id).filter(Boolean);
  const receipts = devices.filter(isReceiptAssignmentRow);
  const bars = devices.filter(isBarOrderPrinter);
  return devices.map((d) => {
    if (!d.print) return d;
    if (receipts.length === 1 && receipts[0]!.id === d.id && d.print.sectionIds === undefined) {
      return {
        ...d,
        print: {
          ...d.print,
          sectionIds: [...sectionIds],
          venueDefault: d.print.venueDefault ?? true,
          serveNoSection: d.print.serveNoSection ?? true,
        },
      };
    }
    if (bars.length === 1 && bars[0]!.id === d.id && d.print.sectionIds === undefined) {
      return {
        ...d,
        print: {
          ...d.print,
          sectionIds: [...sectionIds],
          serveNoSection: d.print.serveNoSection ?? true,
        },
      };
    }
    return d;
  });
}

/** A new floor section inherits the sole receipt / bar printer. */
export function assignNewSectionToSolePrinters<T extends PrinterAssignmentDevice>(
  devices: T[],
  sectionId: string,
): T[] {
  if (!sectionId) return devices;
  const receipts = devices.filter(isReceiptAssignmentRow);
  const bars = devices.filter(isBarOrderPrinter);
  return devices.map((d) => {
    if (!d.print) return d;
    const soleReceipt = receipts.length === 1 && receipts[0]!.id === d.id;
    const soleBar = bars.length === 1 && bars[0]!.id === d.id;
    if (!soleReceipt && !soleBar) return d;
    const ids = [...(d.print.sectionIds ?? [])];
    if (ids.includes(sectionId)) return d;
    return { ...d, print: { ...d.print, sectionIds: [...ids, sectionId] } };
  });
}

/**
 * Exclusive: a section has at most one receipt printer and one bar printer.
 * One printer may still cover many sections.
 */
export function setSectionPrinter<T extends PrinterAssignmentDevice>(
  devices: T[],
  sectionId: string,
  kind: "receipt" | "bar",
  printerId: string | null,
): T[] {
  if (!sectionId) return devices;
  const match = (d: T) => (kind === "receipt" ? isReceiptAssignmentRow(d) : isBarOrderPrinter(d));
  return devices.map((d) => {
    if (!match(d) || !d.print) return d;
    const ids = [...(d.print.sectionIds ?? [])].filter((id) => id !== sectionId);
    if (printerId && d.id === printerId) ids.push(sectionId);
    return { ...d, print: { ...d.print, sectionIds: ids } };
  });
}

export function receiptPrinterForSection<T extends PrinterAssignmentDevice>(
  devices: T[],
  sectionId: string,
): T | undefined {
  return devices.find((d) => isReceiptAssignmentRow(d) && printerServesSection(d, sectionId));
}

export function barPrinterForSection<T extends PrinterAssignmentDevice>(
  devices: T[],
  sectionId: string,
): T | undefined {
  const bars = devices.filter(isBarOrderPrinter);
  if (bars.length === 1) return bars[0];
  return bars.find((d) => printerServesSection(d, sectionId));
}

export function parseSectionIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function parseOptionalFlag(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (raw === false) return false;
  return undefined;
}
