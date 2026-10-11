import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/native-shell";
import { isPrintLanHost } from "./lan-hosts";

type RawPrintPlugin = {
  sendBytes: (opts: { host: string; port: number; payload: string }) => Promise<{ ok: boolean }>;
  probe: (opts: { host: string; port: number }) => Promise<{ ok: boolean }>;
};

const RawPrint = registerPlugin<RawPrintPlugin>("RawPrint");

/** Android shell only. Writes ESC/POS bytes to host:port. Never window.print. */
export async function sendNativeBytes(
  host: string,
  port: number,
  payloadBase64: string,
): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (!isPrintLanHost(host)) return false;
  const p = port > 0 && port < 65536 ? Math.round(port) : 9100;
  if (!payloadBase64) return false;
  try {
    const res = await RawPrint.sendBytes({ host, port: p, payload: payloadBase64 });
    return res?.ok === true;
  } catch {
    return false;
  }
}

/** Android shell only. Opens the printer port and closes it. Writes nothing. Null when this is not the station app. */
export async function probeNativePrinter(host: string, port: number): Promise<boolean | null> {
  if (!isNativeApp()) return null;
  if (!isPrintLanHost(host)) return false;
  const p = port > 0 && port < 65536 ? Math.round(port) : 9100;
  try {
    const res = await RawPrint.probe({ host, port: p });
    return res?.ok === true;
  } catch {
    return false;
  }
}
