import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { ensureAdminExists } from "@/lib/auth/platform-admin";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";

function parsePasswordUpdated(s: Record<string, unknown>): boolean {
  return s.passwordUpdated === true || s.passwordUpdated === "1" || s.passwordUpdated === "true";
}

export const Route = createFileRoute("/login")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string; passwordUpdated?: boolean } => {
    const next =
      typeof s.next === "string" ? sanitizeNextPath(s.next) ?? undefined : undefined;
    const passwordUpdated = parsePasswordUpdated(s);
    return {
      ...(next ? { next } : {}),
      ...(passwordUpdated ? { passwordUpdated: true } : {}),
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const [prepError, setPrepError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(
    () => Boolean(search.passwordUpdated),
  );

  useEffect(() => {
    try {
      if (sessionStorage.getItem("summex-password-updated") === "1") {
        sessionStorage.removeItem("summex-password-updated");
        setPasswordUpdated(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensureAdminExists()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPrepError(null);
        } else {
          setPrepError(res.error);
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPrepError("Database not ready");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthShell
      title="Sign in to Summex"
      subtitle="Use your username or email and password."
    >
      {passwordUpdated && (
        <p className="mb-4 text-center text-sm text-success" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}
      <AuthScreen
        mode="signin"
        disabled={!ready || Boolean(prepError)}
        prepError={prepError}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Floor staff use a 4-digit PIN on the station — not this page.
      </p>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </AuthShell>
  );
}
