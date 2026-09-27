import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/square")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const header = request.headers.get("x-square-hmacsha256-signature");
        const { applySquareWebhook } = await import("@/lib/payments/square-terminal.server");
        const result = await applySquareWebhook(payload, header);
        if (!result.ok && result.error === "webhook not configured") {
          return new Response("webhook not configured", { status: 503 });
        }
        if (!result.ok && result.error === "invalid signature") {
          return new Response("invalid signature", { status: 400 });
        }
        if (!result.ok && result.error === "invalid json") {
          return new Response("invalid json", { status: 400 });
        }
        return Response.json({ received: true, ...result });
      },
    },
  },
});
