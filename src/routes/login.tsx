import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate, type ErrorComponentProps } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { ensureAdminExists } from "@/lib/auth/platform-admin";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionContextFn } from "@/lib/saas/api";
import { navigateAfterPasswordSignIn } from "@/lib/auth/post-login-navigate";
import { leftoverMarketingPlatformHref } from "@/lib/platform/hosts";

function parsePasswordUpdated(s: Record<string, unknown>): boolean {
  return s.passwordUpdated === true || s.passwordUpdated === "1" || s.passwordUpdated === "true";
}

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: () => {
    const href = leftoverMarketingPlatformHref();
    if (href) throw redirect({ href });
  },
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
  // Client-only route: the server match stays pending and otherwise paints an
  // empty cream page. This fallback is that first paint.
  pendingComponent: LoginPending,
  errorComponent: LoginRouteError,
  component: LoginPage,
});

function LoginForm({
  notice,
  passwordUpdated,
  disabled,
  prepError,
}: {
  notice?: string | null;
  passwordUpdated?: boolean;
  disabled?: boolean;
  prepError?: string | null;
}) {
  return (
    <AuthShell title="Log in to Summex" brandSubline="powered by Quantum Reach">
      {passwordUpdated && (
        <p className="mb-4 text-center text-sm text-success" role="status">
          Password updated. Log in with your new password.
        </p>
      )}
      {notice ? (
        <p className="mb-4 text-center text-sm text-danger" role="alert">
          {notice}
        </p>
      ) : null}
      <AuthScreen
        mode="signin"
        disabled={disabled}
        prepError={prepError}
      />
    </AuthShell>
  );
}

function LoginPending() {
  return <LoginForm />;
}

function LoginRouteError({ error }: ErrorComponentProps) {
  useEffect(() => {
    console.error("[login] render failed", error);
  }, [error]);
  const message = error instanceof Error ? error.message : "Could not open sign-in.";
  return <LoginForm notice={message} />;
}

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending, error: sessionError } = useCurrentUserState();
  const [prepError, setPrepError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(
    () => Boolean(search.passwordUpdated),
  );
  const [leaving, setLeaving] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

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
      .catch((err) => {
        console.error("[login] could not prepare sign-in", err);
        if (cancelled) return;
        setPrepError(err instanceof Error ? err.message : "Database not ready");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionError) return;
    console.error("[login] session failed", sessionError);
  }, [sessionError]);

  useEffect(() => {
    if (isPending || !user || leaving || navError) return;
    setLeaving(true);
    void (async () => {
      try {
        const session = await getSessionContextFn();
        await navigateAfterPasswordSignIn(navigate, {
          mustChangePassword: false,
          nextRaw: search.next,
          session,
        });
      } catch (err) {
        console.error("[login] could not open the console", err);
        setNavError(err instanceof Error ? err.message : "Could not open the console.");
        setLeaving(false);
      }
    })();
  }, [user, isPending, leaving, navError, navigate, search.next]);

  if (user && !navError) {
    return (
      <AuthShell title="Log in to Summex" brandSubline="powered by Quantum Reach">
        <p className="text-center text-sm text-muted-foreground">Taking you in.</p>
      </AuthShell>
    );
  }

  return (
    <LoginForm
      notice={navError}
      passwordUpdated={passwordUpdated}
      disabled={!ready}
      prepError={prepError}
    />
  );
}
