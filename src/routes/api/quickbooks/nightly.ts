import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/quickbooks/nightly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.QBO_CRON_SECRET?.trim();
        if (!secret) {
          return Response.json({ ok: false, error: "QBO_CRON_SECRET is not set" }, { status: 503 });
        }
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!token || token !== secret) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const { syncAllAuto } = await import("@/lib/quickbooks/sync.server");
        const result = await syncAllAuto(Date.now());
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
