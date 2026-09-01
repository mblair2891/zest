import { createServerFn } from "@tanstack/react-start";

export const notifyOnCallFn = createServerFn({ method: "POST" })
  .validator((d: { locationId?: string; phones: string[]; body: string }) => ({
    locationId: String(d.locationId ?? "").slice(0, 80),
    phones: (Array.isArray(d.phones) ? d.phones : [])
      .map((p) => String(p ?? "").replace(/[^\d+]/g, "").slice(0, 20))
      .filter((p) => p.length >= 8)
      .slice(0, 12),
    body: String(d.body ?? "").slice(0, 480),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; sent: number; provider?: string }> => {
    if (!data.body || !data.phones.length) return { ok: true, sent: 0 };
    const { sendSms } = await import("@/lib/front/messaging.server");
    let sent = 0;
    let provider: string | undefined;
    for (const to of data.phones) {
      try {
        const r = await sendSms({
          to,
          body: data.body,
          kind: "approval",
          locationId: data.locationId || null,
        });
        provider = r.provider;
        sent += 1;
      } catch {
        /* one number failing should not block the rest */
      }
    }
    return { ok: true, sent, provider };
  });
