import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaasStore } from "@/lib/pos/saas-store";
import { SaasConsoleView } from "./SaasConsoleView";
import { SessionGate } from "./SessionGate";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";

/**
 * Fully separate SaaS / multi-tenant platform surface at `/platform`.
 * Not mixed into restaurant POS navigation.
 */
export function PlatformApp() {
  return (
    <SessionGate>
      <PlatformAppInner />
    </SessionGate>
  );
}

function PlatformAppInner() {
  const [ready, setReady] = useState(false);
  const user = useCurrentUser();
  const platform = useSaasStore((s) => s.platform);
  const org = useSaasStore((s) => s.org);
  const orgs = useSaasStore((s) => s.orgs);
  const activeLocationId = useSaasStore((s) => s.activeLocationId);
  const locations = useSaasStore((s) => s.locations);
  const activeLoc = locations.find((l) => l.id === activeLocationId);

  useEffect(() => {
    const done = () => setReady(true);
    const u = useSaasStore.persist.onFinishHydration(done);
    void useSaasStore.persist.rehydrate();
    if (useSaasStore.persist.hasHydrated()) done();
    const t = window.setTimeout(done, 1200);
    return () => {
      u();
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        Loading Zest Platform…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
          Z
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            {platform.name} Platform
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            SaaS · {org.id ? `${org.name} · ${org.plan} plan` : "no organization"}{" "}
            · {orgs.length} org{orgs.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant="info">Platform admin</Badge>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">
            {user?.displayName ?? "Admin"}
          </p>
          <p className="text-[11px] text-primary">Control plane</p>
        </div>
        {activeLoc ? (
          <Link to="/pos/$locationId" params={{ locationId: activeLoc.id }}>
            <Button size="sm" variant="outline">
              Open POS
            </Button>
          </Link>
        ) : (
          <Link to="/">
            <Button size="sm" variant="outline">
              Home
            </Button>
          </Link>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Sign out"
          onClick={() => void signOut("/login")}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        <SaasConsoleView />
      </main>
    </div>
  );
}
