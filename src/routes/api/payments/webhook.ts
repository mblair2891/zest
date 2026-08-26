import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=")];
    }),
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { quantumWebhookSecret } = await import("@/lib/payments/mode");
        const secret = quantumWebhookSecret();
        const payload = await request.text();
        if (secret) {
          const header = request.headers.get("stripe-signature");
          if (!verifyStripeSignature(payload, header, secret)) {
            return new Response("invalid signature", { status: 400 });
          }
        } else {
          return new Response("webhook not configured", { status: 503 });
        }
        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(payload) as typeof event;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const type = event.type ?? "";
        if (type === "payment_intent.succeeded") {
          const { applyLivePaymentIntent } = await import(
            "@/lib/payments/stripe-terminal.server"
          );
          await applyLivePaymentIntent(event.data?.object ?? {});
        }
        return Response.json({ received: true });
      },
    },
  },
});
