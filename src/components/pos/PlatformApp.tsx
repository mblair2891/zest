import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ArrowLeft, BookOpen } from "lucide-react";
import { GuideTriggerButton } from "@/components/guide/OperatorsGuide";
import { ReplayWorkflowButton } from "@/components/onboarding/ReplayWorkflowButton";
import { LoginOnboardingHost } from "@/components/onboarding/LoginOnboardingHost";
import { Button } from "@/components/ui/button";
import { SummexBrandBlock, SummexMark } from "@/components/brand/SummexMark";
import { Badge } from "@/components/ui/badge";
import { useSaasStore } from "@/lib/pos/saas-store";

import { SaasConsoleView } from "./SaasConsoleView";

import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import {
  entitlementsFn,
  getSessionContextFn,
  listLocationsFn,
  listMembersFn,
  listMyProspectsFn,
  listTenantsFn,
} from "@/lib/saas/api";
import { PlatformControlPlane } from "@/components/platform/PlatformControlPlane";
import {
  parsePlatformSurface,
  type PlatformSurface,
} from "@/components/platform/surfaces";

import { prospectResumePath } from "@/lib/saas/prospect-resume";
import { navigateToSanitizedPath } from "@/lib/auth/post-login-navigate";
import { openLocationPos } from "@/lib/saas/open-location";
import type { SaasLocation, SaasMembership, SaasOrganization } from "@/lib/pos/saas-types";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import type { PackageId } from "@/lib/pos/packages";

function OnboardingResume({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) {
  useEffect(() => {
    void listMyProspectsFn()
      .then((rows) =>
        navigateToSanitizedPath(
          navigate,
          prospectResumePath(rows) || "/get-pricing",
        ),
      )
      .catch(() => navigate({ to: "/get-pricing" }));
  }, [navigate]);
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
      Opening your application…
    </div>
  );
}

/**
 * Fully separate SaaS / multi-tenant platform surface at `/platform`.
 * Production path: Better Auth (username/email + password) + server tenancy.
 */
export function PlatformApp() {
  const navigate = useNavigate();
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
  const [surface, setSurface] = useState<PlatformSurface | "console">("crm");
  const [adminNav, setAdminNav] = useState(false);
  const userPickedSurface = useRef(false);
  const pickSurface = (next: PlatformSurface | "console") => {
    userPickedSurface.current = true;
    setSurface(next);
  };

  useEffect(() => {
    const onSurface = (e: Event) => {
      const raw = (e as CustomEvent).detail;
      if (raw === "console") {
        setSurface("tenants");
        return;
      }
      const next = parsePlatformSurface(raw);
      if (next) setSurface(next);
    };
    window.addEventListener("summex:platform-surface", onSurface);
    return () => window.removeEventListener("summex:platform-surface", onSurface);
  }, []);

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
      setAdminNav(true);
      try {
        const list = await listTenantsFn();
        setTenants(list);
        if (!userPickedSurface.current && list.length === 0) {
          setSurface("crm");
        }
      } catch {
        setTenants([]);
        if (!userPickedSurface.current) setSurface("pipeline");
      }
    } else {
      setAdminNav(false);
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
                Floor, payments, cash closeout, devices, and the $35 dispute fee.
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
    return <OnboardingResume navigate={navigate} />;
  }

  const openPos = () => {
    if (!loc) {
      window.location.href = "/";
      return;
    }
    openLocationPos({
      orgId: org.id,
      locationId: loc.id,
      venueType: loc.mode,
      locationName: loc.name,
      orgName: org.name,
      ownerName: platformAdminName || user?.displayName || "Owner",
    });
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <LoginOnboardingHost />
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
        {adminNav && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            CRM · pipeline · tenants
          </span>
        )}
        <ReplayWorkflowButton className="hidden md:inline-flex" />
        <GuideTriggerButton topicId="platform-admin" />
        <Link
          to="/whitepaper"
          className="hidden text-xs text-muted-foreground underline-offset-2 hover:underline sm:inline"
        >
          White paper
        </Link>
        <Button
          size="sm"
          variant="outline"
          data-demo="platform-open-pos"
          onClick={openPos}
          disabled={!loc}
        >
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
      <main
        className="min-h-0 flex-1 overflow-hidden"
        data-demo={
          adminNav
            ? `platform-${surface}`
            : "platform-console"
        }
      >
        {adminNav && surface !== "console" ? (
          <PlatformControlPlane
            surface={surface}
            onSurface={(s) => pickSurface(s)}
          />
        ) : (
          <SaasConsoleView />
        )}
      </main>
    </div>
  );
}
