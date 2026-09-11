import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionContextFn, listMyProspectsFn, setActiveContextFn } from "@/lib/saas/api";
import type { SessionContext } from "@/lib/saas/types";
import { LocationPicker } from "@/components/saas/LocationPicker";
import { PlatformApp } from "@/components/pos/PlatformApp";
import { prospectResumePath } from "@/lib/saas/prospect-resume";
import { navigateToSanitizedPath } from "@/lib/auth/post-login-navigate";
import { SessionGate } from "@/components/pos/SessionGate";
import {
  parsePlatformSurface,
  type PlatformSurface,
} from "@/components/platform/surfaces";
import { leftoverMarketingPlatformHref } from "@/lib/platform/hosts";
import { PlatformTenantVenue } from "@/components/platform/PlatformTenantVenue";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: () => {
    const href = leftoverMarketingPlatformHref();
    if (href) throw redirect({ href });
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { passwordUpdated?: boolean; surface?: PlatformSurface } => {
    const surface = parsePlatformSurface(s.surface) ?? undefined;
    const passwordUpdated =
      s.passwordUpdated === true ||
      s.passwordUpdated === "1" ||
      s.passwordUpdated === "true";
    return {
      ...(passwordUpdated ? { passwordUpdated: true as const } : {}),
      ...(surface ? { surface } : {}),
    };
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <SessionGate>
      <DashboardInner />
    </SessionGate>
  );
}

function DashboardInner() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [session, setSession] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const load = () => {
    void getSessionContextFn()
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  useEffect(() => {
    if (!session) return;
    if (session.locations.length === 1 && !session.active?.locationId) {
      const loc = session.locations[0]!;
      void setActiveContextFn({
        data: { orgId: loc.orgId, locationId: loc.id },
      }).then(() => load());
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (session.isPlatformAdmin) return;
    if (
      session.setupToken &&
      (session.setupStatus === "contracted" || session.setupStatus === "onboarding")
    ) {
      void navigate({ to: "/setup/$token", params: { token: session.setupToken } });
      return;
    }
    if (session.locations.length > 0) return;
    if (session.setupToken) {
      void navigate({ to: "/setup/$token", params: { token: session.setupToken } });
      return;
    }
    void listMyProspectsFn()
      .then((rows) =>
        navigateToSanitizedPath(
          navigate,
          prospectResumePath(rows) || "/get-pricing",
        ),
      )
      .catch(() => navigate({ to: "/get-pricing" }));
  }, [session, navigate]);

  if (isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 text-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  if (!session.isPlatformAdmin) {
    const loc =
      session.locations.find((l) => l.id === session.active?.locationId) ??
      session.locations[0];
    if (!loc) {
      return (
        <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
          Opening your venue…
        </div>
      );
    }
    return (
      <>
        {passwordUpdated && (
          <div
            className="border-b border-success/30 bg-success/10 px-4 py-2 text-center text-sm text-success"
            role="status"
          >
            Password updated. You are signed in.
          </div>
        )}
        <PlatformTenantVenue orgId={loc.orgId} locId={loc.id} audience="owner" />
      </>
    );
  }

  const needsPick =
    session.locations.length > 1 &&
    (!session.active?.locationId ||
      !session.locations.some((l) => l.id === session.active?.locationId));

  if (needsPick) {
    return (
      <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)]">
        <LocationPicker session={session} onChosen={() => load()} />
      </div>
    );
  }

  return (
    <>
      {passwordUpdated && (
        <div
          className="border-b border-success/30 bg-success/10 px-4 py-2 text-center text-sm text-success"
          role="status"
        >
          Password updated. You are signed in.
        </div>
      )}
      <PlatformApp initialSurface={search.surface} />
    </>
  );
}
