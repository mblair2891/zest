import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { ensureAdminExists } from "@/lib/auth/platform-admin";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next =
      typeof s.next === "string" ? sanitizeNextPath(s.next) ?? undefined : undefined;
    return next ? { next } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const [prepError, setPrepError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
      <AuthScreen
        mode="signin"
        disabled={!ready || Boolean(prepError)}
        prepError={prepError}
      />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </AuthShell>
  );
}
