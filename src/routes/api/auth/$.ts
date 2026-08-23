import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { ensurePlatformAdmin } from "@/lib/auth/bootstrap-admin.server";

async function handle({ request }: { request: Request }) {
  await ensurePlatformAdmin();
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
