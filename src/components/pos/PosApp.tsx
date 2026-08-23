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
import { EntityLogin, EntityPicker } from "./EntityHome";
import { AppShell } from "./AppShell";
import { PosErrorBoundary } from "./PosErrorBoundary";
import { initNativeShell } from "@/lib/native-shell";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { isDevDemoClient } from "@/lib/saas/flags";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPosBootstrapFn } from "@/lib/saas/api";
import { tablesFromCount, type TenantMenuMode } from "@/lib/pos/starter-seed";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import {
  readTenantPosContext,
  saveTenantPosContext,
} from "@/lib/saas/pos-context";
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
] as const;

function PosAppInner({ entityId }: { entityId?: string }) {
  const [ready, setReady] = useState(false);
  const [tenantGate, setTenantGate] = useState<"idle" | "ok" | "denied">("idle");
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const applyEntity = usePosStore((s) => s.applyEntity);
  const openTenantLocation = usePosStore((s) => s.openTenantLocation);
  const { user, isPending } = useCurrentUserState();
  const demo = isDevDemoClient();

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
    if (demo) {
      if (entityId && isVenueEntityId(entityId) && activeEntityId !== entityId) {
        applyEntity(entityId as VenueEntityId);
      }
      setTenantGate("ok");
      return;
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
        })
        .catch((e) => {
          setGateMsg(e instanceof Error ? e.message : "No access to this location");
          setTenantGate("denied");
        });
      return;
    }
    if (entityId && isVenueEntityId(entityId) && !locationId) {
      setGateMsg("Open POS from the platform for a location you belong to.");
      setTenantGate("denied");
      return;
    }
    setTenantGate("ok");
  }, [
    ready,
    demo,
    isPending,
    entityId,
    activeEntityId,
    applyEntity,
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

  if (!demo && tenantGate === "idle") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (!demo && tenantGate === "denied") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <p className="text-sm text-muted-foreground">
          {gateMsg ?? "You do not have access to this venue."}
        </p>
        <Link to="/platform" className="text-sm font-medium text-primary underline">
          Go to platform
        </Link>
        <Link to="/login" className="text-sm text-muted-foreground underline">
          Sign in
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

  if (currentEmployeeId) {
    return <AppShell />;
  }

  if (!demo && !user) {
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
              to="/platform"
              className="block text-sm text-muted-foreground underline"
            >
              Platform
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!demo && user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <p className="text-sm text-muted-foreground">
          Signed in as {user.displayName ?? user.primaryEmail}. Open the control
          plane to manage locations and launch POS.
        </p>
        <Link
          to="/platform"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Open platform
        </Link>
      </div>
    );
  }

  return <EntityPicker />;
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
