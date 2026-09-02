import { useMemo } from "react";
import {
  ClipboardList,
  CookingPot,
  Landmark,
  LayoutGrid,
  Settings,
  Users,
  Wallet,
  Wine,
  BarChart3,
  Store,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import { venueById } from "@/lib/pos/entities";
import type { EmployeeRole, PosView, VenueEntityId } from "@/lib/pos/types";
import { ROLE_LABEL, canAccessViewForEmployee } from "@/lib/pos/rbac";
import { canEmployee } from "@/lib/access/permissions";
import { VENUE_TYPE_LABEL } from "@/lib/access/entity-roles";
import { AiOpsCard } from "./AiOpsCard";
import { CommsUsageCard } from "./CommsUsageCard";
import { OpsJobsInbox } from "./OpsJobsInbox";
import { AccessPointsCard } from "./AccessPointsCard";
import { ExceptionLiveFeed } from "./ExceptionLiveFeed";
import { useCostStore } from "@/lib/costs/store";

function Jump({
  id,
  label,
  icon: Icon,
}: {
  id: PosView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const setView = usePosStore((s) => s.setView);
  if (emp && !canAccessViewForEmployee(emp, id)) return null;
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => setView(id)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
    </div>
  );
}

export function RoleHomeDashboard() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const settings = usePosStore((s) => s.settings);
  const orders = usePosStore((s) => s.orders);
  const tables = usePosStore((s) => s.tables);
  const tickets = usePosStore((s) => s.tickets);
  const waitlist = usePosStore((s) => s.waitlist);
  const employees = usePosStore((s) => s.employees);
  const shift = usePosStore((s) => s.shift);
  const vendors = usePosStore((s) => s.vendors);
  const periods = usePosStore((s) => s.settlementPeriods);
  const entityId = usePosStore((s) => s.activeEntityId) as VenueEntityId | undefined;
  const venue = venueById(entityId);
  const role: EmployeeRole = emp?.role ?? "server";
  const hostMulti = Boolean(settings.hostMultiOperator || entityId === "food_hall");

  const openChecks = orders.filter((o) => o.status === "open");
  const mine = openChecks.filter((o) => o.serverId === emp?.id);
  const seated = tables.filter((t) =>
    ["seated", "ordering", "ordered", "check"].includes(t.status),
  );
  const waiting = waitlist.filter((w) => w.status === "waiting" || w.status === "notified");
  const kitchenOpen = tickets.filter((t) => t.station === "kitchen" && t.status !== "bumped");
  const barOpen = tickets.filter((t) => t.station === "bar" && t.status !== "bumped");
  const onClock = employees.filter((e) => e.clockedIn).length;
  const liveSales = shift.cashSalesCents + shift.cardSalesCents + shift.giftSalesCents;
  const operatorId = emp?.operatorId;
  const myVendor = vendors.find((v) => v.id === operatorId);
  const myTickets = operatorId
    ? tickets.filter((t) => t.vendorId === operatorId && t.status !== "bumped")
    : [];
  const vendorRow = useMemo(() => {
    if (!operatorId) return null;
    const last = periods[0];
    return last?.rows.find((r) => r.vendorId === operatorId) ?? null;
  }, [periods, operatorId]);

  const typeLabel = entityId ? VENUE_TYPE_LABEL[entityId] : venue?.shortName ?? "House";
  const openCostEx = useCostStore((s) => s.exceptions.filter((e) => e.status === "open").length);

  return (
    <div data-demo="home" className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">{settings.name}</h2>
        <Badge variant="info">{ROLE_LABEL[role]}</Badge>
        <Badge variant="secondary">{typeLabel}</Badge>
        {myVendor && <Badge variant="secondary">{myVendor.shortName}</Badge>}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {(role === "owner" || role === "manager") && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Live sales" value={formatCurrency(liveSales)} />
              <Stat label="Open checks" value={String(openChecks.length)} />
              <Stat label="Waitlist" value={String(waiting.length)} />
              <Stat label="Staff on" value={String(onClock)} />
            </div>
            <AiOpsCard />
            <CommsUsageCard />
            <OpsJobsInbox compact />
            <ExceptionLiveFeed compact />
            {openCostEx > 0 && (
              <div className="rounded-2xl border border-warn/40 bg-surface p-4">
                <p className="text-sm font-medium">Cost exceptions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {openCostEx} open variance item{openCostEx === 1 ? "" : "s"} — respond with a
                  reason. Never silent-dismiss.
                </p>
                <div className="mt-2">
                  <Jump id="inventory_ai" label="Open cost intel" icon={Package} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Jump id="inventory" label="Costs" icon={Package} />
              <Jump id="floor" label="Floor" icon={LayoutGrid} />
              <Jump id="order" label="Order" icon={ClipboardList} />
              <Jump id="menu" label="Menu" icon={ClipboardList} />
              <Jump id="reports" label="Reports" icon={BarChart3} />
              {canEmployee(emp, "settings:write") && (
                <Jump id="settings" label="Location settings" icon={Settings} />
              )}
              <Jump id="reports" label="Reports & AI" icon={BarChart3} />
              {hostMulti && <Jump id="settlement" label="Settlement" icon={Landmark} />}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <AccessPointsCard venueType={entityId} />
            </div>
            {hostMulti && vendors.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-4" data-demo="host-entities">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Operators at this host
                </p>
                <ul className="space-y-1 text-sm">
                  {vendors.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: v.color }} />
                        {v.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{v.stationLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {role === "server" && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="My open checks" value={String(mine.length)} />
              <Stat label="My sections seated" value={String(seated.filter((t) => t.serverId === emp?.id).length)} />
              <Stat label="Kitchen up" value={String(kitchenOpen.filter((t) => t.status === "ready").length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="floor" label="My tables" icon={LayoutGrid} />
              <Jump id="order" label="Quick order" icon={ClipboardList} />
            </div>
            <ul className="space-y-2">
              {mine.slice(0, 6).map((o) => (
                <li key={o.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                  #{o.number} · {o.tabName || "Check"} · {formatCurrency(o.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0))}
                </li>
              ))}
              {mine.length === 0 && (
                <p className="text-sm text-muted-foreground">No open checks on your sections.</p>
              )}
            </ul>
          </>
        )}

        {role === "host" && (
          <>
            <AiOpsCard />
            <OpsJobsInbox compact />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Waiting" value={String(waiting.length)} />
              <Stat label="Open tables" value={String(tables.filter((t) => t.status === "available").length)} />
              <Stat label="Seated" value={String(seated.length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="waitlist" label="Waitlist" icon={Users} />
              <Jump id="floor" label="Seat the floor" icon={LayoutGrid} />
            </div>
          </>
        )}

        {role === "kitchen" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Kitchen tickets" value={String(kitchenOpen.length)} />
              <Stat label="Ready to bump" value={String(kitchenOpen.filter((t) => t.status === "ready").length)} />
            </div>
            <Jump id="kitchen" label="Open ODS" icon={CookingPot} />
          </>
        )}

        {role === "bartender" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Bar tickets" value={String(barOpen.length)} />
              <Stat label="Open tabs" value={String(openChecks.filter((o) => o.type === "bar_tab").length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="bar" label="Bar ODS" icon={Wine} />
              <Jump id="order" label="Service tickets" icon={ClipboardList} />
            </div>
          </>
        )}

        {role === "cashier" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Counter queue" value={String(openChecks.filter((o) => o.type !== "dine_in").length)} />
              <Stat label="Open checks" value={String(openChecks.length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="order" label="Register" icon={ClipboardList} />
              <Jump id="cash" label="Pay / drawer" icon={Wallet} />
            </div>
          </>
        )}

        {role === "vendor_operator" && (
          <>
            <AiOpsCard />
            <OpsJobsInbox compact />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Open tickets" value={String(myTickets.length)} />
              <Stat
                label="Period share"
                value={vendorRow ? formatCurrency(vendorRow.totalVendorDueCents) : "—"}
              />
              <Stat label="Operator" value={myVendor?.name ?? "Unassigned"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="vendor_portal" label="Operator ops" icon={Store} />
              <Jump id="menu" label="Menu" icon={ClipboardList} />
              <Jump id="schedule" label="Schedule" icon={ClipboardList} />
              <Jump id={myVendor?.stationType === "bar" ? "bar" : "kitchen"} label="My tickets" icon={CookingPot} />
              <Jump id="reports" label="My reports" icon={BarChart3} />
              <Jump id="labor" label="Hours export" icon={BarChart3} />
            </div>
            <p className="text-xs text-muted-foreground">
              Full control of {myVendor?.name ?? "your"} menu, tickets, and reports. Peer menus
              are view-only unless the host grants edit. Payouts stay host-managed.
            </p>
          </>
        )}

        {role === "accountant" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Card sales" value={formatCurrency(shift.cardSalesCents)} />
              <Stat label="Cash sales" value={formatCurrency(shift.cashSalesCents)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Jump id="reports" label="Reports" icon={BarChart3} />
              <Jump id="ledger" label="Ledger" icon={Landmark} />
              {hostMulti && <Jump id="settlement" label="Settlement" icon={Landmark} />}
            </div>
          </>
        )}

        {role === "busser" && (
          <>
            <Stat label="Dirty tables" value={String(tables.filter((t) => t.status === "dirty").length)} />
            <Jump id="floor" label="Floor" icon={LayoutGrid} />
          </>
        )}

        {role === "kiosk" && (
          <p className="text-sm text-muted-foreground">
            Kiosk is a device identity. Point the guest surface at /kiosk — not this PIN.
          </p>
        )}
      </div>
    </div>
  );
}
