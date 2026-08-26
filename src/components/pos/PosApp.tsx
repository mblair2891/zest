import { useEffect, useState } from "react";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { useFullStore } from "@/lib/pos/full-store";
import { useIntegrationsStore } from "@/lib/pos/integrations-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useDevPreviewStore } from "@/lib/pos/dev-preview-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { useManualStore } from "@/lib/pos/manual-store";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { useOpsLearnStore } from "@/lib/ops-ai/learn-store";
import { useCostStore } from "@/lib/costs/store";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { EntityLogin } from "./EntityHome";
import { AppShell } from "./AppShell";
import { PosErrorBoundary } from "./PosErrorBoundary";
import { initNativeShell } from "@/lib/native-shell";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { retireDemoSessions } from "@/lib/demo/session";
import { useDemoDeviceStore } from "@/lib/demo/device-session";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPosBootstrapFn } from "@/lib/saas/api";
import { tablesFromCount, type TenantMenuMode } from "@/lib/pos/starter-seed";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { membershipToEmployeeRole } from "@/lib/access/membership-map";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import {
  readTenantPosContext,
  saveTenantPosContext,
} from "@/lib/saas/pos-context";
import { loadPrimedLocation, persistLocationSnapshot } from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";
import { Link } from "@tanstack/react-router";
import { SummexBrandBlock, SummexMark } from "@/components/brand/SummexMark";

const STORES = [
  usePosStore,
  usePlatformStore,
  useFullStore,
  useIntegrationsStore,
  useSaasStore,
  useOpsStore,
  useDevPreviewStore,
  useMarketingStore,
  useManualStore,
  useNotifyStore,
  useNetworkStore,
  useOpsLearnStore,
  useCostStore,
  useLifecycleStore,
  useStationSessionStore,
] as const;

function PosAppInner({ entityId }: { entityId?: string }) {
  const [ready, setReady] = useState(false);
  const [tenantGate, setTenantGate] = useState<"idle" | "ok" | "denied">("idle");
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const openTenantLocation = usePosStore((s) => s.openTenantLocation);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    let remaining = STORES.length;
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) markReady();
    };

    for (const store of STORES) {
      unsubs.push(store.persist.onFinishHydration(onOne));
      void store.persist.rehydrate();
      if (store.persist.hasHydrated()) onOne();
    }

    const timeout = window.setTimeout(markReady, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsubs.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    retireDemoSessions();
    try {
      useDemoDeviceStore.getState().leave();
    } catch {
      /* ignore */
    }
    if (isPending) return;
    const locParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("loc")
        : null;
    const ctx = readTenantPosContext();
    const locationId = locParam || ctx?.locationId;
    if (entityId && isVenueEntityId(entityId) && locationId) {
      void getPosBootstrapFn({ data: { locationId } })
        .then((access) => {
          saveTenantPosContext({
            orgId: access.org.id,
            locationId: access.location.id,
            venueType: access.location.venueType,
            locationName: access.location.name,
            orgName: access.org.name,
            ownerName: user?.displayName || "Owner",
          });
          const setup = access.location.setup ?? EMPTY_LOCATION_SETUP;
          const rawMode = setup.menuMode;
          const menuMode: TenantMenuMode =
            rawMode === "categories" || rawMode === "csv_later" || rawMode === "empty"
              ? rawMode
              : "empty";
          const sectionNames = Array.isArray(setup.sectionNames)
            ? setup.sectionNames.filter((x): x is string => typeof x === "string")
            : [];
          const tableCount = Number(setup.tableCount) || 0;
          const floorLater = Boolean(setup.floorLater);
          const tables =
            floorLater || tableCount <= 0 ? [] : tablesFromCount(tableCount, sectionNames);
          const settlementRaw =
            setup.settlement && typeof setup.settlement === "object"
              ? (setup.settlement as Record<string, unknown>)
              : {};
          const staffRole = membershipToEmployeeRole(access.role);
          openTenantLocation({
            entityId: entityId as VenueEntityId,
            venueName: access.location.name,
            ownerName: user?.displayName || "Owner",
            locationId: access.location.id,
            menuMode,
            vendors: access.operators,
            tables,
            hallMode: access.location.operatingModel === "host_operators",
            address: access.location.address,
            entityPermissions: parseGrantMatrix(setup.entityPermissions),
            locationDevices: parseLocationDevices(setup.locationDevices),
            staff: staffRole
              ? {
                  role: staffRole,
                  operatorId: access.operatorId ?? null,
                  name: user?.displayName || "Staff",
                }
              : undefined,
            settlement: {
              periodType:
                settlementRaw.periodType === "daily" ||
                settlementRaw.periodType === "biweekly" ||
                settlementRaw.periodType === "monthly"
                  ? settlementRaw.periodType
                  : "weekly",
              hostCutEnabled: Number(settlementRaw.hostCutPercent) > 0,
              hostCutPercent: Number(settlementRaw.hostCutPercent) || 0,
              hostName: access.location.hostBrandName || access.location.name,
            },
          });
          try {
            useLifecycleStore.getState().hydrateFromSetup({
              lifecycleStatus:
                access.location.lifecycleStatus || setup.lifecycleStatus || "training",
              trainingTrackInventory: setup.trainingTrackInventory,
              operatorLifecycle: setup.operatorLifecycle,
              goLiveAt: setup.goLiveAt,
              goLiveChoices: setup.goLiveChoices as
                | import("@/lib/lifecycle/types").KeepEraseMap
                | undefined,
            });
            usePosStore.getState().updateSettings?.({
              lifecycleStatus:
                (access.location.lifecycleStatus as
                  | "training"
                  | "live"
                  | "scheduled_live"
                  | "onboarding") ||
                setup.lifecycleStatus ||
                "training",
              trainingTrackInventory: Boolean(setup.trainingTrackInventory),
            });
          } catch {
            /* */
          }
          try {
            useSaasStore.getState().setActiveLocation(access.location.id);
            const loc = useSaasStore
              .getState()
              .locations.find((l) => l.id === access.location.id);
            if (!loc) {
              useSaasStore.getState().hydrateTenant({
                org: {
                  ...useSaasStore.getState().org,
                  id: access.org.id,
                  name: access.org.name,
                  status: access.org.status === "suspended" ? "cancelled" : "active",
                },
                members: useSaasStore.getState().members,
                locations: [
                  {
                    id: access.location.id,
                    orgId: access.org.id,
                    name: access.location.name,
                    code: access.location.id.slice(-6).toUpperCase(),
                    mode: access.location.venueType,
                    address: "",
                    timezone: access.location.timezone,
                    open: true,
                    enabledPackages: access.location.enabledPackages,
                  },
                ],
                adminName: user?.displayName || "Owner",
                adminRole: access.role,
              });
            }
          } catch {
            /* ignore */
          }
          setTenantGate("ok");
          rememberLastPosPath();
          persistLocationSnapshot();
        })
        .catch(async (e) => {
          const primed = await loadPrimedLocation(locationId);
          if (primed) {
            setTenantGate("ok");
            rememberLastPosPath();
            persistLocationSnapshot();
            return;
          }
          const pos = usePosStore.getState();
          if (pos.tenantLocationId === locationId) {
            setTenantGate("ok");
            rememberLastPosPath();
            return;
          }
          setGateMsg(
            e instanceof Error
              ? `${e.message}. Open this device once while online to prime offline use.`
              : "Open this device once while online to prime offline use.",
          );
          setTenantGate("denied");
        });
      return;
    }
    if (entityId && isVenueEntityId(entityId) && !locationId) {
      setGateMsg("Open POS from the platform for a location you belong to.");
      setTenantGate("denied");
      return;
    }
    if (!locationId) {
      setGateMsg("No locations yet — start onboarding from the control plane.");
      setTenantGate("denied");
      return;
    }
    setTenantGate("ok");
  }, [
    ready,
    isPending,
    entityId,
    openTenantLocation,
    user,
  ]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        <div className="text-center">
          <SummexMark className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">Loading Summex…</p>
        </div>
      </div>
    );
  }

  if (tenantGate === "idle") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (tenantGate === "denied") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <p className="text-sm text-muted-foreground">
          {gateMsg ?? "You do not have access to this venue."}
        </p>
        <Link to="/login" className="text-sm font-medium text-primary underline">
          Sign in
        </Link>
        <Link to="/get-pricing" className="text-sm font-medium text-primary underline">
          Start onboarding
        </Link>
        <Link to="/guide" className="text-sm text-muted-foreground underline">
          Operators Guide
        </Link>
      </div>
    );
  }

  if (entityId && isVenueEntityId(entityId)) {
    if (currentEmployeeId && activeEntityId === entityId) {
      return <AppShell />;
    }
    return <EntityLogin entityId={entityId as VenueEntityId} />;
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 text-center">
          <SummexBrandBlock className="mb-6" />
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to create an organization or open the control plane.
          </p>
          <div className="mt-6 space-y-2">
            <Link
              to="/login"
              className="flex h-12 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex h-12 items-center justify-center rounded-2xl border border-border bg-surface text-sm font-semibold"
            >
              Create an account
            </Link>
            <Link
              to="/guide"
              className="block text-sm text-muted-foreground underline"
            >
              Operators Guide
            </Link>
            <Link
              to="/"
              className="block text-sm text-muted-foreground underline"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <p className="text-sm text-muted-foreground">
          Signed in as {user.displayName ?? user.primaryEmail}. Open the control
          plane to manage locations and launch POS.
        </p>
        <Link
          to="/dashboard"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Open control plane
        </Link>
        <Link
          to="/get-pricing"
          className="text-sm font-medium text-primary underline"
        >
          No locations yet — start onboarding
        </Link>
        <Link
          to="/guide"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Operators Guide
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
      <p className="text-sm text-muted-foreground">Sign in to open POS.</p>
      <Link to="/login" className="text-sm font-medium text-primary underline">
        Sign in
      </Link>
    </div>
  );
}

export function PosApp({ entityId }: { entityId?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    void initNativeShell();
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        <div className="text-center">
          <SummexMark className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">Loading Summex…</p>
        </div>
      </div>
    );
  }

  return (
    <PosErrorBoundary>
      <PosAppInner entityId={entityId} />
    </PosErrorBoundary>
  );
}
