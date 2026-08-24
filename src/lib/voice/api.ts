import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const logVoiceCommandFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    locationId: string;
    operatorId?: string | null;
    transcript: string;
    intent: string;
    ok: boolean;
    detail?: string;
  }) => ({
    locationId: loc(d.locationId),
    operatorId: d.operatorId ? String(d.operatorId).trim().slice(0, 80) : null,
    transcript: String(d.transcript ?? "").trim().slice(0, 400),
    intent: String(d.intent ?? "unknown").slice(0, 40),
    ok: Boolean(d.ok),
    detail: String(d.detail ?? "").slice(0, 240),
  }))
  .handler(async ({ context, data }) => {
    if (/payout|permission matrix|platform admin|host cut/i.test(data.transcript)) {
      return { ok: false as const, deny: true as const, message: "Voice cannot change host money or permissions" };
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = `vc_${Math.random().toString(36).slice(2, 12)}`;
    await sql`
      insert into voice_commands (
        id, location_id, operator_id, user_id, transcript, intent, ok, detail
      )
      values (
        ${id}, ${data.locationId}, ${data.operatorId ?? HOST_SCOPE}, ${context.userId},
        ${data.transcript}, ${data.intent}, ${data.ok}, ${data.detail}
      )
    `;
    return { ok: true as const, id };
  });
