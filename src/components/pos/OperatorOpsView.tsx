import { useMemo, useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { vendorSubtotalOnOrder } from "@/lib/pos/settlement";
import {
  parseRevenueShare,
  ruleSummary,
  rulesVisibleToEntity,
  shareByEntity,
  shareLinesForOrders,
} from "@/lib/pos/revenue-share";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { canEmployee } from "@/lib/access/permissions";
import type { EmployeeRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { FLOOR_ROLES } from "@/lib/pos/pin";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";
import { TaxRatesEditor, ratesPatch } from "./TaxRatesSettings";
import { persistTaxRates } from "@/lib/pos/persist-location-setup";
import { resolveVenueTaxRates } from "@/lib/pos/tax-rates";
import { BrandLogoField } from "@/components/brand/BrandLogoField";
import { StaffPayFields } from "@/components/pos/StaffPayFields";
import {
  duplicateEmployeeNumber,
  EMPTY_STAFF_PAY,
  staffListTitle,
  validateStaffPay,
  type StaffPayDraft,
} from "@/lib/labor/staff-record";
import { addFloorStaffFn, updateTenantUserFn } from "@/lib/saas/tenant-users-api";
import { useSaasStore } from "@/lib/pos/saas-store";

/**
 * Narrow ops surface for a guest operator: staff, clock, 86, view-only settlement.
 * Host owner/manager can also open this per operator from Host settings.
 */
export function OperatorOpsView({
  operatorId: forcedId,
  hostManaged = false,
  peopleOnly = false,
}: {
  operatorId?: string;
  hostManaged?: boolean;
  /** Password Staff tab: people, PINs, and roles. No 86 board. */
  peopleOnly?: boolean;
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
  const updateEmployee = usePosStore((s) => s.updateEmployee);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const locId = usePosStore((s) => s.tenantLocationId);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const sections = usePosStore((s) => s.floorSections);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const lockedId = emp?.role === "vendor_operator" ? emp.operatorId : forcedId;
  const isGuest = emp?.role === "vendor_operator";
  const canStaff = canEmployee(emp, "staff:invite") || hostManaged;
  const can86 = canEmployee(emp, "item:86") || hostManaged;
  const [vendorId, setVendorId] = useState(lockedId || vendors[0]?.id || "");
  const [staffDraft, setStaffDraft] = useState<StaffPayDraft>(EMPTY_STAFF_PAY);
  const [staffRole, setStaffRole] = useState<EmployeeRole>(peopleOnly ? "server" : "kitchen");
  const [staffPin, setStaffPin] = useState("");
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    const staff = employees.filter((e) => e.operatorId === vendor.id);
    const share = parseRevenueShare(settings.revenueShare);
    const lines = shareLinesForOrders({
      orders: closed,
      config: share,
      tables,
      sections,
      menuItems,
      timeZone: settings.timezone,
    });
    const pnl = shareByEntity(lines, [vendor.id]).find((row) => row.entityId === vendor.id);
    const rules = rulesVisibleToEntity(share.rules, vendor.id);
    return { gross, checks, openTickets, items, lastPeriod, row, staff, pnl, rules };
  }, [vendor, orders, tickets, menuItems, periods, employees, settings, tables, sections]);

  const logoWrite = Boolean(isGuest && vendor && emp?.operatorId === vendor.id);

  if (!vendor || !stats) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        No operators onboarded. The host adds guest operators in Host settings.
      </div>
    );
  }

  const resetStaffForm = () => {
    setStaffDraft(EMPTY_STAFF_PAY);
    setStaffPin("");
    setEditingId(null);
  };

  const addStaff = () => {
    if (!canStaff) return;
    const payError = validateStaffPay({
      firstName: staffDraft.firstName,
      lastName: staffDraft.lastName,
      employeeNumber: staffDraft.employeeNumber,
      payAmount: staffDraft.payAmount,
    });
    if (payError) {
      setStaffError(payError);
      return;
    }
    if (duplicateEmployeeNumber(employees, editingId || "", staffDraft.employeeNumber)) {
      setStaffError("That employee number is already used at this venue.");
      return;
    }
    setStaffError(null);
    const fields = {
      firstName: staffDraft.firstName,
      lastName: staffDraft.lastName,
      displayName: staffDraft.displayName,
      employeeNumber: staffDraft.employeeNumber,
      payRateType: staffDraft.payRateType,
      payAmount: staffDraft.payAmount,
      hireDate: staffDraft.hireDate || null,
      employmentStatus: staffDraft.employmentStatus,
      email: staffDraft.email,
      phone: staffDraft.phone,
      role: staffRole,
      operatorId: vendor.id,
      title: staffDraft.position,
    };
    void (async () => {
      const orgId = useSaasStore.getState().org.id;
      const serverFields = {
        orgId,
        locationId: locId || "",
        firstName: staffDraft.firstName,
        lastName: staffDraft.lastName,
        displayName: staffDraft.displayName,
        employeeNumber: staffDraft.employeeNumber,
        payRateType: staffDraft.payRateType,
        payAmount: staffDraft.payAmount,
        hireDate: staffDraft.hireDate || null,
        employmentStatus: staffDraft.employmentStatus,
        email: staffDraft.email,
        phone: staffDraft.phone,
        position: staffDraft.position,
        role: staffRole,
        homeEntityId: vendor.id,
      };
      try {
        if (editingId) {
          const local = updateEmployee(editingId, fields);
          if (!local.ok) {
            setStaffError(local.error || "Could not save");
            return;
          }
          if (orgId && locId) {
            try {
              await updateTenantUserFn({ data: { ...serverFields, kind: "floor", id: editingId } });
            } catch {
              /* the station roster keeps the rate */
            }
          }
          resetStaffForm();
          return;
        }
        let serverId: string | undefined;
        if (orgId && locId && staffPin.replace(/\D/g, "").length >= 4) {
          try {
            const saved = await addFloorStaffFn({ data: { ...serverFields, pin: staffPin } });
            serverId = saved.id;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (/employee number|First name|Last name|Pay rate|PIN must|already in use/i.test(msg)) {
              setStaffError(msg);
              return;
            }
          }
        }
        const res = createEmployee({ ...fields, id: serverId, pin: staffPin || undefined });
        if (res.error) {
          setStaffError(res.error);
          return;
        }
        setCreatedPin(res.pin);
        resetStaffForm();
      } catch (err) {
        setStaffError(err instanceof Error ? err.message : "Could not save");
      }
    })();
  };

  const staffEditor = (roles: readonly EmployeeRole[]) => (
    <div className="grid gap-3">
      <StaffPayFields value={staffDraft} onChange={setStaffDraft} />
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
          value={staffRole}
          onChange={(e) => setStaffRole(e.target.value as EmployeeRole)}
          aria-label="Role"
        >
          {(roles.includes(staffRole) ? roles : [staffRole, ...roles]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
        <Input
          placeholder="PIN (optional)"
          value={staffPin}
          onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <Button
          type="button"
          onClick={addStaff}
          disabled={!staffDraft.firstName.trim() || !staffDraft.lastName.trim()}
        >
          {editingId ? "Save staff" : "Add staff"}
        </Button>
      </div>
      {staffError ? (
        <p className="text-xs text-danger" role="alert">
          {staffError}
        </p>
      ) : null}
      {createdPin ? <p className="text-xs text-muted-foreground">Created PIN {createdPin}.</p> : null}
    </div>
  );

  if (peopleOnly) {
    return (
      <div className="flex h-full flex-col" data-demo="operator-ops" data-staff-people="">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Staff</h2>
          <p className="text-xs text-muted-foreground">People, PINs, and roles for {vendor.name}.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <ul className="divide-y divide-border text-sm">
            {stats.staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {staffListTitle(s)}{" "}
                  <span className="text-muted-foreground">
                    · {ROLE_LABEL[s.role]}
                    {s.title ? ` · ${s.title}` : ""}
                    {s.employmentStatus && s.employmentStatus !== "active" ? ` · ${s.employmentStatus}` : ""}
                    · {s.pinHash || s.pin ? "PIN set" : "No PIN"}
                  </span>
                </span>
                {canStaff ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(s.id);
                      setStaffRole(s.role);
                      setStaffError(null);
                      setStaffDraft({
                        firstName: s.firstName || "",
                        lastName: s.lastName || "",
                        displayName: s.displayName || "",
                        employeeNumber: s.employeeNumber || "",
                        payRateType: s.payRateType === "salary" ? "salary" : "hourly",
                        payAmount: s.payRateCents ? (s.payRateCents / 100).toFixed(2) : "",
                        hireDate: s.hireDate || "",
                        employmentStatus: s.employmentStatus || "active",
                        email: s.email || "",
                        phone: s.phone || "",
                        position: s.title || "",
                      });
                    }}
                  >
                    Edit
                  </Button>
                ) : null}
              </li>
            ))}
            {stats.staff.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">No staff on this entity yet.</li>
            )}
          </ul>
          {canStaff && staffEditor(FLOOR_ROLES)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-demo="operator-ops">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Operator ops</h2>
          <Badge variant="info">{isGuest ? "Your stall" : "Host viewing operator"}</Badge>
        </div>
        {logoWrite && locId && (
          <div className="mt-3">
            <BrandLogoField
              locationId={locId}
              operatorId={vendor.id}
              label="Entity logo"
              hint="Above this entity’s items on the guest check and paid receipt, on this back office, and under the house name on the QR page."
              write
            />
          </div>
        )}
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
        {hostManaged && settings.taxMode === "per_entity" && (
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <p className="text-sm font-medium">Taxes</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={!settings.entityTaxRates?.[vendor.id]}
                onChange={(e) => {
                  const entityTaxRates = { ...(settings.entityTaxRates ?? {}) };
                  if (e.target.checked) delete entityTaxRates[vendor.id];
                  else entityTaxRates[vendor.id] = resolveVenueTaxRates(settings);
                  updateSettings({ entityTaxRates });
                  persistTaxRates();
                }}
              />
              Inherit venue rates
            </label>
            {settings.entityTaxRates?.[vendor.id] && (
              <TaxRatesEditor
                rates={settings.entityTaxRates[vendor.id] ?? []}
                onChange={(next) => {
                  const entityTaxRates = {
                    ...(settings.entityTaxRates ?? {}),
                    [vendor.id]: ratesPatch(next).taxRates,
                  };
                  updateSettings({ entityTaxRates });
                  persistTaxRates();
                }}
              />
            )}
          </div>
        )}
        <QuantumPaymentsOnboardPanel
          kind="operator"
          operatorId={vendor.id}
          locationId={locId || undefined}
          legalName={vendor.name}
        />
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
          <Tile label="Open ODS tickets" value={String(stats.openTickets)} />
          <Tile label="Staff on this stall" value={String(stats.staff.length)} />
          <Tile label="Share income" value={formatCurrency(stats.pnl?.drinkShareIncomeCents ?? 0)} />
          <Tile label="Share expense" value={formatCurrency(stats.pnl?.drinkShareExpenseCents ?? 0)} />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h4 className="mb-1 text-sm font-semibold">Revenue share</h4>
          <p className="mb-2 text-xs text-muted-foreground">
            View only. Location main contact sets the rate. This does not change the guest check or the card split.
          </p>
          {stats.rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inbound or outbound rules for this entity.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.rules.map((rule) => (
                <li key={rule.id}>
                  {rule.fromEntityId === vendor.id ? "You pay" : "You receive"} ·{" "}
                  {ruleSummary(rule, (id) => vendors.find((v) => v.id === id)?.name || id)}
                </li>
              ))}
            </ul>
          )}
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
                  {staffListTitle(s)}{" "}
                  <span className="text-muted-foreground">
                    · {ROLE_LABEL[s.role]}
                    {s.title ? ` · ${s.title}` : ""}
                    {s.employmentStatus && s.employmentStatus !== "active" ? ` · ${s.employmentStatus}` : ""}
                    · {s.pinHash || s.pin ? "PIN set" : "No PIN"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  {canStaff ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(s.id);
                        setStaffRole(s.role);
                        setStaffError(null);
                        setStaffDraft({
                          firstName: s.firstName || "",
                          lastName: s.lastName || "",
                          displayName: s.displayName || "",
                          employeeNumber: s.employeeNumber || "",
                          payRateType: s.payRateType === "salary" ? "salary" : "hourly",
                          payAmount: s.payRateCents ? (s.payRateCents / 100).toFixed(2) : "",
                          hireDate: s.hireDate || "",
                          employmentStatus: s.employmentStatus || "active",
                          email: s.email || "",
                          phone: s.phone || "",
                          position: s.title || "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  <Button size="sm" variant={s.clockedIn ? "default" : "outline"} onClick={() => clockToggle(s.id)}>
                    {s.clockedIn ? "Clock out" : "Clock in"}
                  </Button>
                </span>
              </li>
            ))}
            {stats.staff.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">No staff on this operator yet.</li>
            )}
          </ul>
          {canStaff && <div className="mt-3">{staffEditor(["kitchen", "bartender"])}</div>}
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
