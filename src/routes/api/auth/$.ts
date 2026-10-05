import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { resolveCredentialEmail } from "@/lib/auth/resolve-login.server";
import { withHostOnlySessionCookies } from "@/lib/auth/session-cookie";
import { clientKey, rateLimit } from "@/lib/saas/rate-limit.server";

function safeReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : "unknown";
  return msg.replace(/password["']?\s*[:=]\s*\S+/gi, "password=[redacted]").slice(0, 300);
}

/** Better Auth error JSON. Never includes the password. */
async function failureLog(response: Response): Promise<{
  status: number;
  code?: string;
  message?: string;
}> {
  const status = response.status;
  try {
    const text = await response.clone().text();
    const json = JSON.parse(text) as { code?: unknown; message?: unknown };
    const code = typeof json.code === "string" ? json.code : undefined;
    const message =
      typeof json.message === "string"
        ? json.message.replace(/password["']?\s*[:=]\s*\S+/gi, "password=[redacted]").slice(0, 300)
        : undefined;
    return { status, code, message };
  } catch {
    return { status };
  }
}

function authError(status: number, message: string, code: string): Response {
  return new Response(JSON.stringify({ message, code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Rewrite username → stored email before Better Auth's email check.
 * `Admin` and subscriber usernames both become the credential email.
 */
async function prepareAuthRequest(request: Request): Promise<Request | Response> {
  const path = new URL(request.url).pathname;
  if (request.method !== "POST" || !path.includes("/sign-in/email")) return request;

  const text = await request.text();
  let record: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return rebuild(request, text);
    }
    record = parsed as Record<string, unknown>;
  } catch {
    return rebuild(request, text);
  }

  const raw = typeof record.email === "string" ? record.email : "";
  const password = typeof record.password === "string" ? record.password : "";
  let email: string | null;
  try {
    email = await resolveCredentialEmail(raw);
  } catch (err) {
    console.error("[auth] sign-in lookup failed", safeReason(err));
    return authError(503, "Sign-in could not complete. Refresh and try again.", "AUTH_LOOKUP_FAILED");
  }
  if (!email) {
    console.error("[auth] sign-in rejected", { reason: "unknown_login" });
    return authError(401, "Invalid username or password", "INVALID_EMAIL_OR_PASSWORD");
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...record, email, password }),
  });
}

function rebuild(request: Request, text: string): Request {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, { method: request.method, headers, body: text });
}

async function handle({ request }: { request: Request }) {
  if (rateLimit(clientKey(request, "auth"), 40, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }
  try {
    const prepared = await prepareAuthRequest(request);
    if (prepared instanceof Response) return prepared;
    const response = await auth.handler(prepared);
    const fixed = withHostOnlySessionCookies(response);
    if (!fixed.ok && new URL(request.url).pathname.includes("/sign-in/")) {
      const reason = await failureLog(fixed);
      console.error("[auth] sign-in rejected", reason);
    }
    return fixed;
  } catch (err) {
    console.error("[auth] sign-in failed", safeReason(err));
    return authError(500, "Sign-in could not complete. Refresh and try again.", "AUTH_ERROR");
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle({ request }),
      POST: ({ request }) => handle({ request }),
    },
  },
});
