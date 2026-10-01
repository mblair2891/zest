import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let payload: unknown = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          payload = null;
        }
        if (!payload || typeof payload !== "object") {
          return new Response("invalid json", { status: 400 });
        }
        const url = new URL(request.url);
        const { applyDeliveryWebhook } = await import("@/lib/delivery/apply.server");
        const result = await applyDeliveryWebhook(payload, url.searchParams.get("locationId") ?? undefined, {
          body: rawBody,
          signature: request.headers.get("x-summex-signature"),
        });
        if (result.error === "invalid signature") {
          return new Response("invalid signature", { status: 401 });
        }
        return Response.json({ received: true, ...result, finixCalled: false });
      },
    },
  },
});
