import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/quickbooks/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { finishOAuth, callbackHtml } = await import("@/lib/quickbooks/sync.server");
        const result = await finishOAuth({
          code: url.searchParams.get("code") ?? "",
          state: url.searchParams.get("state") ?? "",
          realmId: url.searchParams.get("realmId") ?? "",
          error: url.searchParams.get("error") ?? "",
        });
        return new Response(callbackHtml(result.message, result.ok), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
