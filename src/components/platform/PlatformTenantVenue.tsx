import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummexMark } from "@/components/brand/SummexMark";
import { SettingsView } from "@/components/pos/SettingsView";
import { MenuAdminView } from "@/components/pos/MenuAdminView";
import { PosErrorBoundary } from "@/components/pos/PosErrorBoundary";
import { getTenantDrillInFn } from "@/lib/saas/crm-api";
import { getPosBootstrapFn } from "@/lib/saas/api";
import { setActiveContextFn } from "@/lib/saas/api";
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

type Tab = "settings" | "menu" | "people";

function venueTypeOf(raw: string): VenueEntityId {
  return isVenueEntityId(raw) ? raw : "food_hall";
}

export function PlatformTenantVenue({
  orgId,
  locId,
}: {
  orgId: string;
  locId?: string;
}) {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("settings");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("Venue");
  const [ops, setOps] = useState<Array<{ id: string; dba: string }>>([]);
  const [locs, setLocs] = useState<Array<{ id: string; name: string; venueType: string }>>([]);
  const [people, setPeople] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [activeLoc, setActiveLoc] = useState(locId || "");
  const employees = usePosStore((s) => s.employees);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    void (async () => {
      const drill = await getTenantDrillInFn({ data: { orgId } });
      if (cancelled) return;
      const locations = drill.locations;
      setLocs(locations);
      setOps(drill.operators.map((o) => ({ id: o.id, dba: o.dba })));
      setPeople(drill.members);
      const loc =
        locations.find((l) => l.id === locId) ?? locations[0];
      if (!loc) {
        setTitle(drill.org.name);
        setError("This org has no location yet.");
        setReady(true);
        return;
      }
      setActiveLoc(loc.id);
      setTitle(loc.name || drill.org.name);
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
        ownerName: user?.displayName || "Platform admin",
        slug: access.location.slug,
      });
      const saasOrg: SaasOrganization = {
        id: access.org.id,
        name: access.org.name,
        legalName: access.org.name,
        plan: (drill.org.planId ?? "starter") as SaasOrganization["plan"],
        seats: 99,
        locationsIncluded: 99,
        merchantsIncluded: 40,
        billingEmail: user?.primaryEmail ?? "",
        status: drill.org.status === "suspended" ? "cancelled" : "active",
        createdAt: Date.parse(drill.org.createdAt) || Date.now(),
      };
      const saasLocs: SaasLocation[] = locations.map((l) => ({
        id: l.id,
        orgId: access.org.id,
        name: l.name,
        code: l.id.slice(-6).toUpperCase(),
        mode: venueTypeOf(l.venueType),
        address: "",
        timezone: access.location.timezone,
        open: l.status === "active",
        enabledPackages:
          (access.location.enabledPackages as PackageId[] | undefined)?.length
            ? (access.location.enabledPackages as PackageId[])
            : defaultPackagesForMode(venueTypeOf(l.venueType)),
      }));
      useSaasStore.getState().hydrateTenant({
        org: saasOrg,
        members: drill.members.map((m) => ({
          id: m.id,
          orgId: access.org.id,
          name: m.name,
          email: m.email,
          role: m.role === "owner" || m.role === "manager" ? m.role : "ops",
        })),
        locations: saasLocs,
        adminName: user?.displayName || "Platform admin",
        adminRole: "platform_admin",
      });
      useSaasStore.getState().setActiveLocation(loc.id);
      usePosStore.getState().openTenantLocation({
        entityId: venueType,
        venueName: access.location.name,
        ownerName: user?.displayName || "Platform admin",
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
      usePosStore.getState().loginAsOwner(user?.displayName || "Platform admin");
      const st = usePosStore.getState();
      usePosStore.setState({
        view: "settings",
        settings: {
          ...st.settings,
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
          giftHouseIssuerEnabled: setup.giftHouseIssuerEnabled ?? st.settings.giftHouseIssuerEnabled,
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
      if (Object.keys(laborMap).length) {
        useOpsStore.setState({
          labor: parseLaborRules(laborMap[HOST_SCOPE] ?? Object.values(laborMap)[0]),
          laborByEntity: laborMap,
        });
      }
      if (!cancelled) setReady(true);
    })().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : "Could not open this venue");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, locId, user?.displayName, user?.primaryEmail]);

  const back = () => {
    void navigate({ to: "/dashboard", search: { surface: "tenants" } });
  };

  const switchLoc = (id: string) => {
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
            <Button size="sm" variant="ghost" onClick={back}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Tenants
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Venue settings · no host merchant required
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
          <div className="flex shrink-0 gap-1 border-b border-border px-3 py-2">
            {(["settings", "menu", "people"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`h-9 rounded-lg px-3 text-xs font-medium capitalize ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {id === "people" ? "Users" : id}
              </button>
            ))}
          </div>
          <main className="min-h-0 flex-1 overflow-auto p-4">
            {!ready && (
              <p className="text-sm text-muted-foreground">Opening venue…</p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            {ready && !error && tab === "settings" && <SettingsView />}
            {ready && !error && tab === "menu" && <MenuAdminView />}
            {ready && !error && tab === "people" && (
              <div className="mx-auto max-w-lg space-y-4">
                <p className="text-sm font-semibold">Users</p>
                <ul className="space-y-2 text-sm">
                  {people.map((m) => (
                    <li key={m.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                      <span className="font-medium">{m.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {m.role}
                        {m.email ? ` · ${m.email}` : ""}
                      </span>
                    </li>
                  ))}
                  {employees
                    .filter((e) => e.active && e.id !== "emp_owner")
                    .map((e) => (
                      <li key={e.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                        <span className="font-medium">{e.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Floor · {e.role}
                        </span>
                      </li>
                    ))}
                  {people.length === 0 && employees.filter((e) => e.id !== "emp_owner").length === 0 && (
                    <li className="text-muted-foreground">No users yet. Add people on the platform.</li>
                  )}
                </ul>
                <Link
                  to="/dashboard"
                  search={{ surface: "tenants" }}
                  className="text-sm text-muted-foreground underline"
                >
                  Back to Tenants
                </Link>
              </div>
            )}
          </main>
        </div>
      </PosErrorBoundary>
  );
}
