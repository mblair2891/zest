import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const given = header.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(given, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/payments/finix/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { finixWebhookSecret, finixConfigured } = await import("@/lib/payments/finix");
        const payload = await request.text();
        const secret = finixWebhookSecret();
        if (secret) {
          const header =
            request.headers.get("x-finix-signature") ||
            request.headers.get("finix-signature") ||
            request.headers.get("x-signature");
          if (!verify(payload, header, secret)) {
            return new Response("invalid signature", { status: 400 });
          }
        } else if (finixConfigured()) {
          return new Response("webhook not configured", { status: 503 });
        }
        let event: {
          id?: string;
          type?: string;
          entity?: string;
          entity_id?: string;
          data?: { id?: string; onboarding_state?: string };
        };
        try {
          event = JSON.parse(payload) as typeof event;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const { applyFinixWebhook } = await import("@/lib/payments/onboarding.server");
        const result = await applyFinixWebhook(event);
        return Response.json({ received: true, ...result });
      },
    },
  },
});
