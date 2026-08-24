import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import {
  policyOf,
  SECTION_ENFORCE_ROLES,
} from "@/lib/pos/section-control";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { canEmployee } from "@/lib/access/permissions";
import {
  SETTINGS_PACK_LABEL,
  VENUE_TYPE_LABEL,
  settingsPacksForVenue,
  type SettingsPackId,
} from "@/lib/access/entity-roles";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";
import type { VenueEntityId } from "@/lib/pos/types";
import {
  useNetworkStore,
  worksWithoutInternet,
  waitsForInternet,
  OUTBOX_KIND_LABEL,
  type FabricPolicy,
} from "@/lib/pos/network-store";
import { formatCurrency, formatTime } from "@/lib/utils";
import { isDevDemoClient } from "@/lib/saas/flags";
import { SetupAssistButton } from "@/components/assist/SetupAssistDialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { saveFrontSettingsFn } from "@/lib/front/api";
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

function Pack({
  id,
  packs,
  children,
}: {
  id: SettingsPackId;
  packs: SettingsPackId[];
  children: React.ReactNode;
}) {
  if (!packs.includes(id)) return null;
  return (
    <section className="mb-6 max-w-2xl rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium">{SETTINGS_PACK_LABEL[id]}</p>
      {children}
    </section>
  );
}

export function SettingsView() {
  const settings = usePosStore((s) => s.settings);
  const locId = usePosStore((s) => s.tenantLocationId) || "loc_kiosk";
  const entityId = usePosStore((s) => s.activeEntityId) as VenueEntityId | undefined;
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orgId = useSaasStore((s) => s.org.id);
  const write = canEmployee(emp, "settings:write");
  const packs = settingsPacksForVenue(entityId);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const persist = () => {
    if (!write || isProspectDemo() || !orgId) return;
    void saveLocationSettingsFn({
      data: {
        orgId,
        locationId: locId,
        setup: {
          hostBrandName: settings.name,
          timezone: settings.timezone,
          hoursNote: settings.hoursNote,
          tipPooling: settings.tipPooling,
          tabAutoCloseMinutes: settings.tabAutoCloseMinutes,
          ticketPrefix: settings.ticketPrefix,
          kioskMode: settings.kioskMode,
          waitlistEnabled: settings.waitlistEnabled,
          reservationCheckIn: settings.reservationCheckIn,
          waitlistReason: settings.waitlistReason,
          devices: { pos: 0, kds: 0, handhelds: 0 },
          settlement: {
            periodType: "weekly",
            hostCutPercent: 0,
          },
        },
      },
    }).catch(() => undefined);
  };
  const saveFront = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
    void saveFrontSettingsFn({
      data: {
        locationId: locId,
        kioskMode: (patch.kioskMode ?? settings.kioskMode) as
          | "order"
          | "checkin"
          | "combined"
          | undefined,
        waitlistEnabled:
          patch.waitlistEnabled ?? settings.waitlistEnabled,
        smsFrom: patch.smsFrom ?? settings.smsFrom,
      },
    }).catch(() => undefined);
  };
  const updateSectionPolicy = usePosStore((s) => s.updateSectionPolicy);
  const resetDemo = usePosStore((s) => s.resetDemo);
  const loadLaundryTestVenue = usePosStore((s) => s.loadLaundryTestVenue);
  const setView = usePosStore((s) => s.setView);
  const policy = policyOf(settings.sectionPolicy);

  const toggleRole = (role: EmployeeRole, on: boolean) => {
    const next = on
      ? Array.from(new Set([...policy.enforceForRoles, role]))
      : policy.enforceForRoles.filter((r) => r !== role);
    updateSectionPolicy({ enforceForRoles: next });
  };

  if (!canEmployee(emp, "settings:read") && !write) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        Location settings are for owner and manager.
      </div>
    );
  }

  const typeLabel = entityId ? VENUE_TYPE_LABEL[entityId] : "Location";

  return (
    <div className="h-full overflow-y-auto p-3" data-demo="settings">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Location settings</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {typeLabel}
        </span>
        <SetupAssistButton domain="location" />
        <SetupAssistButton domain="cash_discount" label="Describe cash discount" />
        <SetupAssistButton domain="station" label="Routing" />
        {write && !isProspectDemo() && (
          <Button size="sm" variant="outline" onClick={persist}>
            Save to location
          </Button>
        )}
      </div>
      <fieldset disabled={!write} className="min-w-0 border-0 p-0">

      <Pack id="profile" packs={packs}>
      <div className="grid gap-4">
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.waitlistEnabled}
            onChange={(e) =>
              saveFront({ waitlistEnabled: e.target.checked })
            }
            className="h-4 w-4 rounded border-border"
          />
          Waitlist enabled at kiosk
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Kiosk mode</span>
          <select
            className="h-9 w-full max-w-xs rounded-md border border-border bg-bg px-2 text-sm"
            value={settings.kioskMode ?? "combined"}
            onChange={(e) =>
              saveFront({
                kioskMode: e.target.value as "order" | "checkin" | "combined",
              })
            }
          >
            <option value="order">Order kiosk</option>
            <option value="checkin">Waitlist + reservation check-in</option>
            <option value="combined">Combined (Order | Check in | Waitlist)</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">SMS from (optional)</span>
          <Input
            value={settings.smsFrom ?? ""}
            onChange={(e) => saveFront({ smsFrom: e.target.value })}
            placeholder="+1…"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Guest kiosk: /kiosk — Twilio keys optional; sandbox logs messages on Host stand.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Hours</span>
          <Input
            value={settings.hoursNote ?? ""}
            onChange={(e) => updateSettings({ hoursNote: e.target.value })}
            placeholder="Tue–Sat 17:00–23:00"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Timezone</span>
          <Input
            value={settings.timezone ?? "America/Los_Angeles"}
            onChange={(e) => updateSettings({ timezone: e.target.value })}
          />
        </label>
      </div>
      </Pack>

        <Pack id="cash_discount" packs={packs}>
        <div>
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
        </Pack>

      <Pack id="sections" packs={packs}>
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
      </Pack>

      <Pack id="bar_tabs" packs={packs}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Tab auto-close (minutes, 0 = off)</span>
          <Input
            inputMode="numeric"
            value={String(settings.tabAutoCloseMinutes ?? 0)}
            onChange={(e) =>
              updateSettings({ tabAutoCloseMinutes: parseInt(e.target.value, 10) || 0 })
            }
          />
        </label>
      </Pack>

      <Pack id="counter_expo" packs={packs}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Ticket prefix</span>
          <Input
            value={settings.ticketPrefix ?? ""}
            onChange={(e) => updateSettings({ ticketPrefix: e.target.value.slice(0, 8) })}
            placeholder="Q-"
          />
        </label>
      </Pack>

      <Pack id="host_operators" packs={packs}>
        <p className="text-xs text-muted-foreground">
          Operators, station ownership, period close, and host cut live on Settle.
          Guest cards stay Quantum Payments under the host brand.
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setView("settlement")}>
          Open settlement
        </Button>
      </Pack>

      <Pack id="devices" packs={packs}>
      <NetworkSettingsPanel />
      </Pack>

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

      </fieldset>

      {isDevDemoClient() && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <p className="mb-2 text-sm font-medium">Demo data · TEST venue</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Reload The Laundry (host) with Steam Distillery (bar) and Diamond House
            BBQ (kitchen). Hidden when DEV_DEMO=0. Production empty-start never
            seeds this dataset.
          </p>
          <div className="mb-3">
            <GuideLearnLink topicId="laundry-test-venue" compact>
              Learn
            </GuideLearnLink>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => loadLaundryTestVenue()}>
              Load The Laundry test venue
            </Button>
            <Button variant="destructive" onClick={() => resetDemo()}>
              Reset POS demo
            </Button>
          </div>
        </div>
      )}
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
  const flush = useNetworkStore((s) => s.flushOutboxNow);
  const dead = useNetworkStore((s) => s.deadCount());
  const syncing = useNetworkStore((s) => s.syncing);

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
        {pending > 0 ? ` · ${pending} items queued` : ""}
        {dead > 0 ? ` · ${dead} failed to sync` : ""}
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
          hint="House Wi‑Fi stays up. Cash still closes. Card requires connection. Outbox syncs when you turn this off."
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
              <Button size="sm" variant="outline" onClick={() => void flush()} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
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
                  className={
                    o.status === "queued" || o.status === "syncing"
                      ? "text-warn"
                      : o.status === "dead"
                        ? "text-danger"
                        : "text-success"
                  }
                >
                  {o.status}{o.status === "dead" && o.lastError ? ` · ${o.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
