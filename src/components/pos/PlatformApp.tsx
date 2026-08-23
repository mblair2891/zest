import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, ArrowLeft, BookOpen } from "lucide-react";
import { GuideTriggerButton } from "@/components/guide/OperatorsGuide";
import { Button } from "@/components/ui/button";
import { SummexBrandBlock, SummexMark } from "@/components/brand/SummexMark";
import { Badge } from "@/components/ui/badge";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import { SaasConsoleView } from "./SaasConsoleView";
import { isDevDemoClient } from "@/lib/saas/flags";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import {
  entitlementsFn,
  getSessionContextFn,
  listLocationsFn,
  listMembersFn,
  listMyProspectsFn,
  listTenantsFn,
  setActiveContextFn,
} from "@/lib/saas/api";
import { ProspectPipelineView } from "@/components/saas/ProspectPipelineView";
import { prospectResumePath } from "@/lib/saas/prospect-resume";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { appHref } from "@/lib/platform/hosts";
import type { SaasLocation, SaasMembership, SaasOrganization } from "@/lib/pos/saas-types";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import type { PackageId } from "@/lib/pos/packages";

/**
 * Fully separate SaaS / multi-tenant platform surface at `/platform`.
 * Production path: Better Auth (username/email + password) + server tenancy.
 */
export function PlatformApp() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tenants, setTenants] = useState<
    Awaited<ReturnType<typeof listTenantsFn>> | null
  >(null);
  const platformAuthed = useSaasStore((s) => s.platformAuthed);
  const platformAdminName = useSaasStore((s) => s.platformAdminName);
  const platformAdminRole = useSaasStore((s) => s.platformAdminRole);
  const logoutPlatform = useSaasStore((s) => s.logoutPlatform);
  const hydrateTenant = useSaasStore((s) => s.hydrateTenant);
  const platform = useSaasStore((s) => s.platform);
  const org = useSaasStore((s) => s.org);
  const loc = useSaasStore(
    (s) => s.locations.find((l) => l.id === s.activeLocationId) ?? s.locations[0],
  );
  const { user, isPending } = useCurrentUserState();
  const demo = isDevDemoClient();
  const [surface, setSurface] = useState<"console" | "pipeline">("console");

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

  const hydrateFromServer = useCallback(async () => {
    setBootError(null);
    const ctx = await getSessionContextFn();
    const orgList = ctx.orgs.filter((o) => o.status === "active" || ctx.isPlatformAdmin);
    if (ctx.isPlatformAdmin) {
      try {
        const list = await listTenantsFn();
        setTenants(list);
        if (list.length === 0) setSurface("pipeline");
      } catch {
        setTenants([]);
        setSurface("pipeline");
      }
    } else {
      setTenants(null);
    }
    const current = orgList[0];
    if (!current) {
      setNeedsOnboarding(!ctx.isPlatformAdmin);
      if (ctx.isPlatformAdmin) {
        hydrateTenant({
          org: {
            id: "platform",
            name: "Summex Platform",
            legalName: "Summex Platform",
            plan: "platform_internal",
            seats: 9999,
            locationsIncluded: 999,
            merchantsIncluded: 999,
            billingEmail: ctx.user.email ?? "",
            status: "active",
            createdAt: Date.now(),
          },
          members: [],
          locations: [],
          adminName: ctx.user.name ?? ctx.user.email ?? "Platform admin",
          adminRole: "platform_admin",
        });
      }
      return;
    }
    setNeedsOnboarding(false);
    const [members, locations, ent] = await Promise.all([
      listMembersFn({ data: { orgId: current.id } }),
      listLocationsFn({ data: { orgId: current.id } }),
      entitlementsFn({ data: { orgId: current.id } }),
    ]);
    const saasOrg: SaasOrganization = {
      id: current.id,
      name: current.name,
      legalName: current.name,
      plan: (current.planId ?? "starter") as SaasOrganization["plan"],
      seats: ent.maxSeats,
      locationsIncluded: ent.maxLocations,
      merchantsIncluded: 40,
      billingEmail: ctx.user.email ?? "",
      status:
        current.status === "suspended"
          ? "cancelled"
          : current.planStatus === "trialing"
            ? "trial"
            : current.planStatus === "past_due"
              ? "past_due"
              : current.planStatus === "canceled"
                ? "cancelled"
                : "active",
      createdAt: Date.parse(current.createdAt) || Date.now(),
    };
    const saasMembers: SaasMembership[] = members.map((m) => ({
      id: m.id,
      orgId: m.orgId ?? current.id,
      name: m.name ?? m.email ?? "Member",
      email: m.email ?? "",
      role: m.role,
    }));
    const saasLocs: SaasLocation[] = locations.map((l) => ({
      id: l.id,
      orgId: l.orgId,
      name: l.name,
      code: l.id.slice(-6).toUpperCase(),
      mode: l.venueType,
      address: "",
      timezone: l.timezone,
      open: l.status === "active",
      enabledPackages:
        l.enabledPackages.length > 0
          ? l.enabledPackages
          : (ent.features as PackageId[]).length
            ? (ent.features as PackageId[])
            : defaultPackagesForMode(l.venueType),
    }));
    hydrateTenant({
      org: saasOrg,
      members: saasMembers,
      locations: saasLocs,
      adminName: ctx.user.name ?? ctx.user.email ?? "Owner",
      adminRole: ctx.isPlatformAdmin ? "platform_admin" : current.role,
    });
  }, [hydrateTenant]);

  useEffect(() => {
    if (!ready || isPending) return;
    if (!user) return;
    void hydrateFromServer().catch((e) => {
      setBootError(e instanceof Error ? e.message : "Could not load workspace");
    });
  }, [ready, isPending, user, hydrateFromServer]);

  if (!ready || isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        Loading Summex Platform…
      </div>
    );
  }

  if (!user && !platformAuthed) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
          <div className="mb-8 text-center">
            <SummexBrandBlock className="mb-6" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Control plane
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Multi-tenant orgs, locations, packages, devices & billing — separate
              from restaurant POS.
            </p>
          </div>

          <Link
            to="/guide"
            className="mb-3 flex w-full items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:border-primary/50"
          >
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Operators Guide</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Intake, onboarding, host capture, and the $35 dispute fee.
              </span>
            </span>
          </Link>

          <div className="space-y-2">
            <Link
              to="/login"
              className="flex w-full min-h-14 items-center justify-center rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex w-full min-h-14 items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold"
            >
              Create an account
            </Link>
          </div>

          <Link
            to="/"
            className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    );
  }

  if (user && needsOnboarding) {
    void listMyProspectsFn()
      .then((rows) => {
        const path =
          sanitizeNextPath(prospectResumePath(rows)) ?? "/get-pricing";
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

  const openPos = () => {
    if (!loc) {
      window.location.href = "/";
      return;
    }
    saveTenantPosContext({
      orgId: org.id,
      locationId: loc.id,
      venueType: loc.mode,
      locationName: loc.name,
      orgName: org.name,
      ownerName: platformAdminName || user?.displayName || "Owner",
    });
    void setActiveContextFn({
      data: { orgId: org.id, locationId: loc.id },
    }).finally(() => {
      window.location.href = appHref(
        `/venue/${loc.mode}?loc=${encodeURIComponent(loc.id)}`,
      );
    });
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <SummexMark className="h-8 w-8" />
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
        {tenants && (
          <Button
            size="sm"
            variant={surface === "pipeline" ? "default" : "outline"}
            onClick={() => setSurface(surface === "pipeline" ? "console" : "pipeline")}
          >
            {surface === "pipeline" ? "Console" : "Pipeline"}
          </Button>
        )}
        <GuideTriggerButton topicId="platform-admin" />
        <Link
          to="/whitepaper"
          className="hidden text-xs text-muted-foreground underline-offset-2 hover:underline sm:inline"
        >
          White paper
        </Link>
        {demo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              usePosStore.getState().loadLaundryTestVenue();
              window.location.href = "/venue/food_hall";
            }}
          >
            Load The Laundry
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={openPos} disabled={!loc}>
          Open POS
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Sign out of platform"
          onClick={() => {
            logoutPlatform();
            if (user) void signOut("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      {bootError && (
        <p className="border-b border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {bootError}
        </p>
      )}
      {tenants && (
        <PlatformTenantsBar tenants={tenants} onChanged={() => void hydrateFromServer()} />
      )}
      <main className="min-h-0 flex-1 overflow-hidden">
        {surface === "pipeline" && tenants ? <ProspectPipelineView /> : <SaasConsoleView />}
      </main>
    </div>
  );
}

function PlatformTenantsBar({
  tenants,
  onChanged,
}: {
  tenants: Awaited<ReturnType<typeof listTenantsFn>>;
  onChanged: () => void;
}) {
  return (
    <div className="border-b border-border bg-surface-2 px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Platform admin · tenants
      </p>
      <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {tenants.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1 text-xs"
          >
            <span className="font-medium">{t.name}</span>
            <span className="text-muted-foreground">
              {t.planId ?? "—"} · {t.status}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                void import("@/lib/saas/api").then(({ setTenantPlanFn }) =>
                  setTenantPlanFn({
                    data: { orgId: t.id, planId: t.planId === "starter" ? "full_service" : "starter" },
                  }).then(onChanged),
                );
              }}
            >
              Cycle plan
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                void import("@/lib/saas/api").then(({ setOrgStatusFn }) =>
                  setOrgStatusFn({
                    data: {
                      orgId: t.id,
                      status: t.status === "suspended" ? "active" : "suspended",
                    },
                  }).then(onChanged),
                );
              }}
            >
              {t.status === "suspended" ? "Activate" : "Suspend"}
            </Button>
          </li>
        ))}
        {tenants.length === 0 && (
          <li className="text-xs text-muted-foreground">No tenants yet</li>
        )}
      </ul>
    </div>
  );
}
