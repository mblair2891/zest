import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { clientKey, rateLimit } from "@/lib/saas/rate-limit.server";

async function handle({ request }: { request: Request }) {
  if (rateLimit(clientKey(request, "auth"), 40, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle({ request }),
      POST: ({ request }) => handle({ request }),
    },
  },
});
