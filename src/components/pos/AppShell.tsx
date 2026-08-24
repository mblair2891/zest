import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SummexMark } from "@/components/brand/SummexMark";
import {
  BarChart3,
  ClipboardList,
  Clock,
  CookingPot,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  Users,
  Wallet,
  Wine,
  BookOpen,
  UserCircle,
  ShoppingBag,
  Building2,
  Globe,
  Map as MapIcon,
  Boxes,
  Landmark,
  ScrollText,
  Plug,
  Store,
  Layers,
  Truck,
  Clock3,
  Brain,
  Sparkles,
  Rocket,
  Megaphone,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import {
  ROLE_LABEL,
  canAccessView,
  canAccessViewForEmployee,
  homeViewForEmployee,
  homeViewForRole,
  staffTitle,
} from "@/lib/pos/rbac";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useDevPreviewStore } from "@/lib/pos/dev-preview-store";
import {
  allowsView,
  PREVIEW_OPTIONS,
  previewLabel,
} from "@/lib/pos/package-access";
import { cn, formatTime } from "@/lib/utils";
import { isDevDemoClient } from "@/lib/saas/flags";
import { isProspectDemo } from "@/lib/demo/session";
import { DemoDeviceSwitcher } from "@/components/demo/DemoDeviceSwitcher";
import { useDemoDeviceStore } from "@/lib/demo/device-session";
import { useDemoLiveSync } from "@/lib/demo/live-sync";
import { FloorView } from "./FloorView";
import { OrderView } from "./OrderView";
import { KitchenView } from "./KitchenView";
import { WaitlistView } from "./WaitlistView";
import { ReportsView } from "./ReportsView";
import { InventoryView } from "./InventoryView";
import { EmployeesView } from "./EmployeesView";
import { MenuAdminView } from "./MenuAdminView";
import { CustomersView } from "./CustomersView";
import { SettingsView } from "./SettingsView";
import { CashView } from "./CashView";
import { TakeoutView } from "./TakeoutView";
import { FloorEditorView } from "./FloorEditorView";
import { FullPackageView } from "./FullPackageView";
import { SettlementView } from "./SettlementView";
import { LedgerView } from "./LedgerView";
import { IntegrationsHubView } from "./IntegrationsHubView";
import { VendorPortalView } from "./VendorPortalView";
import { FeatureMatrixView } from "./FeatureMatrixView";
import { TruckPodView } from "./TruckPodView";
import { LaborOpsView } from "./LaborOpsView";
import { InventoryAiView } from "./InventoryAiView";
import { DrinkAiView } from "./DrinkAiView";
import { MarketingHubView } from "./MarketingHubView";
import { GuideTriggerButton } from "@/components/guide/OperatorsGuide";
import { ReplayWorkflowButton } from "@/components/onboarding/ReplayWorkflowButton";
import { LoginOnboardingHost } from "@/components/onboarding/LoginOnboardingHost";
import { venueById } from "@/lib/pos/entities";
import { useManualStore } from "@/lib/pos/manual-store";
import {
  NotificationBell,
  TicketBumpWatcher,
} from "./NotificationCenter";
import { NetworkBanner, NetworkChip, NetworkWatcher } from "./NetworkStatus";
import { BackOfficeUnlock } from "./BackOfficeUnlock";
import { isFloorRole } from "@/lib/pos/pin";
import {
  HqView,
  OnlineOrdersView,
  PayoutsView,
  ScheduleView,
  PromosView,
  CateringView,
  RecipesView,
  PurchasingView,
  DeliveryView,
  CampaignsView,
  ChecklistsView,
  HallView,
} from "./PlatformViews";

/** End-user POS nav only — SaaS lives at /platform */
const NAV: {
  id: PosView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "hq", label: "Home", icon: Building2 },
  { id: "truck_pod", label: "Truck pod", icon: Truck },
  { id: "package", label: "Full pack", icon: Boxes },
  { id: "features", label: "All features", icon: Layers },
  { id: "floor", label: "Floor", icon: LayoutGrid },
  { id: "order", label: "Order", icon: ClipboardList },
  { id: "kitchen", label: "Kitchen", icon: CookingPot },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "waitlist", label: "Host", icon: Users },
  { id: "online", label: "Online", icon: Globe },
  { id: "takeout", label: "Takeout", icon: ShoppingBag },
  { id: "hall", label: "Hall", icon: MapIcon },
  { id: "settlement", label: "Settle", icon: Landmark },
  { id: "ledger", label: "Ledger", icon: ScrollText },
  { id: "vendor_portal", label: "Operator ops", icon: Store },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "inventory", label: "Stock", icon: Package },
  { id: "menu", label: "Menu", icon: BookOpen },
  { id: "labor", label: "Labor", icon: Clock3 },
  { id: "schedule", label: "Schedule", icon: Clock },
  { id: "inventory_ai", label: "AI stock", icon: Brain },
  { id: "drink_ai", label: "Drink AI", icon: Sparkles },
  { id: "employees", label: "Staff", icon: Clock },
  { id: "customers", label: "Guests", icon: UserCircle },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "website", label: "Website", icon: Globe2 },
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIORITY: PosView[] = [
  "hq",
  "floor",
  "order",
  "kitchen",
  "bar",
  "waitlist",
  "settlement",
  "labor",
  "drink_ai",
  "online",
  "takeout",
  "reports",
  "cash",
];

const BACK_OFFICE_VIEWS: PosView[] = [
  "settings",
  "settlement",
  "payouts",
  "employees",
  "features",
  "package",
  "integrations",
];

export function AppShell() {
  useDemoLiveSync();
  const demoDevice = useDemoDeviceStore((s) => s.device);
  const demoEntered = useDemoDeviceStore((s) => s.entered);
  const sessionKind = usePosStore((s) => s.sessionKind);
  const backOfficeUnlocked = usePosStore((s) => s.backOfficeUnlocked);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingView, setPendingView] = useState<PosView | null>(null);
  const kdsMode =
    isProspectDemo() &&
    demoEntered &&
    (demoDevice === "kds_kitchen" || demoDevice === "kds_bar");
  const view = usePosStore((s) => s.view);
  const setView = usePosStore((s) => s.setView);
  const logout = usePosStore((s) => s.logout);
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const role: EmployeeRole = emp?.role ?? "server";
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const venue = venueById(activeEntityId);
  const openManual = useManualStore((s) => s.openManual);
  const settings = usePosStore((s) => s.settings);
  const tickets = usePosStore((s) => s.tickets);
  const clock = usePosStore((s) => s.clock);
  const tick = usePosStore((s) => s.tick);
  const orders = usePosStore((s) => s.orders);
  const onlineOrders = usePlatformStore((s) => s.onlineOrders);
  const activeLoc = usePlatformStore(
    (s) =>
      s.locations.find((l) => l.id === s.activeLocationId) ??
      s.locations[0] ??
      null,
  );
  const saasLocations = useSaasStore((s) => s.locations);
  const saasActiveId = useSaasStore((s) => s.activeLocationId);
  const packagePreview = useDevPreviewStore((s) => s.packagePreview);
  const setPackagePreview = useDevPreviewStore((s) => s.setPackagePreview);

  const packageLocationId =
    saasActiveId || venue?.locationId || saasLocations[0]?.id || "";
  const enabledPackages =
    saasLocations.find((l) => l.id === packageLocationId)?.enabledPackages ??
    [];

  const pkgOk = (v: PosView) =>
    isProspectDemo()
      ? true
      : allowsView(v, enabledPackages, isDevDemoClient() ? packagePreview : "location");

  const viewOk = (v: PosView) => {
    const ent = venueById(activeEntityId);
    if (!ent) return true;
    return !ent.hiddenViews.includes(v);
  };

  const floorLocked =
    sessionKind === "pin" && !backOfficeUnlocked && isFloorRole(role);
  const requestView = (id: PosView) => {
    if (BACK_OFFICE_VIEWS.includes(id) && sessionKind === "pin" && !backOfficeUnlocked) {
      setPendingView(id);
      setUnlockOpen(true);
      return;
    }
    setView(id);
  };

  const navItems = useMemo(
    () =>
      NAV.filter(
        (n) =>
          viewOk(n.id) &&
          (emp ? canAccessViewForEmployee(emp, n.id) : false) &&
          pkgOk(n.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emp?.id, role, activeEntityId, packageLocationId, packagePreview, enabledPackages.join(",")],
  );

  const mobileItems = useMemo(() => {
    const allowed = new Set(navItems.map((n) => n.id));
    return MOBILE_PRIORITY.filter((id) => allowed.has(id))
      .map((id) => navItems.find((n) => n.id === id)!)
      .filter(Boolean)
      .slice(0, 5);
  }, [navItems]);

  useEffect(() => {
    const roleOk = emp ? canAccessViewForEmployee(emp, view) : false;
    const packagesOk = pkgOk(view);
    const entityOk = viewOk(view);
    if (!roleOk || !packagesOk || !entityOk) {
      const home = emp ? homeViewForEmployee(emp) : homeViewForRole(role);
      if (
        viewOk(home) &&
        pkgOk(home) &&
        (emp ? canAccessViewForEmployee(emp, home) : canAccessView(role, home))
      ) {
        setView(home);
      } else {
        const first = NAV.find(
          (n) =>
            viewOk(n.id) &&
            canAccessView(role, n.id) &&
            pkgOk(n.id),
        );
        if (first) setView(first.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, view, setView, activeEntityId, packageLocationId, packagePreview, enabledPackages.join(",")]);


  // Deep link: /?station=kitchen|bar|floor|order|...
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const station = q.get("station") as PosView | null;
      if (!station) return;
      if (canAccessView(role, station) && pkgOk(station)) {
        setView(station);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, packagePreview]);

  useEffect(() => {
    const id = window.setInterval(() => tick(), 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  const kitchenOpen = tickets.filter(
    (t) => t.station === "kitchen" && t.status !== "bumped",
  ).length;
  const barOpen = tickets.filter(
    (t) => t.station === "bar" && t.status !== "bumped",
  ).length;
  const openOrders = orders.filter((o) => o.status === "open").length;
  const onlineOpen = onlineOrders.filter(
    (o) => !["completed", "cancelled"].includes(o.status),
  ).length;

  const safeView = kdsMode
    ? demoDevice === "kds_bar"
      ? "bar"
      : "kitchen"
    : viewOk(view) && canAccessView(role, view) && pkgOk(view)
      ? view
      : emp
        ? homeViewForEmployee(emp)
        : homeViewForRole(role);

  const shellPad = isProspectDemo()
    ? "pt-[calc(var(--grok-banner-h,0px)+3.25rem)]"
    : "pt-[var(--grok-banner-h,0px)]";

  if (kdsMode) {
    return (
      <div className={cn("flex h-[100dvh] flex-col bg-bg text-foreground", shellPad)}>
        <LoginOnboardingHost />
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
          <p className="text-sm font-semibold">
            {demoDevice === "kds_bar" ? "Bar KDS" : "Kitchen KDS"}
          </p>
          <span className="text-xs text-muted-foreground">{settings.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <DemoDeviceSwitcher />
            <Button size="sm" variant="outline" onClick={() => logout()}>
              Switch user
            </Button>
          </div>
        </header>
        <div
          className="min-h-0 flex-1"
          data-demo={demoDevice === "kds_bar" ? "bar" : "kitchen"}
        >
          <KitchenView station={demoDevice === "kds_bar" ? "bar" : "kitchen"} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-[100dvh] flex-col bg-bg text-foreground", shellPad)}>
      <LoginOnboardingHost />
      <BackOfficeUnlock
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          if (pendingView) setView(pendingView);
          setPendingView(null);
        }}
      />
      <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-surface px-2 safe-top sm:gap-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SummexMark className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {settings.name}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {formatTime(clock)}
              {venue ? ` · ${venue.shortName}` : ""}
              {openOrders > 0 ? ` · ${openOrders} checks` : ""}
            </p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-2">
          {/* Dev: package preview lens */}
          {isDevDemoClient() && (
          <label className="hidden min-w-0 flex-col items-stretch sm:flex">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Package preview
            </span>
            <select
              className="max-w-[11rem] truncate rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-foreground xl:max-w-[14rem]"
              value={packagePreview}
              onChange={(e) =>
                setPackagePreview(
                  e.target.value as typeof packagePreview,
                )
              }
              title="Dev: preview POS as if only this package (plus core) is on"
            >
              {PREVIEW_OPTIONS.map((o) => (
                <option key={String(o.id)} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          )}
          {/* Package preview is desktop-only so Help stays visible on phones */}

          {isProspectDemo() && demoEntered && (
            <DemoDeviceSwitcher className="hidden md:flex" />
          )}
          {emp && (
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium leading-tight">{emp.name}</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide text-primary">
                  {staffTitle(emp)}
                  {floorLocked ? " · floor PIN" : sessionKind === "backoffice" ? " · back office" : ""}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {previewLabel(packagePreview)}
                </span>
              </p>
            </div>
          )}

          <NotificationBell />
          <NetworkChip />
          <ReplayWorkflowButton className="hidden md:inline-flex" />
          <GuideTriggerButton topicId="intro" />
          <Link
            to="/"
            title="Change venue"
            onClick={() => logout()}
            className="hidden sm:block"
          >
            <Button size="icon" variant="ghost" aria-label="Change venue">
              <Building2 className="h-4 w-4" />
            </Button>
          </Link>
          {!isProspectDemo() && (
            <Link to="/dashboard" title="Open control plane" className="hidden sm:block">
              <Button size="icon" variant="ghost" aria-label="SaaS platform">
                <Rocket className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => logout()}
            aria-label="Switch user"
            data-demo="switch-user"
          >
            Switch user
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logout()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {packagePreview !== "location" && (
        <div className="border-b border-primary/30 bg-primary/10 px-3 py-1 text-center text-[11px] text-primary">
          Dev package lens: <strong>{previewLabel(packagePreview)}</strong>
          {" · "}
          menu shows only that package (plus core) ∩ {ROLE_LABEL[role]} role
        </div>
      )}
      <NetworkBanner />

      <div className="flex min-h-0 flex-1">
        <nav className="hidden h-full w-[11.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-2 lg:flex xl:w-52">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {ROLE_LABEL[role]} menu
          </p>
          {navItems.map(({ id, label, icon: Icon }) => {
            let badge: number | null = null;
            if (id === "kitchen") badge = kitchenOpen;
            if (id === "bar") badge = barOpen;
            if (id === "order") badge = openOrders;
            if (id === "online") badge = onlineOpen;
            return (
              <button
                key={id}
                type="button"
                data-demo-nav={id}
                onClick={() => requestView(id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors lg:px-3",
                  safeView === id
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {badge != null && badge > 0 && (
                  <Badge variant="info" className="ml-auto tabular">
                    {badge}
                  </Badge>
                )}
              </button>
            );
          })}
          <div className="mt-auto border-t border-border pt-2">
            <button
              type="button"
              onClick={() => openManual("intro")}
              className="flex w-full items-center gap-3 rounded-xl bg-primary/15 px-2 py-2.5 text-left text-sm font-semibold text-primary transition hover:bg-primary/25 lg:px-3"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Guide</span>
            </button>
          </div>
        </nav>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden" data-demo={safeView}>
          {safeView === "truck_pod" && <TruckPodView />}
          {safeView === "labor" && <LaborOpsView />}
          {safeView === "inventory_ai" && <InventoryAiView />}
          {safeView === "drink_ai" && <DrinkAiView />}
          {safeView === "hq" && <HqView />}
          {safeView === "package" && <FullPackageView />}
          {safeView === "features" && <FeatureMatrixView />}
          {safeView === "settlement" && <SettlementView />}
          {safeView === "ledger" && <LedgerView />}
          {safeView === "vendor_portal" && <VendorPortalView />}
          {safeView === "integrations" && <IntegrationsHubView />}
          {safeView === "floor" && <FloorView />}
          {safeView === "order" && <OrderView />}
          {safeView === "kitchen" && <KitchenView station="kitchen" />}
          {safeView === "bar" && <KitchenView station="bar" />}
          {safeView === "waitlist" && <WaitlistView />}
          {safeView === "takeout" && <TakeoutView />}
          {safeView === "online" && <OnlineOrdersView />}
          {safeView === "hall" && <HallView />}
          {safeView === "floor_editor" && <FloorEditorView />}
          {safeView === "schedule" && <ScheduleView />}
          {safeView === "promos" && <PromosView />}
          {safeView === "catering" && <CateringView />}
          {safeView === "recipes" && <RecipesView />}
          {safeView === "purchasing" && <PurchasingView />}
          {safeView === "payouts" && <PayoutsView />}
          {safeView === "delivery" && <DeliveryView />}
          {safeView === "campaigns" && <CampaignsView />}
          {safeView === "checklists" && <ChecklistsView />}
          {safeView === "reports" && <ReportsView />}
          {safeView === "inventory" && <InventoryView />}
          {safeView === "menu" && <MenuAdminView />}
          {safeView === "employees" && <EmployeesView />}
          {safeView === "customers" && <CustomersView />}
          {safeView === "marketing" && <MarketingHubView />}
          {safeView === "website" && <MarketingHubView />}
          {safeView === "cash" && <CashView />}
          {safeView === "settings" && <SettingsView />}
        </main>
      </div>

      <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-t border-border bg-surface px-1 py-1 safe-bottom md:hidden">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => requestView(item.id)}
              className={cn(
                "flex min-w-[4.25rem] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px]",
                safeView === item.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => openManual("intro")}
          className="flex min-w-[4.25rem] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold text-primary"
        >
          <BookOpen className="h-5 w-5" />
          Guide
        </button>
      </nav>

      <TicketBumpWatcher />
      <NetworkWatcher />
    </div>
  );
}
