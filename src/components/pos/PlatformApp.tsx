import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Rocket, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaasStore } from "@/lib/pos/saas-store";
import { SaasConsoleView } from "./SaasConsoleView";

/**
 * Fully separate SaaS / multi-tenant platform surface at `/platform`.
 * Not mixed into restaurant POS navigation.
 */
export function PlatformApp() {
  const [ready, setReady] = useState(false);
  const platformAuthed = useSaasStore((s) => s.platformAuthed);
  const platformAdminName = useSaasStore((s) => s.platformAdminName);
  const platformAdminRole = useSaasStore((s) => s.platformAdminRole);
  const loginPlatform = useSaasStore((s) => s.loginPlatform);
  const logoutPlatform = useSaasStore((s) => s.logoutPlatform);
  const platform = useSaasStore((s) => s.platform);
  const org = useSaasStore((s) => s.org);

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

  if (!platformAuthed) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg shadow-primary/25">
              Z
            </div>
            <h1 className="text-3xl font-black tracking-tighter">
              Zest Platform
            </h1>
            <p className="mt-1.5 text-sm font-medium text-primary">
              SaaS control plane
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Multi-tenant orgs, locations, packages, devices & billing — separate
              from restaurant POS.
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              By Michael Blair & Andy Baida
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Quick login · platform staff
            </p>
            {(
              [
                {
                  name: "Morgan Blair",
                  role: "owner" as const,
                  blurb: "Org, billing & every location",
                },
                {
                  name: "Alex Rivera",
                  role: "admin" as const,
                  blurb: "Users, packages & devices",
                },
                {
                  name: "Sam Okonkwo",
                  role: "ops" as const,
                  blurb: "Locations, pods & onboarding",
                },
                {
                  name: "Jordan Lee",
                  role: "accountant" as const,
                  blurb: "Payouts, invoices & close",
                },
                {
                  name: "Riley Chen",
                  role: "support" as const,
                  blurb: "Devices & guest issues",
                },
              ] as const
            ).map((s) => (
              <button
                key={s.role}
                type="button"
                onClick={() => loginPlatform(s.name, s.role)}
                className="flex w-full min-h-14 items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:border-primary/50"
              >
                <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="mt-0.5 inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {s.role}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {s.blurb}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Link
            to="/"
            className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            All venues
          </Link>
        </div>
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
            SaaS · {org.name} · {org.plan} plan
          </p>
        </div>
        <Badge variant="info">Platform</Badge>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{platformAdminName}</p>
          <p className="text-[11px] capitalize text-primary">
            {platformAdminRole || "SaaS"} access
          </p>
        </div>
        <Link to="/">
          <Button size="sm" variant="outline">
            Open POS
          </Button>
        </Link>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Sign out of platform"
          onClick={() => logoutPlatform()}
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
