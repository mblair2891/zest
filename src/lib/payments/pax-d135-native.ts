/**
 * Capacitor bridge to the Finix PAX D135 Android SDK.
 * Scan and connect stay in the station app. This file does not use Web Bluetooth.
 */
import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import type { PaxBridge } from "./pax-d135";
import { PAX_MSG } from "./pax-d135";

export type PaxPluginStatus = {
  state:
    | "idle"
    | "scanning"
    | "connecting"
    | "processing"
    | "setting_up"
    | "connected"
    | "disconnected"
    | "error";
  message?: string;
  serial?: string;
  batteryPercent?: number | null;
};

type PaxPlugin = {
  scan: () => Promise<{
    ok: boolean;
    message?: string;
    devices?: { name: string; address: string }[];
  }>;
  connect: (input: {
    name: string;
    address: string;
    merchantId: string;
    deviceId: string;
    userId: string;
    password: string;
    mid: string;
    env: "SB" | "LIVE";
    link?: "bluetooth" | "network" | "usb";
  }) => Promise<PaxConnectResult>;
  usbStatus: () => Promise<{ attached?: boolean; ready?: boolean }>;
  capture: (input: { transferId: string; amountCents: number }) => Promise<{
    ok: boolean;
    message?: string;
    skipped?: boolean;
  }>;
  voidSale: (input: { transferId: string; amountCents: number }) => Promise<{
    ok: boolean;
    message?: string;
    skipped?: boolean;
  }>;
  sale: (input: {
    amountCents: number;
    checkId: string;
    tipCents: number;
    idempotencyId: string;
  }) => Promise<{
    ok: boolean;
    code?: string;
    transferId?: string;
    last4?: string | null;
    message?: string;
    idempotencyId?: string;
  }>;
  addListener: (
    event: "status",
    handler: (status: PaxPluginStatus) => void,
  ) => Promise<{ remove: () => void }>;
};

const PaxD135 = registerPlugin<PaxPlugin>("PaxD135");

export function paxReaderOnThisStation(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function androidPaxBridge(): PaxBridge {
  return {
    sale: (input) => PaxD135.sale(input),
    capture: (input) => PaxD135.capture(input),
    voidSale: (input) => PaxD135.voidSale(input),
  };
}

export const paxPlugin = PaxD135;

type PaxScanResult = {
  ok: boolean;
  message?: string;
  devices?: { name: string; address: string }[];
};

type PaxConnectInput = {
  name: string;
  address: string;
  merchantId: string;
  deviceId: string;
  userId: string;
  password: string;
  mid: string;
  env: "SB" | "LIVE";
  link?: "bluetooth" | "network" | "usb";
};

type PaxConnectResult = {
  ok: boolean;
  message?: string;
  batteryPercent?: number | null;
  merchantId?: string;
  deviceId?: string;
  usernamePrefix?: string;
  environment?: string;
  sdkMessage?: string;
  sdkCode?: string;
};

function scanHook(): (() => Promise<PaxScanResult>) | null {
  const hook = (globalThis as { __summexPaxScan?: unknown }).__summexPaxScan;
  return typeof hook === "function" ? (hook as () => Promise<PaxScanResult>) : null;
}

function connectHook(): ((input: PaxConnectInput) => Promise<PaxConnectResult>) | null {
  const hook = (globalThis as { __summexPaxConnect?: unknown }).__summexPaxConnect;
  return typeof hook === "function"
    ? (hook as (input: PaxConnectInput) => Promise<PaxConnectResult>)
    : null;
}

/**
 * Android asks the plugin. A browser with no station plugin does not report Bluetooth off.
 * `__summexPaxScan` is only a preview stand-in for a paired name. It does not take a card.
 */
export async function scanForPaxReaders(): Promise<PaxScanResult> {
  if (paxReaderOnThisStation()) return paxPlugin.scan();
  const hook = scanHook();
  if (hook) return hook();
  return { ok: false, message: PAX_MSG.notConnected, devices: [] };
}

export async function connectForPaxReader(input: PaxConnectInput): Promise<PaxConnectResult> {
  if (paxReaderOnThisStation()) return paxPlugin.connect(input);
  const hook = connectHook();
  if (hook) return hook(input);
  if (scanHook()) return { ok: true, batteryPercent: null };
  return { ok: false, message: PAX_MSG.notConnected };
}

function usbHook(): (() => Promise<boolean>) | null {
  const hook = (globalThis as { __summexPaxUsb?: unknown }).__summexPaxUsb;
  return typeof hook === "function" ? (hook as () => Promise<boolean>) : null;
}

/**
 * True when a USB card reader is plugged into this station.
 * A browser with no station plugin reports the cable as out.
 * The preview hook does not take a card.
 */
export async function usbReaderAttached(): Promise<boolean> {
  if (paxReaderOnThisStation()) {
    const status = await paxPlugin.usbStatus();
    return status.attached === true;
  }
  const hook = usbHook();
  if (hook) return hook();
  return false;
}
