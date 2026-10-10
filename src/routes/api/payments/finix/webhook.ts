import { createFileRoute } from "@tanstack/react-router";
import {
  finixWebhookSecret,
  missingFinixKeyMessage,
  verifyFinixSignature,
} from "@/lib/payments/finix-keys";

export const Route = createFileRoute("/api/payments/finix/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const sandboxSecret = finixWebhookSecret("sandbox");
        const liveSecret = finixWebhookSecret("live");
        if (!sandboxSecret && !liveSecret) {
          return new Response(missingFinixKeyMessage("FINIX_WEBHOOK_SECRET"), { status: 503 });
        }
        const header =
          request.headers.get("x-finix-signature") ||
          request.headers.get("finix-signature") ||
          request.headers.get("x-signature");
        const signed =
          (sandboxSecret ? verifyFinixSignature(payload, header, sandboxSecret) : false) ||
          (liveSecret ? verifyFinixSignature(payload, header, liveSecret) : false);
        if (!signed) {
          return new Response("invalid signature", { status: 400 });
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
