/** Venue receipt printer ↔ order/host station. Empty bound list = every order + host. */

export type ReceiptBindRole = "order" | "ods" | "host" | "kiosk";

export type ReceiptBindDevice = {
  id: string;
  type: string;
  status?: string;
  assignment?: { function?: string };
  receiptPrinterId?: string | null;
  print?: {
    station?: string;
    routes?: string[];
    boundStationIds?: string[];
  };
};

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
  },
): boolean {
  if (!isReceiptPrinterRow(printer)) return false;
  const devices = opts.devices ?? [];
  const row = opts.stationDeviceId ? devices.find((d) => d.id === opts.stationDeviceId) : undefined;
  const role =
    opts.role ??
    (row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : "order");
  if (role === "ods" || role === "kiosk") return false;
  const bound = printer.print?.boundStationIds ?? [];
  if (!bound.length) return true;
  if (opts.stationDeviceId && bound.includes(opts.stationDeviceId)) return true;
  return bound.some((id) => {
    const d = devices.find((x) => x.id === id);
    if (!d || isPrinterType(d.type)) return false;
    return roleFromFunction(d.assignment?.function) === role;
  });
}

export function resolveReceiptPrinter(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): ReceiptBindDevice | undefined {
  const list = devices ?? [];
  const receipts = list.filter(isReceiptPrinterRow);
  const row = stationDeviceId ? list.find((d) => d.id === stationDeviceId) : undefined;
  const resolvedRole =
    role ??
    (row && !isPrinterType(row.type) ? roleFromFunction(row.assignment?.function) : undefined);
  const mappedId = row?.receiptPrinterId;
  if (mappedId) {
    const mapped = receipts.find((d) => d.id === mappedId);
    if (mapped) return mapped;
  }
  return receipts.find((d) =>
    receiptPrinterServesStation(d, {
      stationDeviceId,
      role: resolvedRole,
      devices: list,
    }),
  );
}

export function stationHasBoundReceiptPrinter(
  devices: ReceiptBindDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): boolean {
  return Boolean(resolveReceiptPrinter(devices, stationDeviceId, role));
}
