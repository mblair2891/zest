import { createFileRoute } from "@tanstack/react-router";
import {
  PRINT_AGENT_WORKER,
  assertPrintAgentAccess,
  claimPrintJob,
  completePrintJob,
  countWaitingKitchenPrint,
} from "@/lib/print/queue.server";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: cors() });
}

export const Route = createFileRoute("/api/print/jobs")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const locationId = String(url.searchParams.get("locationId") ?? "").trim().slice(0, 80);
        const token = String(url.searchParams.get("token") ?? "").trim().slice(0, 120);
        if (!locationId) return json(400, { ok: false, error: "locationId required" });
        if (!(await assertPrintAgentAccess(locationId, token))) {
          return json(401, { ok: false, error: "Print agent token rejected" });
        }
        const waiting = await countWaitingKitchenPrint(locationId);
        return json(200, { ok: true, waiting });
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json(400, { ok: false, error: "Invalid JSON" });
        }
        const locationId = String(body.locationId ?? "").trim().slice(0, 80);
        const token = String(body.token ?? "").trim().slice(0, 120);
        const workerId =
          String(body.workerId ?? PRINT_AGENT_WORKER).trim().slice(0, 80) || PRINT_AGENT_WORKER;
        const action = String(body.action ?? "claim").trim();
        if (!locationId) return json(400, { ok: false, error: "locationId required" });
        if (!(await assertPrintAgentAccess(locationId, token))) {
          return json(401, { ok: false, error: "Print agent token rejected" });
        }
        if (action === "pending") {
          const waiting = await countWaitingKitchenPrint(locationId);
          return json(200, { ok: true, waiting });
        }
        if (action === "complete") {
          const jobId = String(body.jobId ?? "").trim().slice(0, 80);
          if (!jobId) return json(400, { ok: false, error: "jobId required" });
          await completePrintJob({
            locationId,
            workerId,
            jobId,
            ok: Boolean(body.ok),
          });
          return json(200, { ok: true });
        }
        const job = await claimPrintJob({
          locationId,
          workerId,
          role: PRINT_AGENT_WORKER,
        });
        return json(200, { ok: true, job });
      },
    },
  },
});
