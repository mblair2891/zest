/**
 * Assigned systems on one station: card reader, receipt printer, order printer.
 * A notice is only for a registered system that is not responding.
 * A printer with a LAN host stays quiet until its probe finishes.
 */
import { isPrintLanHost } from "../print/lan-hosts.ts";
import { parseLanTarget } from "../print/printer-models.ts";
import { normalizePaxSerial } from "../payments/pax-d135.ts";

export type StationSystemKind = "card_reader" | "receipt_printer" | "order_printer";

export type StationHealthDevice = {
  id: string;
  label?: string;
  type: string;
  status?: string;
  cardReaderId?: string | null;
  receiptPrinterId?: string | null;
  orderPrinterIds?: string[] | null;
  print?: {
    ip?: string | null;
    port?: number | null;
    target?: string | null;
    link?: string | null;
    usbAttached?: boolean | null;
    boundStationIds?: string[] | null;
    sectionIds?: string[] | null;
    venueDefault?: boolean | null;
    serveNoSection?: boolean | null;
  } | null;
};

export type StationHealthReader = { serial: string; name: string };

export type PrinterProbeState = "pending" | "up" | "down";

export type StationAssignment = {
  kind: StationSystemKind;
  id: string;
  label: string;
  /** Set when the printer has a house LAN host. Absent while the probe has not finished means quiet. */
  host: string | null;
  port: number;
  usb?: boolean;
  usbAttached?: boolean | null;
};

function isReceiptType(type: string): boolean {
  return type === "receipt_printer" || type === "printer";
}

function isOrderType(type: string): boolean {
  return (
    type === "order_printer" ||
    type === "kitchen_printer" ||
    type === "bar_printer" ||
    type === "label_printer"
  );
}

function boundTo(device: StationHealthDevice, stationId: string): boolean {
  return (device.print?.boundStationIds ?? []).some((id) => id === stationId);
}

function printerHost(device: StationHealthDevice): { host: string; port: number } | null {
  const parsed = parseLanTarget(device.print?.ip, device.print?.port, device.print?.target);
  if (!parsed || !isPrintLanHost(parsed.host)) return null;
  return { host: parsed.host, port: parsed.port };
}

function toAssignment(
  device: StationHealthDevice,
  kind: "receipt_printer" | "order_printer",
): StationAssignment {
  const usb = device.print?.link === "usb";
  const host = usb ? null : printerHost(device);
  return {
    kind,
    id: device.id,
    label: device.label?.trim() || (kind === "receipt_printer" ? "Receipt printer" : "Order printer"),
    host: host?.host ?? null,
    port: host?.port ?? 0,
    usb,
    usbAttached: usb ? device.print?.usbAttached : undefined,
  };
}

/**
 * Systems registered to this station.
 * A venue printer with no station binding is not included.
 */
export function assignedStationSystems(input: {
  stationId: string;
  devices: StationHealthDevice[];
  readers: StationHealthReader[];
}): StationAssignment[] {
  const stationId = input.stationId.trim();
  if (!stationId) return [];
  const station = input.devices.find((d) => d.id === stationId);
  const out: StationAssignment[] = [];
  const seen = new Set<string>();

  const serial = normalizePaxSerial(String(station?.cardReaderId ?? ""));
  const reader = serial
    ? input.readers.find((r) => normalizePaxSerial(r.serial) === serial)
    : undefined;
  if (reader) {
    out.push({
      kind: "card_reader",
      id: reader.serial,
      label: reader.name || reader.serial,
      host: null,
      port: 0,
    });
  }

  const pushPrinter = (device: StationHealthDevice, kind: "receipt_printer" | "order_printer") => {
    if (seen.has(`${kind}:${device.id}`)) return;
    seen.add(`${kind}:${device.id}`);
    out.push(toAssignment(device, kind));
  };

  if (station?.receiptPrinterId) {
    const printer = input.devices.find((d) => d.id === station.receiptPrinterId);
    if (printer && isReceiptType(printer.type)) pushPrinter(printer, "receipt_printer");
  }
  for (const device of input.devices) {
    const chosen =
      isOrderType(device.type) &&
      Array.isArray(station?.orderPrinterIds) &&
      station.orderPrinterIds.includes(device.id);
    if (!chosen && !boundTo(device, stationId)) continue;
    if (isReceiptType(device.type)) pushPrinter(device, "receipt_printer");
    if (isOrderType(device.type)) pushPrinter(device, "order_printer");
  }
  return out;
}

function printerResponding(
  system: StationAssignment,
  probe: Record<string, PrinterProbeState | undefined>,
): boolean {
  if (system.usb) {
    if (probe[system.id] === "up") return true;
    if (probe[system.id] === "down" || system.usbAttached === false) return false;
    return true;
  }
  if (!system.host) return false;
  return probe[system.id] !== "down";
}

/** Notices for registered systems that are not responding. Pending printer probes stay quiet. */
export function stationHealthNotices(input: {
  systems: StationAssignment[];
  connectedSerial: string | null;
  probe?: Record<string, PrinterProbeState | undefined>;
}): { id: string; kind: StationSystemKind; text: string }[] {
  const probe = input.probe ?? {};
  const connected = normalizePaxSerial(String(input.connectedSerial ?? ""));
  const notices: { id: string; kind: StationSystemKind; text: string }[] = [];
  for (const system of input.systems) {
    if (system.kind === "card_reader") {
      if (connected && normalizePaxSerial(system.id) === connected) continue;
      notices.push({
        id: system.id,
        kind: system.kind,
        text: `${system.label} is not connected.`,
      });
      continue;
    }
    if (printerResponding(system, probe)) continue;
    notices.push({
      id: system.id,
      kind: system.kind,
      text: system.usb ? "USB printer not connected" : `${system.label} is not responding.`,
    });
  }
  return notices;
}

/**
 * Receipt and order printers a PIN login should ping.
 * Station receipt, station order list, and station binds, plus receipt and
 * order printers assigned to this venue's sections.
 * An order printer with no station bind and no section stays out.
 */
export function loginConnectionPrinters(input: {
  stationId: string;
  devices: StationHealthDevice[];
  sectionIds?: string[];
}): StationAssignment[] {
  const stationId = input.stationId.trim();
  if (!stationId) return [];
  const station = input.devices.find((d) => d.id === stationId);
  const sections = new Set((input.sectionIds ?? []).map((id) => id.trim()).filter(Boolean));
  const out: StationAssignment[] = [];
  const seen = new Set<string>();

  const push = (device: StationHealthDevice) => {
    if (device.status === "inactive") return;
    if (seen.has(device.id)) return;
    const kind = isReceiptType(device.type)
      ? "receipt_printer"
      : isOrderType(device.type)
        ? "order_printer"
        : null;
    if (!kind) return;
    seen.add(device.id);
    out.push(toAssignment(device, kind));
  };

  if (station?.receiptPrinterId) {
    const printer = input.devices.find((d) => d.id === station.receiptPrinterId);
    if (printer) push(printer);
  }
  for (const device of input.devices) {
    const chosen =
      isOrderType(device.type) &&
      Array.isArray(station?.orderPrinterIds) &&
      station.orderPrinterIds.includes(device.id);
    if (!chosen && !boundTo(device, stationId)) continue;
    push(device);
  }
  for (const device of input.devices) {
    const ids = device.print?.sectionIds ?? [];
    const inSection = ids.some((id) => sections.has(id));
    const venue = device.print?.venueDefault === true || device.print?.serveNoSection === true;
    if (!inSection && !venue) continue;
    push(device);
  }
  return out;
}

/** A new login keeps a down result visible until the fresh probe answers. */
export function seedLoginProbe(
  prev: Record<string, PrinterProbeState | undefined>,
  ids: string[],
): Record<string, PrinterProbeState | undefined> {
  let changed = false;
  const next = { ...prev };
  for (const id of ids) {
    if (!next[id]) {
      next[id] = "pending";
      changed = true;
    }
  }
  return changed ? next : prev;
}

export function applyLoginProbe(
  prev: Record<string, PrinterProbeState | undefined>,
  id: string,
  state: PrinterProbeState,
): Record<string, PrinterProbeState | undefined> {
  if (prev[id] === state) return prev;
  return { ...prev, [id]: state };
}

/** Where a login ping may open TCP 9100. Cloud dials are not a path. */
export type LanProbePath = "station_tcp" | "print_agent" | "online_station" | "unreachable";

export function lanProbePath(input: {
  native: boolean;
  agent: boolean;
  onlineStation: boolean;
}): LanProbePath {
  if (input.native) return "station_tcp";
  if (input.agent) return "print_agent";
  if (input.onlineStation) return "online_station";
  return "unreachable";
}

/**
 * Starts each probe and returns before any of them finish.
 * The caller updates the banner from onResult.
 */
export function scheduleConnectionProbes(input: {
  targets: { id: string }[];
  probe: (id: string) => Promise<boolean>;
  onResult: (id: string, ok: boolean) => void;
}): void {
  for (const target of input.targets) {
    void input.probe(target.id).then((ok) => input.onResult(target.id, ok));
  }
}
