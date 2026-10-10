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
        const { finixWebhookEventType, finixWebhookResultLabel } = await import(
          "@/lib/payments/finix-webhook-log"
        );
        const { recordFinixWebhookAttempt } = await import("@/lib/payments/finix-webhook.server");
        const parsed = finixWebhookEventType(payload);
        const log = (result: string) =>
          recordFinixWebhookAttempt({
            eventType: parsed.eventType,
            result,
            eventId: parsed.eventId,
          });

        const sandboxSecret = finixWebhookSecret("sandbox");
        const liveSecret = finixWebhookSecret("live");
        if (!sandboxSecret && !liveSecret) {
          const result = missingFinixKeyMessage("FINIX_WEBHOOK_SECRET");
          await log(result);
          return new Response(result, { status: 503 });
        }
        const header =
          request.headers.get("x-finix-signature") ||
          request.headers.get("finix-signature") ||
          request.headers.get("x-signature");
        const signed =
          (sandboxSecret ? verifyFinixSignature(payload, header, sandboxSecret) : false) ||
          (liveSecret ? verifyFinixSignature(payload, header, liveSecret) : false);
        if (!signed) {
          await log("invalid signature");
          return new Response("invalid signature", { status: 400 });
        }
        if (!parsed.json || typeof parsed.json !== "object") {
          await log("invalid json");
          return new Response("invalid json", { status: 400 });
        }
        try {
          const { applyFinixWebhook } = await import("@/lib/payments/onboarding.server");
          const result = await applyFinixWebhook(
            parsed.json as {
              id?: string;
              type?: string;
              entity?: string;
              entity_id?: string;
              data?: { id?: string; onboarding_state?: string };
            },
          );
          await log(finixWebhookResultLabel(result));
          return Response.json({ received: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message.slice(0, 160) : "failed";
          await log(message || "failed");
          return new Response("failed", { status: 500 });
        }
      },
    },
  },
});
