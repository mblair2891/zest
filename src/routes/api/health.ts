import { createFileRoute } from "@tanstack/react-router";
import { dbSource, getSql } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let db: "ok" | "error" = "ok";
        let detail: string | undefined;
        try {
          const sql = await getSql();
          await sql`select 1 as n`;
        } catch (err) {
          db = "error";
          detail = err instanceof Error ? err.message : "db failed";
        }
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
        return Response.json({
          ok: db === "ok",
          db,
          source: dbSource,
          surface: "api",
          host,
          hosts: {
            marketing: "summex.app",
            app: "app.summex.app",
            api: "api.summex.app",
            sites: "sites.summex.app",
          },
          demo: process.env.DEV_DEMO === "1" || process.env.VITE_DEV_DEMO === "1",
          ...(detail ? { detail } : {}),
        });
      },
    },
  },
});
