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
import { useCashSessionStore } from "@/lib/pos/cash-session";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
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
import { parseQrPolicy } from "@/lib/pos/qr-policy";
import { parseQrMode } from "@/lib/pos/qr-table";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { tablesFromFloorPlan } from "@/lib/saas/location-catalog";
import { membershipToEmployeeRole } from "@/lib/access/membership-map";
import { HOST_SCOPE, parseGrantMatrix } from "@/lib/access/entity-grants";
import { parseLaborMap, parseLaborRules } from "@/lib/labor/rules";
import {
  findPairedDevice,
  parseLocationDevices,
  readOrCreateBrowserDeviceId,
  writePairedDeviceId,
} from "@/lib/pos/location-devices";
import { heartbeatLocationDeviceFn, getPairedStationFn, pairStationFn } from "@/lib/access/api";
import { readStationPair } from "@/lib/pos/station-pair";
import { applyStationPublish, parseStationPublish } from "@/lib/pos/station-publish";
import { StationPublishWatcher } from "@/components/pos/StationPublishWatcher";

import { SESSION_MODES, type SessionModeId } from "@/lib/lifecycle/types";
import {
  consumeStationPinGate,
  deviceRoleFromFunction,
  isStationPinPath,
  readStationDeviceRole,
  sessionModeForDeviceRole,
} from "@/lib/pos/device-roles";
import { isNativeApp } from "@/lib/native-shell";
import {
  readTenantPosContext,
  saveTenantPosContext,
} from "@/lib/saas/pos-context";
import {
  loadPrimedLocation,
  persistLocationSnapshot,
  resolvePrimedLocation,
} from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";
import { Link } from "@tanstack/react-router";
import { SummexBrandBlock, SummexMark } from "@/components/brand/SummexMark";
import { hydrateFloor, useFloorPolling } from "@/lib/pos/floor-sync";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

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
  useCashSessionStore,
  useCloseoutStore,
] as const;

function PosAppInner({ entityId }: { entityId?: string }) {
  const [ready, setReady] = useState(false);
  const [tenantGate, setTenantGate] = useState<"idle" | "ok" | "denied">("idle");
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId);
  const openTenantLocation = usePosStore((s) => s.openTenantLocation);
  const { user, isPending } = useCurrentUserState();
  useFloorPolling(tenantGate === "ok" ? tenantLocationId : null);

  useEffect(() => {
    if (!ready) return;
    const role = readStationDeviceRole();
    if (role) {
      useStationSessionStore.getState().setAssignment({
        kind: sessionModeForDeviceRole(role),
      });
    }
    if ((isStationPinPath() || isNativeApp()) && consumeStationPinGate()) {
      if (usePosStore.getState().currentEmployeeId) {
        usePosStore.getState().logout();
      }
    }
  }, [ready]);

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
    let cancelled = false;
    void (async () => {
    const locParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("loc")
        : null;
    const ctx = readTenantPosContext();
    const storedPair = readStationPair();
    let locationId = locParam || storedPair?.locationId || ctx?.locationId;
    if (!locationId) {
      const pack = await resolvePrimedLocation();
      locationId = pack?.locationId;
    }
    if (cancelled) return;
    if (entityId && isVenueEntityId(entityId) && locationId) {
      const skipCloud =
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        !useNetworkStore.getState().wanOnline();
      const pair = storedPair?.locationId === locationId ? storedPair : null;
      const fetchBoot = () => {
        if (user) return getPosBootstrapFn({ data: { locationId } });
        if (pair?.deviceId) {
          return getPairedStationFn({
            data: { locationId, deviceId: pair.deviceId },
          }) as unknown as ReturnType<typeof getPosBootstrapFn>;
        }
        if (pair?.claimCode) {
          return pairStationFn({
            data: {
              claimCode: pair.claimCode,
              browserDeviceId: readOrCreateBrowserDeviceId(locationId),
            },
          }) as unknown as ReturnType<typeof getPosBootstrapFn>;
        }
        return getPosBootstrapFn({ data: { locationId } });
      };
      const boot = skipCloud
        ? Promise.reject(new Error("offline"))
        : withTimeout(fetchBoot(), 4000);
      void boot
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
            rawMode === "categories" ||
            rawMode === "csv_later" ||
            rawMode === "empty" ||
            rawMode === "starter"
              ? rawMode
              : "empty";
          const sectionNames = Array.isArray(setup.sectionNames)
            ? setup.sectionNames.filter((x): x is string => typeof x === "string")
            : [];
          const tableCount = Number(setup.tableCount) || 0;
          const floorLater = Boolean(setup.floorLater);
          const tables = setup.floorPlan?.tables?.length
            ? tablesFromFloorPlan(setup.floorPlan)
            : floorLater || tableCount <= 0
              ? []
              : tablesFromCount(tableCount, sectionNames);
          const settlementRaw =
            setup.settlement && typeof setup.settlement === "object"
              ? (setup.settlement as Record<string, unknown>)
              : {};
          const staffRole = access.openDemo
            ? null
            : membershipToEmployeeRole(access.role);
          openTenantLocation({
            entityId: entityId as VenueEntityId,
            venueName: access.location.name,
            ownerName: user?.displayName || "Owner",
            locationId: access.location.id,
            menuMode,
            vendors: access.operators,
            tables,
            floorSections: setup.floorPlan?.sections,
            hallMode:
              access.location.operatingModel === "host_operators" ||
              access.location.operatingModel === "peer_venue",
            peerVenue: access.location.operatingModel === "peer_venue",
            address: access.location.address,
            entityPermissions: parseGrantMatrix(setup.entityPermissions),
            locationDevices: parseLocationDevices(setup.locationDevices),
            floorStaff: access.floorStaff,
            pinGate: Boolean(access.floorStaff?.length) || Boolean(access.openDemo),
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
            const st = usePosStore.getState();
            usePosStore.setState({
              settings: {
                ...st.settings,
                qrMode: parseQrMode(setup.qrMode ?? st.settings.qrMode),
                qrPolicy: parseQrPolicy(setup.qrPolicy, setup.qrMode ?? st.settings.qrMode),
                cashDiscountEnabled:
                  setup.cashDiscountEnabled ?? st.settings.cashDiscountEnabled,
                cashDiscountPercent:
                  setup.cashDiscountPercent ?? st.settings.cashDiscountPercent,
                cashRoundIncrement:
                  setup.cashRoundIncrement === 0.25 ||
                  setup.cashRoundIncrement === 0.5 ||
                  setup.cashRoundIncrement === 0.75 ||
                  setup.cashRoundIncrement === 1
                    ? setup.cashRoundIncrement
                    : st.settings.cashRoundIncrement,
                cashRoundMode:
                  setup.cashRoundMode === "up" ? "up" : st.settings.cashRoundMode,
                giftHouseIssuerEnabled:
                  setup.giftHouseIssuerEnabled ?? st.settings.giftHouseIssuerEnabled,
              },
            });
          } catch { /* optional */ }
          try {
            const devices = parseLocationDevices(setup.locationDevices);
            const paired = findPairedDevice(devices, access.location.id);
            if (paired) {
              writePairedDeviceId(access.location.id, paired.id);
              usePosStore.setState({ activeDeviceId: paired.id });
              const hadStation = Boolean(
                useStationSessionStore.getState().byLocation[access.location.id],
              );
              useStationSessionStore.getState().ensureLocation(access.location.id);
              if (!hadStation) {
                if (paired.assignment.function === "split") {
                  const kitchenOp =
                    access.operators.find((v) => v.stationType === "kitchen")?.id ??
                    paired.assignment.operatorId;
                  const barOp =
                    access.operators.find((v) => v.stationType === "bar")?.id ??
                    paired.assignment.operatorId;
                  useStationSessionStore.getState().seedSplitDefaults(
                    { kind: "kitchen_kds", operatorId: kitchenOp },
                    { kind: "bar_kds", operatorId: barOp },
                  );
                } else if (SESSION_MODES.some((m) => m.id === paired.assignment.function)) {
                  const urlRole = readStationDeviceRole();
                  const role = urlRole ?? deviceRoleFromFunction(paired.assignment.function);
                  useStationSessionStore.getState().setAssignment({
                    kind: sessionModeForDeviceRole(role),
                    operatorId: paired.assignment.operatorId,
                  });
                }
              }
              void heartbeatLocationDeviceFn({
                data: { locationId: access.location.id, deviceId: paired.id },
              }).catch(() => undefined);
            }
          } catch {
            /* pairing is best-effort */
          }
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
            {
              const opId =
                usePosStore.getState().employees.find((e) => e.id === usePosStore.getState().currentEmployeeId)
                  ?.operatorId || HOST_SCOPE;
              const rules = setup.laborByEntity?.[opId] ?? setup.laborByEntity?.[HOST_SCOPE];
              const laborMap = parseLaborMap(setup.laborByEntity);
              if (rules || Object.keys(laborMap).length) {
                useOpsStore.setState({
                  labor: parseLaborRules(rules ?? laborMap[opId] ?? laborMap[HOST_SCOPE]),
                  laborByEntity: laborMap,
                });
              }
              if (setup.sharedVenueCostsCents != null) {
                const st = usePosStore.getState();
                usePosStore.setState({
                  settings: { ...st.settings, sharedVenueCostsCents: setup.sharedVenueCostsCents },
                });
              }
              const pub = parseStationPublish(setup.stationPublish) ?? parseStationPublish(
                (access as { publish?: unknown }).publish,
              );
              if (pub) applyStationPublish(pub);
            }
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
              giftHouseIssuerEnabled: setup.giftHouseIssuerEnabled,
              giftHostessDefaultIssuerId: setup.giftHostessDefaultIssuerId,
              giftTermAllowed: setup.giftTermAllowed,
              giftTermDays: setup.giftTermDays,
              giftOperatorBreakageSplitBps: setup.giftOperatorBreakageSplitBps,
              aiReportSchedule: setup.aiReportSchedule ?? "off",
              aiReportEmail: setup.aiReportEmail ?? "",
              opsJobs: setup.opsJobs,
              smsEnabled: setup.smsEnabled !== false,
              smsMonthlyCap: setup.smsMonthlyCap ?? null,
              cashHandling: setup.cashHandling,
            });
            if (access.location.id) {
              useCashSessionStore.getState().ensureLocation(access.location.id);
              useCloseoutStore.getState().ensureLocation(access.location.id);
            }
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
          if (setup.floorPlan?.tables?.length) {
            const cur = usePosStore.getState();
            usePosStore.setState({
              floorSections: setup.floorPlan.sections?.length
                ? setup.floorPlan.sections
                : cur.floorSections,
              tables:
                cur.tables.length === 0
                  ? tablesFromFloorPlan(setup.floorPlan)
                  : cur.tables,
            });
          } else if (setup.floorPlan?.sections?.length) {
            usePosStore.setState({ floorSections: setup.floorPlan.sections });
          }
          if (setup.menuCatalog?.items?.length) {
            const cur = usePosStore.getState();
            usePosStore.setState({
              menuItems: setup.menuCatalog.items,
              categories: setup.menuCatalog.categories.length
                ? setup.menuCatalog.categories
                : cur.categories,
              modifierGroups: setup.menuCatalog.modifiers.length
                ? setup.menuCatalog.modifiers
                : cur.modifierGroups,
            });
          }
          if (setup.recipes?.length || setup.costPack) {
            const pack = setup.costPack;
            useCostStore.setState({
              recipes: setup.recipes?.length
                ? setup.recipes
                : useCostStore.getState().recipes,
              ...(pack
                ? {
                    skus: pack.skus?.length ? pack.skus : useCostStore.getState().skus,
                    suppliers: pack.suppliers?.length
                      ? pack.suppliers
                      : useCostStore.getState().suppliers,
                    invoices: pack.invoices ?? useCostStore.getState().invoices,
                    maps: pack.maps ?? useCostStore.getState().maps,
                    exceptions: pack.exceptions ?? useCostStore.getState().exceptions,
                    settings: pack.settings ?? useCostStore.getState().settings,
                    pos: pack.pos?.length ? pack.pos : useCostStore.getState().pos,
                  }
                : {}),
            });
          }
          try {
            useLifecycleStore.getState().hydrateFromSetup({
              lifecycleStatus: setup.lifecycleStatus,
              trainingTrackInventory: setup.trainingTrackInventory,
              operatorLifecycle: setup.operatorLifecycle,
              goLiveAt: setup.goLiveAt,
            });
          } catch {
            /* lifecycle optional */
          }
          try {
            const opId = usePosStore.getState().employees.find((e) => e.id === usePosStore.getState().currentEmployeeId)?.operatorId || HOST_SCOPE;
            const rules = setup.laborByEntity?.[opId] ?? setup.laborByEntity?.[HOST_SCOPE];
            const laborMap = parseLaborMap(setup.laborByEntity);
            if (rules || Object.keys(laborMap).length) {
              useOpsStore.setState({
                labor: parseLaborRules(rules ?? laborMap[opId] ?? laborMap[HOST_SCOPE]),
                laborByEntity: laborMap,
              });
            }
          } catch {
            /* labor optional */
          }
          setTenantGate("ok");
          rememberLastPosPath();
          persistLocationSnapshot();
          void hydrateFloor(access.location.id);
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
      const pack = await resolvePrimedLocation();
      if (cancelled) return;
      if (pack?.locationId) {
        const primed = await loadPrimedLocation(pack.locationId);
        if (primed) {
          setTenantGate("ok");
          rememberLastPosPath();
          return;
        }
      }
      setGateMsg("Open this device once while online to prime the station.");
      setTenantGate("denied");
      return;
    }
    if (!locationId) {
      setGateMsg("No locations yet — start onboarding from the control plane.");
      setTenantGate("denied");
      return;
    }
    setTenantGate("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    isPending,
    entityId,
    openTenantLocation,
    user?.id,
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
        {!isStationPinPath() && !isNativeApp() && (
          <Link to="/login" className="text-sm font-medium text-primary underline">
            Sign in
          </Link>
        )}
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

  if (!user && (isStationPinPath() || isNativeApp())) {
    const fallbackEntity: VenueEntityId = "restaurant";
    return <EntityLogin entityId={fallbackEntity} />;
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

  if (isStationPinPath() || isNativeApp()) {
    return <EntityLogin entityId={"restaurant"} />;
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
      <StationPublishWatcher />
      <PosAppInner entityId={entityId} />
    </PosErrorBoundary>
  );
}
