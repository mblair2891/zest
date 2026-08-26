import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import {
  getPlatformFlags,
  subscribeMustChangePasswordCleared,
  wasMustChangePasswordCleared,
} from "@/lib/auth/platform-admin";
import { SummexMark } from "@/components/brand/SummexMark";
import {
  networkLooksOffline,
  readLastSessionUser,
  saveLastSessionUser,
} from "@/lib/offline/last-session";

function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
      <div className="text-center">
        <SummexMark className="mx-auto mb-3 h-10 w-10" />
        <p className="text-sm">Loading Summex…</p>
      </div>
    </div>
  );
}

/** Require a real signed-in user; force password change for platform admin. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mustChange, setMustChange] = useState<boolean | null>(() =>
    wasMustChangePasswordCleared() ? false : null,
  );

  useEffect(() => {
    return subscribeMustChangePasswordCleared(() => setMustChange(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setMustChange(null);
      return;
    }
    if (wasMustChangePasswordCleared()) {
      setMustChange(false);
      return;
    }
    let cancelled = false;
    void getPlatformFlags()
      .then((f) => {
        if (cancelled) return;
        if (wasMustChangePasswordCleared()) {
          setMustChange(false);
          return;
        }
        setMustChange(f.mustChangePassword);
      })
      .catch(() => {
        if (!cancelled) setMustChange(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, pathname]);

  useEffect(() => {
    if (user) saveLastSessionUser(user);
  }, [user]);

  if (isPending) return <Loading />;
  if (!user) {
    const cached = networkLooksOffline() ? readLastSessionUser() : null;
    if (!cached) return <RedirectToSignIn to="/login" />;
    return <>{children}</>;
  }
  if (mustChange === null) return <Loading />;
  if (mustChange && pathname !== "/change-password" && !wasMustChangePasswordCleared()) {
    return <Navigate to="/change-password" />;
  }
  return <>{children}</>;
}
