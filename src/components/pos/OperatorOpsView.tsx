import { useMemo, useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { vendorSubtotalOnOrder } from "@/lib/pos/settlement";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { canEmployee } from "@/lib/access/permissions";
import type { EmployeeRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/rbac";

/**
 * Narrow ops surface for a guest operator: staff, clock, 86, view-only settlement.
 * Host owner/manager can also open this per operator from Host settings.
 */
export function OperatorOpsView({
  operatorId: forcedId,
  hostManaged = false,
}: {
  operatorId?: string;
  hostManaged?: boolean;
}) {
  const vendors = usePosStore((s) => s.vendors);
  const orders = usePosStore((s) => s.orders);
  const tickets = usePosStore((s) => s.tickets);
  const menuItems = usePosStore((s) => s.menuItems);
  const periods = usePosStore((s) => s.settlementPeriods);
  const employees = usePosStore((s) => s.employees);
  const toggleItem = usePosStore((s) => s.toggleItemAvailable);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const createEmployee = usePosStore((s) => s.createEmployee);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const lockedId = emp?.role === "vendor_operator" ? emp.operatorId : forcedId;
  const isGuest = emp?.role === "vendor_operator";
  const canStaff = canEmployee(emp, "staff:invite") || hostManaged;
  const can86 = canEmployee(emp, "item:86") || hostManaged;
  const [vendorId, setVendorId] = useState(lockedId || vendors[0]?.id || "");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<EmployeeRole>("kitchen");
  const [staffPin, setStaffPin] = useState("");
  const [createdPin, setCreatedPin] = useState<string | null>(null);

  const vendor =
    vendors.find((v) => v.id === (lockedId || vendorId)) ?? vendors[0];

  const stats = useMemo(() => {
    if (!vendor) return null;
    const closed = orders.filter((o) => o.status === "closed");
    let gross = 0;
    let checks = 0;
    for (const o of closed) {
      const sub = vendorSubtotalOnOrder(o, vendor.id);
      if (sub > 0) {
        gross += sub;
        checks += 1;
      }
    }
    const openTickets = tickets.filter(
      (t) => t.vendorId === vendor.id && t.status !== "bumped",
    ).length;
    const items = menuItems.filter((m) => m.vendorId === vendor.id);
    const lastPeriod = periods.find((p) => p.rows.some((r) => r.vendorId === vendor.id));
    const row = lastPeriod?.rows.find((r) => r.vendorId === vendor.id);
    const staff = employees.filter((e) => e.active && e.operatorId === vendor.id);
    return { gross, checks, openTickets, items, lastPeriod, row, staff };
  }, [vendor, orders, tickets, menuItems, periods, employees]);

  if (!vendor || !stats) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        No operators onboarded. The host adds guest operators in Host settings.
      </div>
    );
  }

  const addStaff = () => {
    if (!staffName.trim() || !canStaff) return;
    const res = createEmployee({
      name: staffName.trim(),
      role: staffRole,
      pin: staffPin || undefined,
      operatorId: vendor.id,
      title: ROLE_LABEL[staffRole],
    });
    setCreatedPin(res.pin);
    setStaffName("");
    setStaffPin("");
  };

  return (
    <div className="flex h-full flex-col" data-demo="operator-ops">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Operator ops</h2>
          <Badge variant="info">{isGuest ? "Your stall" : "Host viewing operator"}</Badge>
        </div>
        {!lockedId && (
          <div className="mt-2 flex flex-wrap gap-1">
            {vendors.map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={v.id === vendor.id ? "default" : "outline"}
                onClick={() => setVendorId(v.id)}
              >
                <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: v.color }} />
                {v.shortName}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="text-lg font-semibold">{vendor.name}</h3>
          <p className="text-sm text-muted-foreground">
            {vendor.cuisine || "Guest operator"} · Station: {vendor.stationLabel}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Payout destination is host-managed
            {vendor.bankLast4 ? ` · ${vendor.bankLabel} ••${vendor.bankLast4}` : ""}.
            You cannot edit bank details, tax, cash discount, or host branding.
            Open Menu to edit your items; peer menus are view-only unless the host grants edit.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Period gross (closed)" value={formatCurrency(stats.gross)} />
          <Tile label="Checks with your items" value={String(stats.checks)} />
          <Tile label="Open KDS tickets" value={String(stats.openTickets)} />
          <Tile label="Staff on this stall" value={String(stats.staff.length)} />
        </div>

        {stats.row && stats.lastPeriod && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="mb-2 text-sm font-semibold">Last closed settlement (view only)</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              {formatDateTime(stats.lastPeriod.periodStart)} → {formatDateTime(stats.lastPeriod.periodEnd)} ·{" "}
              {stats.lastPeriod.status}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Tile label="Gross" value={formatCurrency(stats.row.grossSalesCents)} />
              <Tile label="Card fees" value={formatCurrency(stats.row.cardFeesCents)} />
              <Tile label="Host cut" value={formatCurrency(stats.row.hostCutCents)} />
              <Tile label="Due you" value={formatCurrency(stats.row.totalVendorDueCents)} />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h4 className="mb-2 text-sm font-semibold">Staff & time clock</h4>
          <ul className="divide-y divide-border text-sm">
            {stats.staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {s.name}{" "}
                  <span className="text-muted-foreground">
                    · {ROLE_LABEL[s.role]} · {s.pinHash || s.pin ? "PIN set" : "No PIN"}
                  </span>
                </span>
                <Button size="sm" variant={s.clockedIn ? "default" : "outline"} onClick={() => clockToggle(s.id)}>
                  {s.clockedIn ? "Clock out" : "Clock in"}
                </Button>
              </li>
            ))}
            {stats.staff.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">No staff on this operator yet.</li>
            )}
          </ul>
          {canStaff && (
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <Input placeholder="Name" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
              <select
                className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as EmployeeRole)}
              >
                <option value="kitchen">Kitchen</option>
                <option value="bartender">Bartender</option>
              </select>
              <Input placeholder="PIN (optional)" value={staffPin} onChange={(e) => setStaffPin(e.target.value)} />
              <Button type="button" onClick={addStaff} disabled={!staffName.trim()}>
                Add staff
              </Button>
              {createdPin && (
                <p className="sm:col-span-4 text-xs text-muted-foreground">Created PIN {createdPin}.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h4 className="mb-2 text-sm font-semibold">Your items · 86 board</h4>
          <ul className="divide-y divide-border text-sm">
            {stats.items.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {m.name}{" "}
                  <span className="text-muted-foreground">{formatCurrency(m.priceCents)}</span>
                </span>
                {can86 && (
                  <Button size="sm" variant={m.available ? "outline" : "default"} onClick={() => toggleItem(m.id)}>
                    {m.available ? "86 item" : "Restore"}
                  </Button>
                )}
              </li>
            ))}
            {stats.items.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">No items tagged to this operator.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular">{value}</p>
    </div>
  );
}
