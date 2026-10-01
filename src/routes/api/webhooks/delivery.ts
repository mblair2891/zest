import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.json().catch(() => null);
        if (!payload || typeof payload !== "object") {
          return new Response("invalid json", { status: 400 });
        }
        const url = new URL(request.url);
        const { applyDeliveryWebhook } = await import("@/lib/delivery/apply.server");
        const result = await applyDeliveryWebhook(payload, url.searchParams.get("locationId") ?? undefined);
        return Response.json({ received: true, ...result, finixCalled: false });
      },
    },
  },
});
