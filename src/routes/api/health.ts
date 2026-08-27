import { createFileRoute } from "@tanstack/react-router";
import {
  getDatabaseUrl,
  getDbSource,
  getSql,
  isServerlessRuntime,
  PRODUCTION_DB_REQUIRED,
} from "@/lib/db";
import { configuredHosts } from "@/lib/platform/hosts";
import { isDemoOpenLocationsServer } from "@/lib/saas/flags";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
        const demo = process.env.DEV_DEMO === "1" || process.env.VITE_DEV_DEMO === "1";
        const warnings: string[] = [];
        if (demo) warnings.push("DEV_DEMO is on — production must use DEV_DEMO=0");
        if (isDemoOpenLocationsServer()) {
          warnings.push("DEMO_OPEN_LOCATIONS is on — production must use 0");
        }

        const base = {
          surface: "api" as const,
          host,
          hosts: configuredHosts(),
          demo,
          demoOpenLocations: isDemoOpenLocationsServer(),
          warnings,
        };

        if (isServerlessRuntime() && !getDatabaseUrl()) {
          return Response.json(
            {
              ok: false,
              db: "error",
              source: "unconfigured",
              pglite: false,
              detail: PRODUCTION_DB_REQUIRED,
              ...base,
            },
            { status: 503 },
          );
        }

        let db: "ok" | "error" = "ok";
        let detail: string | undefined;
        try {
          const sql = await getSql();
          await sql`select 1 as n`;
        } catch (err) {
          db = "error";
          detail = err instanceof Error ? err.message : "db failed";
        }
        const source = getDbSource();
        const body = {
          ok: db === "ok",
          db,
          source,
          pglite: source === "pglite",
          ...base,
          ...(detail ? { detail } : {}),
        };
        return Response.json(body, { status: db === "ok" ? 200 : 503 });
      },
    },
  },
});
