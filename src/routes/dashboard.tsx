import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionContextFn, listMyProspectsFn, setActiveContextFn } from "@/lib/saas/api";
import type { SessionContext } from "@/lib/saas/types";
import { LocationPicker } from "@/components/saas/LocationPicker";
import { PlatformApp } from "@/components/pos/PlatformApp";
import { prospectResumePath } from "@/lib/saas/prospect-resume";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
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
  const [session, setSession] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (session.orgs.length === 0 && !session.isPlatformAdmin) {
    void listMyProspectsFn()
      .then((rows) => {
        const path = sanitizeNextPath(prospectResumePath(rows)) ?? "/get-pricing";
        window.location.replace(path);
      })
      .catch(() => {
        window.location.replace("/get-pricing");
      });
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Opening your application…
      </div>
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

  return <PlatformApp />;
}
