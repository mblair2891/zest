/** Ethernet (TCP 9100) or USB. The ticket bytes are the same either way. */
import { parseLanTarget } from "./printer-models.ts";

export const USB_PRINT_HOST = "usb";
export const USB_STATUS_LABEL = "USB";
export const USB_NOT_CONNECTED_LABEL = "USB printer not connected";
/** Impact kitchen printer. Stays on Ethernet. */
export const STAR_KITCHEN_MODEL = "star_sp700";

export type PrinterLinkValue = "ethernet" | "wifi" | "usb";
export type PrintTransport = "lan" | "usb";

export function printerEthernetOnly(modelPreset: string | null | undefined): boolean {
  return modelPreset === STAR_KITCHEN_MODEL;
}

export function normalizePrinterLink(
  link: string | null | undefined,
  modelPreset?: string | null,
): PrinterLinkValue {
  if (printerEthernetOnly(modelPreset)) return "ethernet";
  if (link === "usb" || link === "wifi" || link === "ethernet") return link;
  return "ethernet";
}

/** Ethernet or USB. Wi-Fi stays only when that printer was already saved as Wi-Fi. */
export function printerLinkChoices(
  current: string | null | undefined,
  modelPreset?: string | null,
): PrinterLinkValue[] {
  if (printerEthernetOnly(modelPreset)) return ["ethernet"];
  const choices: PrinterLinkValue[] = ["ethernet", "usb"];
  if (current === "wifi") choices.splice(1, 0, "wifi");
  return choices;
}

export function printerIsUsb(
  link: string | null | undefined,
  modelPreset?: string | null,
): boolean {
  return normalizePrinterLink(link, modelPreset) === "usb";
}

export function usbStatusLabel(attached: boolean | null | undefined): string {
  return attached === false ? USB_NOT_CONNECTED_LABEL : USB_STATUS_LABEL;
}

export function isUsbPrintJob(job: { host?: string | null; transport?: string | null }): boolean {
  return job.transport === "usb" || String(job.host ?? "").trim() === USB_PRINT_HOST;
}

export type PrinterByteTarget = {
  transport: PrintTransport;
  host: string;
  port: number;
  target: string;
  stationIds: string[];
};

export function byteTargetForPrinter(cfg: {
  link?: string | null;
  modelPreset?: string | null;
  ip?: string | null;
  port?: number | null;
  target?: string | null;
  boundStationIds?: string[] | null;
} | null | undefined): PrinterByteTarget | null {
  if (!cfg) return null;
  const stationIds = (cfg.boundStationIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  if (printerIsUsb(cfg.link, cfg.modelPreset)) {
    return {
      transport: "usb",
      host: USB_PRINT_HOST,
      port: 0,
      target: USB_PRINT_HOST,
      stationIds,
    };
  }
  const lan = parseLanTarget(cfg.ip, cfg.port, cfg.target);
  if (!lan) return null;
  return {
    transport: "lan",
    host: lan.host,
    port: lan.port,
    target: lan.target,
    stationIds,
  };
}
