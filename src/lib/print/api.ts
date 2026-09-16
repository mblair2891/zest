import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { DEFAULT_PRINTER_PORT, parseLanTarget } from "./printer-models";

function writeTcp(host: string, port: number, buf: Buffer): Promise<void> {
  return import("node:net").then(
    (net) =>
      new Promise<void>((resolve, reject) => {
        const sock = net.connect({ host, port }, () => {
          sock.write(buf, (err) => {
            if (err) {
              sock.destroy();
              reject(err);
              return;
            }
            sock.end();
          });
        });
        sock.setTimeout(4000);
        sock.on("timeout", () => {
          sock.destroy();
          reject(new Error("Printer timed out"));
        });
        sock.on("error", reject);
        sock.on("close", () => resolve());
      }),
  );
}

/** Raw ESC/POS / Star Line bytes to IP:9100 from this host (LAN print agent alternative). */
export const rawLanPrintFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { target?: string; ip?: string; port?: number; escposBase64?: string }) => {
    const parsed = parseLanTarget(d.ip, d.port, d.target);
    const b64 = String(d.escposBase64 ?? "");
    if (!parsed) throw new Error("Static IP is required for test print");
    if (!b64) throw new Error("Print payload is empty");
    return {
      host: parsed.host,
      port: parsed.port || DEFAULT_PRINTER_PORT,
      escposBase64: b64.slice(0, 200_000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> => {
    try {
      const buf = Buffer.from(data.escposBase64, "base64");
      if (!buf.length) return { ok: false, error: "Print payload is empty" };
      await writeTcp(data.host, data.port, buf);
      return { ok: true, bytes: buf.length };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : `Could not reach ${data.host}:${data.port}`,
      };
    }
  });
