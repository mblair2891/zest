/**
 * Capacitor bridge to the Finix PAX D135 Android SDK.
 * Scan and connect stay in the station app. This file does not use Web Bluetooth.
 */
import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import type { PaxBridge } from "./pax-d135";
import { PAX_SDK_ENV } from "./pax-d135";

export type PaxPluginStatus = {
  state: "idle" | "scanning" | "setting_up" | "connected" | "error";
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
    env: typeof PAX_SDK_ENV;
  }) => Promise<{ ok: boolean; message?: string; batteryPercent?: number | null }>;
  sale: (input: { amountCents: number; checkId: string; tipCents: number }) => Promise<{
    ok: boolean;
    code?: string;
    transferId?: string;
    last4?: string | null;
    message?: string;
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
  };
}

export const paxPlugin = PaxD135;
