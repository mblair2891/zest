import { probeLanPrinterFn } from "./api";
import { probeNativePrinter } from "./capacitor-raw-print";
import { isPrintLanHost } from "./lan-hosts";

/** Station app uses the plugin. The browser asks this server. No bytes are sent. */
export async function probePrinter(host: string, port: number): Promise<boolean> {
  if (!isPrintLanHost(host)) return false;
  const native = await probeNativePrinter(host, port);
  if (native != null) return native;
  try {
    const res = await probeLanPrinterFn({ data: { host, port } });
    return res.ok === true;
  } catch {
    return false;
  }
}
