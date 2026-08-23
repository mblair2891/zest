import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getPlatformFlags } from "@/lib/auth/platform-admin";

function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
          Z
        </div>
        <p className="text-sm">Loading Zest…</p>
      </div>
    </div>
  );
}

/** Require a real signed-in user; force password change for platform admin. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mustChange, setMustChange] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setMustChange(null);
      return;
    }
    let cancelled = false;
    void getPlatformFlags()
      .then((f) => {
        if (!cancelled) setMustChange(f.mustChangePassword);
      })
      .catch(() => {
        if (!cancelled) setMustChange(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (isPending) return <Loading />;
  if (!user) return <RedirectToSignIn />;
  if (mustChange === null) return <Loading />;
  if (mustChange && pathname !== "/change-password") {
    return <Navigate to="/change-password" />;
  }
  return <>{children}</>;
}
