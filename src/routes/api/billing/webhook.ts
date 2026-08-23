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

export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        const payload = await request.text();
        if (secret) {
          const header = request.headers.get("stripe-signature");
          if (!verifyStripeSignature(payload, header, secret)) {
            return new Response("invalid signature", { status: 400 });
          }
        }
        let event: {
          type?: string;
          data?: { object?: Record<string, unknown> };
        };
        try {
          event = JSON.parse(payload) as typeof event;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const obj = event.data?.object ?? {};
        const meta = (obj.metadata ?? {}) as Record<string, string>;
        const orgId =
          meta.orgId ||
          (typeof obj.client_reference_id === "string" ? obj.client_reference_id : "");
        if (!orgId) return Response.json({ received: true, ignored: true });

        const { applyStripeSubscription } = await import("@/lib/saas/billing.server");
        const type = event.type ?? "";
        if (
          type === "checkout.session.completed" ||
          type === "customer.subscription.updated" ||
          type === "customer.subscription.created"
        ) {
          const sub = (obj.subscription && typeof obj.subscription === "object"
            ? obj.subscription
            : obj) as Record<string, unknown>;
          await applyStripeSubscription({
            orgId,
            planId: meta.planId,
            status: String(sub.status ?? obj.status ?? "active"),
            customerId: typeof obj.customer === "string" ? obj.customer : undefined,
            subscriptionId:
              typeof obj.subscription === "string"
                ? obj.subscription
                : typeof sub.id === "string"
                  ? sub.id
                  : undefined,
            periodEnd:
              typeof sub.current_period_end === "number"
                ? sub.current_period_end
                : undefined,
          });
        }
        if (type === "customer.subscription.deleted") {
          await applyStripeSubscription({
            orgId,
            planId: meta.planId,
            status: "canceled",
            customerId: typeof obj.customer === "string" ? obj.customer : undefined,
          });
        }
        return Response.json({ received: true });
      },
    },
  },
});
