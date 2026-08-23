import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import {
  policyOf,
  SECTION_ENFORCE_ROLES,
} from "@/lib/pos/section-control";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import {
  useNetworkStore,
  worksWithoutInternet,
  waitsForInternet,
  OUTBOX_KIND_LABEL,
  type FabricPolicy,
} from "@/lib/pos/network-store";
import { formatCurrency, formatTime } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  CASH_ROUND_INCREMENTS,
  cashPriceCents,
  cashPolicyFromSettings,
  type CashRoundIncrement,
} from "@/lib/pos/cash-discount";

function PolicyCheck({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
      />
      <span>
        {label}
        {hint && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function SettingsView() {
  const settings = usePosStore((s) => s.settings);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const updateSectionPolicy = usePosStore((s) => s.updateSectionPolicy);
  const resetDemo = usePosStore((s) => s.resetDemo);
  const setView = usePosStore((s) => s.setView);
  const policy = policyOf(settings.sectionPolicy);

  const toggleRole = (role: EmployeeRole, on: boolean) => {
    const next = on
      ? Array.from(new Set([...policy.enforceForRoles, role]))
      : policy.enforceForRoles.filter((r) => r !== role);
    updateSectionPolicy({ enforceForRoles: next });
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <h2 className="mb-4 text-sm font-semibold">Restaurant & platform settings</h2>

      <div className="mb-6 grid max-w-2xl gap-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Name</span>
          <Input
            value={settings.name}
            onChange={(e) => updateSettings({ name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Address</span>
          <Input
            value={settings.address}
            onChange={(e) => updateSettings({ address: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Phone</span>
          <Input
            value={settings.phone}
            onChange={(e) => updateSettings({ phone: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tax rate (%)</span>
            <Input
              inputMode="decimal"
              value={(settings.taxRate * 100).toFixed(3)}
              onChange={(e) =>
                updateSettings({
                  taxRate: (parseFloat(e.target.value) || 0) / 100,
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Auto-grat (%)</span>
            <Input
              inputMode="decimal"
              value={(settings.autoGratPercent * 100).toFixed(0)}
              onChange={(e) =>
                updateSettings({
                  autoGratPercent: (parseFloat(e.target.value) || 0) / 100,
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Auto-grat party size
            </span>
            <Input
              inputMode="numeric"
              value={String(settings.autoGratPartySize)}
              onChange={(e) =>
                updateSettings({
                  autoGratPartySize: parseInt(e.target.value, 10) || 6,
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Manager PIN</span>
            <Input
              value={settings.managerPin}
              onChange={(e) =>
                updateSettings({
                  managerPin: e.target.value.replace(/\D/g, "").slice(0, 6),
                })
              }
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Receipt footer</span>
          <Input
            value={settings.receiptFooter}
            onChange={(e) => updateSettings({ receiptFooter: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.happyHourEnabled}
            onChange={(e) =>
              updateSettings({ happyHourEnabled: e.target.checked })
            }
            className="h-4 w-4 rounded border-border"
          />
          Happy hour enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.onlineOrderingEnabled}
            onChange={(e) =>
              updateSettings({ onlineOrderingEnabled: e.target.checked })
            }
            className="h-4 w-4 rounded border-border"
          />
          Online ordering enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.multiTenantHallMode}
            onChange={(e) =>
              updateSettings({ multiTenantHallMode: e.target.checked })
            }
            className="h-4 w-4 rounded border-border"
          />
          Multi-tenant food hall mode
        </label>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Cash discount</p>
            <GuideLearnLink topicId="cash-discount" compact>
              Learn
            </GuideLearnLink>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Printed / card prices stay clean. Cash is discounted then rounded{" "}
            <span className="font-medium text-foreground">up</span> to the
            increment — no pennies. This location is responsible for local
            cash-discount rules.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!settings.cashDiscountEnabled}
              onChange={(e) =>
                updateSettings({ cashDiscountEnabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Offer a cash discount
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Discount (%)
              </span>
              <Input
                inputMode="decimal"
                disabled={!settings.cashDiscountEnabled}
                value={String(settings.cashDiscountPercent ?? 5)}
                onChange={(e) =>
                  updateSettings({
                    cashDiscountPercent: Math.max(
                      0,
                      parseFloat(e.target.value) || 0,
                    ),
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Round up to
              </span>
              <select
                className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                disabled={!settings.cashDiscountEnabled}
                value={String(settings.cashRoundIncrement ?? 0.25)}
                onChange={(e) =>
                  updateSettings({
                    cashRoundIncrement: Number(
                      e.target.value,
                    ) as CashRoundIncrement,
                  })
                }
              >
                {CASH_ROUND_INCREMENTS.map((n) => (
                  <option key={n} value={n}>
                    ${n.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {settings.cashDiscountEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Example: $12.00 card →{" "}
              <span className="tabular text-foreground">
                {formatCurrency(
                  cashPolicyFromSettings(settings)
                    ? cashPriceCents(1200, cashPolicyFromSettings(settings)!)
                    : 1200,
                )}
              </span>{" "}
              cash.
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 max-w-2xl rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Section control</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Limit who can seat and enter orders outside their assigned section.
          Assign sections on Staff. Colors show on the floor map.
        </p>
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Enforce for roles
          </p>
          <div className="flex flex-wrap gap-3">
            {SECTION_ENFORCE_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={policy.enforceForRoles.includes(role)}
                  onChange={(e) => toggleRole(role, e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {ROLE_LABEL[role]}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <PolicyCheck
            checked={policy.serversCannotOrderOutsideSection}
            onChange={(v) =>
              updateSectionPolicy({ serversCannotOrderOutsideSection: v })
            }
            label="Cannot enter orders in another section"
            hint="Locked roles cannot add items on a table they do not cover."
          />
          <PolicyCheck
            checked={policy.serversCannotSeatOutsideSection}
            onChange={(v) =>
              updateSectionPolicy({ serversCannotSeatOutsideSection: v })
            }
            label="Cannot seat a table in another section"
          />
          <PolicyCheck
            checked={policy.extraTableGrantsEnabled}
            onChange={(v) =>
              updateSectionPolicy({ extraTableGrantsEnabled: v })
            }
            label="Allow a single extra table"
            hint="Managers can grant one table in another section for the shift, or just that seating."
          />
          <PolicyCheck
            checked={policy.allowViewOnlyOutside}
            onChange={(v) => updateSectionPolicy({ allowViewOnlyOutside: v })}
            label="View-only on other sections"
            hint="Staff can open a check to look, but cannot add items."
          />
          <PolicyCheck
            checked={policy.hideUnassignedSections}
            onChange={(v) =>
              updateSectionPolicy({ hideUnassignedSections: v })
            }
            label="Hide sections the server is not assigned to"
          />
          <PolicyCheck
            checked={policy.allowManagerOverride}
            onChange={(v) => updateSectionPolicy({ allowManagerOverride: v })}
            label="Allow manager PIN override for this login"
          />
          <PolicyCheck
            checked={policy.lockBartenderToAssigned}
            onChange={(v) =>
              updateSectionPolicy({ lockBartenderToAssigned: v })
            }
            label="Lock bartenders to their assigned section"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => setView("employees")}
        >
          Assign sections on Staff
        </Button>
      </div>

      <NetworkSettingsPanel />

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Modules</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["hq", "HQ"],
              ["package", "Full package"],
              ["settlement", "Vendor settlement"],
              ["features", "All features matrix"],
              ["vendor_portal", "Vendor portal"],
              ["integrations", "Integrations"],
              ["customers", "Guests & gift cards"],
              ["online", "Online orders"],
              ["hall", "Food hall"],
              ["floor_editor", "Floor editor"],
              ["payouts", "Payouts"],
              ["schedule", "Schedule"],
              ["promos", "Promos"],
              ["catering", "Catering"],
              ["recipes", "Recipes"],
              ["purchasing", "Purchasing"],
              ["delivery", "Delivery"],
              ["campaigns", "Campaigns"],
              ["checklists", "Checklists"],
              ["reports", "Reports"],
              ["inventory", "Inventory"],
              ["menu", "Menu / 86"],
              ["employees", "Staff"],
              ["customers", "Guests"],
              ["cash", "Cash drawer"],
            ] as [PosView, string][]
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant="outline"
              onClick={() => setView(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <a
          href="/online"
          className="mt-3 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Open guest online ordering →
        </a>
      </div>

      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="mb-2 text-sm font-medium">Demo data</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Reset clears POS floor/orders (v2 store). Platform tenants & online
          orders use a separate store — clear site data for a full wipe.
        </p>
        <Button variant="destructive" onClick={() => resetDemo()}>
          Reset POS demo
        </Button>
      </div>
    </div>
  );
}

function NetworkSettingsPanel() {
  const policy = useNetworkStore((s) => s.policy);
  const setPolicy = useNetworkStore((s) => s.setPolicy);
  const role = useNetworkStore((s) => s.deviceRole);
  const setRole = useNetworkStore((s) => s.setDeviceRole);
  const houseSsid = useNetworkStore((s) => s.houseSsid);
  const guestSsid = useNetworkStore((s) => s.guestSsid);
  const setSsids = useNetworkStore((s) => s.setSsids);
  const isolated = useNetworkStore((s) => s.isolatedGuest);
  const setIsolated = useNetworkStore((s) => s.setIsolatedGuest);
  const simulateWan = useNetworkStore((s) => s.simulateWanDown);
  const setSimulateWan = useNetworkStore((s) => s.setSimulateWanDown);
  const simulateLan = useNetworkStore((s) => s.simulateLanDown);
  const setSimulateLan = useNetworkStore((s) => s.setSimulateLanDown);
  const wan = useNetworkStore((s) => s.wanOnline());
  const lan = useNetworkStore((s) => s.lanOnline());
  const pending = useNetworkStore((s) => s.pendingCount());
  const outbox = useNetworkStore((s) => s.outbox);
  const lastSyncAt = useNetworkStore((s) => s.lastSyncAt);
  const flush = useNetworkStore((s) => s.flushOutbox);

  return (
    <div className="mb-6 max-w-2xl rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">House network · WiFi first</p>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Summex does not need a private Ethernet drop at every station. One
        business access point runs a staff SSID. Devices talk to the house
        hub over that WiFi. Internet is only the uplink — when the ISP dies,
        the floor, KDS, and cash drawer keep going.
      </p>
      <p className="mb-3 text-xs">
        Status:{" "}
        <strong>
          {wan ? "Internet up" : lan ? "WiFi up · no internet" : "No WiFi"}
        </strong>
        {pending > 0 ? ` · ${pending} cloud items queued` : ""}
        {lastSyncAt ? ` · last sync ${formatTime(lastSyncAt)}` : ""}
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fabric</span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
            value={policy}
            onChange={(e) => setPolicy(e.target.value as FabricPolicy)}
          >
            <option value="wifi_only">WiFi only (recommended)</option>
            <option value="wifi_preferred">WiFi first, Ethernet optional</option>
            <option value="wired_ok">Allow wired stations</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">This device</span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "hub" | "satellite")
            }
          >
            <option value="hub">House hub (source of truth)</option>
            <option value="satellite">Satellite (handheld / KDS)</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Staff SSID</span>
          <Input
            value={houseSsid}
            onChange={(e) => setSsids(e.target.value, guestSsid)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Guest SSID</span>
          <Input
            value={guestSsid}
            onChange={(e) => setSsids(houseSsid, e.target.value)}
            disabled={!isolated}
          />
        </label>
      </div>
      <div className="mb-3 grid gap-2">
        <PolicyCheck
          checked={isolated}
          onChange={setIsolated}
          label="Keep guest WiFi off the POS network"
          hint="Staff SSID only for terminals, KDS, printers, and card readers."
        />
        <PolicyCheck
          checked={simulateWan}
          onChange={setSimulateWan}
          label="Simulate internet outage"
          hint="House WiFi stays up. Card captures queue until you turn this off."
        />
        <PolicyCheck
          checked={simulateLan}
          onChange={setSimulateLan}
          label="Simulate access point down"
          hint="This terminal keeps its local checks. Other stations go dark."
        />
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Works on house WiFi
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {worksWithoutInternet().map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Queued until internet
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {waitsForInternet().map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
      {outbox.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cloud queue
            </p>
            {wan && pending > 0 && (
              <Button size="sm" variant="outline" onClick={() => flush()}>
                Sync now
              </Button>
            )}
          </div>
          <ul className="space-y-1 text-xs">
            {outbox.slice(0, 8).map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <span>
                  {OUTBOX_KIND_LABEL[o.kind]} · {o.label}
                </span>
                <span
                  className={o.status === "queued" ? "text-warn" : "text-success"}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
