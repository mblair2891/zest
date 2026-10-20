import { createFileRoute } from "@tanstack/react-router";
import {
  finixWebhookSecret,
  missingFinixKeyMessage,
  verifyFinixSignatures,
} from "@/lib/payments/finix-keys";

export const Route = createFileRoute("/api/payments/finix/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const {
          finixWebhookEventType,
          finixWebhookResultLabel,
          isFinixValidationPing,
          FINIX_VALIDATION_EVENT,
          FINIX_VALIDATION_RESULT,
        } = await import("@/lib/payments/finix-webhook-log");
        const { recordFinixWebhookAttempt } = await import("@/lib/payments/finix-webhook.server");
        // Empty validation ping: answer 200 before any secret or signature check.
        // A log failure must not turn this into an error Finix would treat as a bad URL.
        if (isFinixValidationPing(payload)) {
          try {
            await recordFinixWebhookAttempt({
              eventType: FINIX_VALIDATION_EVENT,
              result: FINIX_VALIDATION_RESULT,
            });
          } catch {
            /* creation still succeeds */
          }
          return new Response(null, { status: 200 });
        }
        const sandboxSecret = finixWebhookSecret("sandbox");
        const liveSecret = finixWebhookSecret("live");
        const header = request.headers.get("Finix-Signature");
        const log = (result: string) => {
          const parsed = finixWebhookEventType(payload);
          return recordFinixWebhookAttempt({
            eventType: parsed.eventType,
            result,
            eventId: parsed.eventId,
          });
        };
        if (!sandboxSecret && !liveSecret) {
          const result = missingFinixKeyMessage("FINIX_WEBHOOK_SECRET");
          await log(result);
          return new Response(result, { status: 503 });
        }
        const signed = verifyFinixSignatures(payload, header, [sandboxSecret, liveSecret]);
        if (!signed.ok) {
          console.warn(`finix webhook ${signed.reason}`);
          await log(signed.reason);
          return new Response(signed.reason, { status: 400 });
        }
        const parsed = finixWebhookEventType(payload);
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
