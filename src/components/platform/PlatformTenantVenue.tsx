import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummexMark } from "@/components/brand/SummexMark";
import { SettingsView } from "@/components/pos/SettingsView";
import { MenuAdminView } from "@/components/pos/MenuAdminView";
import { PosErrorBoundary } from "@/components/pos/PosErrorBoundary";
import { getTenantDrillInFn } from "@/lib/saas/crm-api";
import { getPosBootstrapFn, getSessionContextFn } from "@/lib/saas/api";
import { setActiveContextFn } from "@/lib/saas/api";
import { signOut } from "@/lib/auth/client";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { tablesFromFloorPlan } from "@/lib/saas/location-catalog";
import { tablesFromCount, type TenantMenuMode } from "@/lib/pos/starter-seed";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { parseLaborMap, parseLaborRules } from "@/lib/labor/rules";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import type { PackageId } from "@/lib/pos/packages";
import type { SaasLocation, SaasOrganization } from "@/lib/pos/saas-types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { parseQrPolicy } from "@/lib/pos/qr-policy";
import { parseQrMode } from "@/lib/pos/qr-table";
import {
  buildTenantDetailModel,
  type TenantDetailModel,
} from "@/lib/saas/tenant-detail";
import { LocationDeviceRegistry } from "@/components/pos/LocationDeviceRegistry";
import { QuantumPaymentsSettings } from "@/components/pos/QuantumPaymentsSettings";
import { TenantUsersPanel } from "@/components/platform/TenantUsersPanel";
import { CostWorkspace } from "@/components/pos/CostWorkspace";
import { LaborOpsView } from "@/components/pos/LaborOpsView";
import { ReportsView } from "@/components/pos/ReportsView";
import { OperatorOpsView } from "@/components/pos/OperatorOpsView";
import { FloorView } from "@/components/pos/FloorView";
import { FloorEditorView } from "@/components/pos/FloorEditorView";
import { HostOperatorsSettings } from "@/components/pos/HostOperatorsSettings";
import {
  isHostOperatorsModel,
  type VenueDashModel,
  type VenueDashTabId,
} from "@/lib/saas/venue-dashboard-tabs";
import {
  isEntityPasswordKind,
  passwordDashKind,
  passwordDashTabs,
  passwordDashTitle,
  type PasswordDashKind,
} from "@/lib/saas/password-dash";
import { PasswordDashHome } from "@/components/platform/PasswordDashHome";
import { LedgerView } from "@/components/pos/LedgerView";
import type { MembershipRole } from "@/lib/saas/types";

type Tab = VenueDashTabId;

function venueTypeOf(raw: string): VenueEntityId {
  return isVenueEntityId(raw) ? raw : "food_hall";
}

export function PlatformTenantVenue({
  orgId,
  locId,
  audience = "platform",
  operatorId: scopedOperatorId,
  membershipRole,
}: {
  orgId: string;
  locId?: string;
  /** platform = Tenants drill-in. owner = location admin. entity = one selling entity. Never PIN. */
  audience?: "platform" | "owner" | "entity" | "accountant";
  operatorId?: string;
  membershipRole?: MembershipRole | string;
}) {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("Venue");
  const [ops, setOps] = useState<Array<{ id: string; dba: string }>>([]);
  const [locs, setLocs] = useState<Array<{ id: string; name: string; venueType: string }>>([]);
  const [activeLoc, setActiveLoc] = useState(locId || "");
  const [detail, setDetail] = useState<TenantDetailModel | null>(null);
  const [orgReadyId, setOrgReadyId] = useState("");
  const [model, setModel] = useState<VenueDashModel>("single");
  const [packages, setPackages] = useState<string[]>([]);
  const posView = usePosStore((s) => s.view);
  const kind: PasswordDashKind = passwordDashKind({
    isPlatformAdmin: audience === "platform",
    role:
      membershipRole ||
      (audience === "accountant"
        ? "accountant"
        : audience === "entity"
          ? "vendor"
          : "owner"),
    operatorId: scopedOperatorId,
    operatingModel: model,
    peerVenue: model === "peer_venue",
  });
  const entityId = isEntityPasswordKind(kind) ? scopedOperatorId || "" : "";
  const dashTabs = [
    ...passwordDashTabs(kind),
    ...(audience === "platform" ? ([["people", "Users"]] as const) : []),
  ];
  const tabIds = new Set(dashTabs.map(([id]) => id));
  const hydrateKey = `${audience}:${orgId}:${activeLoc || locId || ""}:${entityId}`;
  const lastHydrated = useRef("");

  useEffect(() => {
    if (locId) setActiveLoc(locId);
  }, [locId]);

  useEffect(() => {
    if (lastHydrated.current === hydrateKey && ready) return;
    lastHydrated.current = hydrateKey;
    let cancelled = false;
    setReady(false);
    setError(null);
    void (async () => {
      type LocRow = { id: string; name: string; venueType: string; status?: string };
      let locations: LocRow[] = [];
      let drillOrg: {
        name: string;
        planId?: string | null;
        status?: string;
        createdAt?: string;
      } = { name: "Venue" };
      let drillMembers: Array<{ id: string; name: string; email: string; role: string }> = [];
      let drillOps: Array<{ id: string; dba: string }> = [];

      if (audience === "owner" || audience === "entity" || audience === "accountant") {
        const session = await getSessionContextFn();
        if (cancelled) return;
        const scoped = session.locations.filter((l) => l.orgId === orgId);
        locations = (scoped.length ? scoped : session.locations).map((l) => ({
          id: l.id,
          name: l.name,
          venueType: l.venueType,
        }));
        const org = session.orgs.find((o) => o.id === orgId) ?? session.orgs[0];
        drillOrg = {
          name: org?.name || session.locations[0]?.orgName || "Venue",
          planId: org?.planId ?? "starter",
          status: org?.status ?? "active",
          createdAt: "",
        };
      } else {
        const drill = await getTenantDrillInFn({ data: { orgId } });
        if (cancelled) return;
        locations = drill.locations;
        drillOrg = drill.org;
        drillMembers = drill.members;
        drillOps = drill.operators.map((o) => ({ id: o.id, dba: o.dba }));
      }

      setLocs(locations);
      setOps(drillOps);
      const loc =
        locations.find((l) => l.id === (activeLoc || locId)) ?? locations[0];
      if (!loc) {
        setTitle(drillOrg.name);
        setError("This org has no location yet.");
        setReady(true);
        return;
      }
      setActiveLoc(loc.id);
      setTitle(loc.name || drillOrg.name);
      await setActiveContextFn({ data: { orgId, locationId: loc.id } }).catch(() => undefined);
      const access = await getPosBootstrapFn({ data: { locationId: loc.id } });
      if (cancelled) return;
      const setup = access.location.setup ?? EMPTY_LOCATION_SETUP;
      const venueType = venueTypeOf(access.location.venueType || loc.venueType);
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
      const tables = setup.floorPlan?.tables?.length
        ? tablesFromFloorPlan(setup.floorPlan)
        : tableCount > 0
          ? tablesFromCount(tableCount, sectionNames)
          : [];
      const settlementRaw =
        setup.settlement && typeof setup.settlement === "object"
          ? (setup.settlement as Record<string, unknown>)
          : {};
      saveTenantPosContext({
        orgId: access.org.id,
        locationId: access.location.id,
        venueType,
        locationName: access.location.name,
        orgName: access.org.name,
        ownerName:
          user?.displayName ||
          (audience === "entity" ? "Entity admin" : audience === "owner" ? "Owner" : "Platform admin"),
        slug: access.location.slug,
      });
      const saasOrg: SaasOrganization = {
        id: access.org.id,
        name: access.org.name,
        legalName: access.org.name,
        plan: (drillOrg.planId ?? "starter") as SaasOrganization["plan"],
        seats: 99,
        locationsIncluded: 99,
        merchantsIncluded: 40,
        billingEmail: user?.primaryEmail ?? "",
        status: drillOrg.status === "suspended" ? "cancelled" : "active",
        createdAt: Date.parse(drillOrg.createdAt || "") || Date.now(),
      };
      const saasLocs: SaasLocation[] = locations.map((l) => ({
        id: l.id,
        orgId: access.org.id,
        name: l.name,
        code: l.id.slice(-6).toUpperCase(),
        mode: venueTypeOf(l.venueType),
        address: "",
        timezone: access.location.timezone,
        open: l.status ? l.status === "active" : true,
        enabledPackages:
          (access.location.enabledPackages as PackageId[] | undefined)?.length
            ? (access.location.enabledPackages as PackageId[])
            : defaultPackagesForMode(venueTypeOf(l.venueType)),
      }));
      setPackages(saasLocs.find((l) => l.id === loc.id)?.enabledPackages ?? saasLocs[0]?.enabledPackages ?? []);
      useSaasStore.getState().hydrateTenant({
        org: saasOrg,
        members: drillMembers.map((m) => ({
          id: m.id,
          orgId: access.org.id,
          name: m.name,
          email: m.email,
          role: m.role === "owner" || m.role === "manager" ? m.role : "ops",
        })),
        locations: saasLocs,
        adminName:
          user?.displayName ||
          (audience === "entity" ? "Entity admin" : audience === "owner" ? "Owner" : "Platform admin"),
        adminRole:
          audience === "owner" ? "owner" : audience === "entity" ? "vendor" : "platform_admin",
      });
      useSaasStore.getState().setActiveLocation(loc.id);
      usePosStore.getState().openTenantLocation({
        entityId: venueType,
        venueName: access.location.name,
        ownerName:
          user?.displayName ||
          (audience === "entity" ? "Entity admin" : audience === "owner" ? "Owner" : "Platform admin"),
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
        pinGate: false,
        staff:
          audience === "entity" && entityId
            ? {
                role: "vendor_operator",
                operatorId: entityId,
                name: user?.displayName || "Entity admin",
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
      const displayName =
        user?.displayName ||
        (audience === "entity" ? "Entity admin" : audience === "owner" ? "Owner" : "Platform admin");
      const dashKind = passwordDashKind({
        isPlatformAdmin: audience === "platform",
        role:
          membershipRole ||
          (audience === "accountant"
            ? "accountant"
            : audience === "entity"
              ? "vendor"
              : "owner"),
        operatorId: entityId || scopedOperatorId,
        operatingModel: access.location.operatingModel,
        peerVenue: access.location.operatingModel === "peer_venue",
      });
      if (dashKind === "accountant") {
        usePosStore.getState().loginAsBackOffice(displayName, "accountant");
      } else if (dashKind === "entity_manager" && (entityId || scopedOperatorId)) {
        usePosStore.getState().loginAsEntityAdmin(displayName, entityId || scopedOperatorId || "", {
          seat: "manager",
        });
      } else if (isEntityPasswordKind(dashKind) && (entityId || scopedOperatorId)) {
        usePosStore.getState().loginAsEntityAdmin(displayName, entityId || scopedOperatorId || "", {
          seat: "owner",
        });
      } else if (dashKind === "host_manager" || dashKind === "venue_manager") {
        usePosStore.getState().loginAsBackOffice(displayName, "manager");
      } else {
        usePosStore.getState().loginAsOwner(displayName);
      }
      const peer = access.location.operatingModel === "peer_venue";
      const hostOps = isHostOperatorsModel(access.location.operatingModel, peer);
      const nextModel: VenueDashModel = peer
        ? "peer_venue"
        : hostOps
          ? "host_operators"
          : "single";
      setModel(nextModel);
      const opsRows =
        access.operators?.map((o) => ({
          id: o.id,
          dba: o.name || "",
        })) ?? drillOps;
      setOps(opsRows.filter((o) => o.dba));
      setDetail(
        buildTenantDetailModel({
          venueName: access.location.name || loc.name || drillOrg.name,
          operatingModel: access.location.operatingModel,
          peerVenue: peer,
          operators: opsRows,
        }),
      );
      const st = usePosStore.getState();
      usePosStore.setState({
        view: audience === "entity" ? "menu" : hostOps ? "hq" : "settings",
        settings: {
          ...st.settings,
          peerVenue: peer || st.settings.peerVenue,
          operatingModel: nextModel,
          hostMultiOperator: hostOps || st.settings.hostMultiOperator,
          hostMayEditEntitySchedules: hostOps
            ? true
            : st.settings.hostMayEditEntitySchedules,
          qrMode: parseQrMode(setup.qrMode ?? st.settings.qrMode),
          qrPolicy: parseQrPolicy(setup.qrPolicy, setup.qrMode ?? st.settings.qrMode),
          cashDiscountEnabled: setup.cashDiscountEnabled ?? st.settings.cashDiscountEnabled,
          cashDiscountPercent: setup.cashDiscountPercent ?? st.settings.cashDiscountPercent,
          cashRoundIncrement:
            setup.cashRoundIncrement === 0.25 ||
            setup.cashRoundIncrement === 0.5 ||
            setup.cashRoundIncrement === 0.75 ||
            setup.cashRoundIncrement === 1
              ? setup.cashRoundIncrement
              : st.settings.cashRoundIncrement,
          cashRoundMode: setup.cashRoundMode === "up" ? "up" : st.settings.cashRoundMode,
          giftHouseIssuerEnabled: peer
            ? false
            : (setup.giftHouseIssuerEnabled ?? st.settings.giftHouseIssuerEnabled),
          lifecycleStatus:
            (access.location.lifecycleStatus as
              | "training"
              | "live"
              | "scheduled_live"
              | "onboarding") ||
            setup.lifecycleStatus ||
            "training",
        },
      });
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
      } catch {
        /* optional */
      }
      const laborMap = parseLaborMap(setup.laborByEntity);
      if (audience === "entity" && entityId) {
        laborMap[entityId] = parseLaborRules({
          ...(laborMap[entityId] ?? {}),
          revenueBasis: "owned_lines",
        });
      }
      if (Object.keys(laborMap).length) {
        useOpsStore.setState({
          labor: parseLaborRules(
            (entityId && laborMap[entityId]) ||
              laborMap[HOST_SCOPE] ||
              Object.values(laborMap)[0],
          ),
          laborByEntity: laborMap,
        });
      }
      if (!cancelled) {
        setOrgReadyId(access.org.id);
        setReady(true);
      }
    })().catch((e) => {
      if (cancelled) return;
      lastHydrated.current = "";
      setError(e instanceof Error ? e.message : "Could not open this venue");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Hydrate once per org/location. User identity is read at run time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateKey]);

  const back = () => {
    void navigate({ to: "/dashboard", search: { surface: "tenants" } });
  };

  const switchLoc = (id: string) => {
    if (audience === "owner" || audience === "entity") {
      setActiveLoc(id);
      void setActiveContextFn({ data: { orgId, locationId: id } }).catch(() => undefined);
      return;
    }
    void navigate({
      to: "/platform/tenants/$orgId",
      params: { orgId },
      search: { loc: id },
    });
  };

  return (
      <PosErrorBoundary>
        <div
          className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground"
          data-demo="platform-tenant-venue"
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
            <SummexMark className="h-8 w-8" />
            {audience === "owner" || audience === "entity" || audience === "accountant" ? (
              <Button size="sm" variant="ghost" onClick={() => void signOut("/login")}>
                Sign out
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={back}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Tenants
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {passwordDashTitle(kind)}
                {kind === "venue_admin" || kind === "venue_manager"
                  ? " · no host merchant"
                  : ""}
              </p>
            </div>
            {ops.length > 0 && (
              <div className="hidden flex-wrap gap-1 sm:flex">
                {ops.map((o) => (
                  <Badge key={o.id} variant="secondary">
                    {o.dba}
                  </Badge>
                ))}
              </div>
            )}
          </header>
          {locs.length > 1 && (
            <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
              {locs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => switchLoc(l.id)}
                  className={`h-9 shrink-0 rounded-lg px-3 text-xs font-medium ${
                    l.id === activeLoc
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2">
            {dashTabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  if (id === "floor") usePosStore.getState().setView("floor");
                }}
                className={`h-9 shrink-0 rounded-lg px-3 text-xs font-medium ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <main className="min-h-0 flex-1 overflow-auto p-4">
            {!ready && (
              <p className="text-sm text-muted-foreground">Opening venue…</p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            {ready && !error && tab === "overview" && (
              <PasswordDashHome
                kind={kind}
                enabledPackages={packages}
                detail={detail}
                onOpen={(id) => {
                  setTab(id);
                  if (id === "floor") usePosStore.getState().setView("floor");
                }}
              />
            )}
            {ready && !error && tab === "settings" && tabIds.has("settings") && <SettingsView />}
            {ready && !error && tab === "devices" && tabIds.has("devices") && (
              <LocationDeviceRegistry
                orgId={orgReadyId}
                locationId={activeLoc}
                locationName={title}
                mode="stations"
              />
            )}
            {ready && !error && tab === "menu" && tabIds.has("menu") && <MenuAdminView />}
            {ready && !error && tab === "payments" && tabIds.has("payments") && (
              <QuantumPaymentsSettings write={kind === "entity_owner" || kind === "host_owner" || kind === "venue_admin" || audience === "platform"} />
            )}
            {ready && !error && audience === "platform" && tab === "people" && (
              <TenantUsersPanel
                orgId={orgReadyId || orgId}
                locationId={activeLoc}
                operators={ops}
              />
            )}
            {ready && !error && tab === "floor" && tabIds.has("floor") && (
              posView === "floor_editor" ? <FloorEditorView /> : <FloorView />
            )}
            {ready && !error && tab === "costs" && tabIds.has("costs") && (
              <CostWorkspace />
            )}
            {ready && !error && tab === "labor" && tabIds.has("labor") && <LaborOpsView />}
            {ready && !error && tab === "schedule" && tabIds.has("schedule") && (
              <LaborOpsView />
            )}
            {ready && !error && tab === "reports" && tabIds.has("reports") && (
              <ReportsView />
            )}
            {ready && !error && tab === "grants" && tabIds.has("grants") && (
              <HostOperatorsSettings write />
            )}
            {ready && !error && tab === "staff" && tabIds.has("staff") && (
              <OperatorOpsView operatorId={entityId} />
            )}
            {ready && !error && tab === "ledger" && tabIds.has("ledger") && (
              <LedgerView />
            )}
          </main>
        </div>
      </PosErrorBoundary>
  );
}
