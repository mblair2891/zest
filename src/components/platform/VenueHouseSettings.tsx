import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { saveLocationSettingsFn, publishLocationFn } from "@/lib/access/api";
import { persistCashDiscount, persistQrPolicy } from "@/lib/pos/persist-location-setup";
import { isProspectDemo } from "@/lib/demo/session";
import { CASH_ROUND_INCREMENTS, SERVICE_STYLES_VENUE, TAX_MODES } from "@/lib/saas/venue-entity";
import { parseQrMode } from "@/lib/pos/qr-table";
import { parseQrPolicy, QR_FLAG_LABEL, QR_MODE_FLAGS, type QrModeFlag } from "@/lib/pos/qr-policy";
import { canEmployee } from "@/lib/access/permissions";
import { useState } from "react";
import type { CashRoundIncrement } from "@/lib/pos/types";

const STYLE_LABEL: Record<(typeof SERVICE_STYLES_VENUE)[number], string> = {
  full_service: "Full service floor",
  counter: "Counter",
  hybrid: "Hybrid",
  drive_through: "Drive-through",
};

const TAX_LABEL: Record<(typeof TAX_MODES)[number], string> = {
  venue_shared: "Venue shared",
  per_entity: "Per entity",
};

/**
 * Venue / building settings. No host-merchant payout or Finix-on-venue.
 * Peer venues (hostEntityId null) must render without a setState loop.
 */
export function VenueHouseSettings() {
  const settings = usePosStore((s) => s.settings);
  const sections = usePosStore((s) => s.floorSections);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orgId = useSaasStore((s) => s.org.id);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const write = canEmployee(emp, "settings:write");
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = (patch: Record<string, unknown>) => {
    if (!write || isProspectDemo() || !orgId || !locId) return;
    const setup: Record<string, unknown> = { ...patch };
    if (peer) {
      setup.peerVenue = true;
      setup.operatingModel = "peer_venue";
      setup.hostEntityId = null;
    }
    void saveLocationSettingsFn({
      data: { orgId, locationId: locId, setup: setup as never },
    }).catch(() => undefined);
  };

  const qrPolicy = parseQrPolicy(settings.qrPolicy, settings.qrMode);
  const style = settings.serviceStyle ?? "full_service";
  const taxMode = settings.taxMode === "per_entity" ? "per_entity" : "venue_shared";

  const publish = async () => {
    if (!orgId || !locId) return;
    setBusy(true);
    setPublishMsg(null);
    try {
      const res = await publishLocationFn({
        data: { orgId, locationId: locId },
      });
      setPublishMsg(`Published v${res.publish.version}. Idle PIN pads pick it up.`);
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-demo="venue-house-settings">
      <div>
        <h2 className="text-sm font-semibold">Venue settings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {peer
            ? "Building only — no host merchant, no Finix on the venue, no host payouts. Each selling entity keeps its own menu, payments, labor, and tips."
            : "House settings for this location. Entity Finix, menus, and labor stay on each selling entity."}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Profile</p>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Name</span>
          <Input
            value={settings.name}
            disabled={!write}
            onChange={(e) => updateSettings({ name: e.target.value })}
            onBlur={() => persist({ hostBrandName: settings.name })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Address</span>
          <Input
            value={settings.address}
            disabled={!write}
            onChange={(e) => updateSettings({ address: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Timezone</span>
          <Input
            value={settings.timezone ?? "America/Los_Angeles"}
            disabled={!write}
            onChange={(e) => {
              updateSettings({ timezone: e.target.value });
              persist({ timezone: e.target.value });
            }}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Service & tax</p>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Service style</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write}
            value={style}
            onChange={(e) => {
              const serviceStyle = e.target.value as (typeof SERVICE_STYLES_VENUE)[number];
              updateSettings({ serviceStyle });
              persist({ serviceStyle });
            }}
          >
            {SERVICE_STYLES_VENUE.map((id) => (
              <option key={id} value={id}>
                {STYLE_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Tax mode</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write}
            value={taxMode}
            onChange={(e) => {
              const taxMode = e.target.value === "per_entity" ? "per_entity" : "venue_shared";
              updateSettings({ taxMode });
              persist({ taxMode });
            }}
          >
            {TAX_MODES.map((id) => (
              <option key={id} value={id}>
                {TAX_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Cash discount</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            disabled={!write}
            checked={!!settings.cashDiscountEnabled}
            onChange={(e) => {
              updateSettings({ cashDiscountEnabled: e.target.checked });
              persistCashDiscount();
            }}
          />
          Offer a cash discount
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Guest card rate (%)</span>
          <Input
            inputMode="decimal"
            disabled={!write || !settings.cashDiscountEnabled}
            value={String(settings.cashDiscountPercent ?? 5)}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              updateSettings({
                cashDiscountPercent: Number.isFinite(n)
                  ? Math.round(Math.min(30, Math.max(0, n)) * 100) / 100
                  : 5,
              });
            }}
            onBlur={() => persistCashDiscount()}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Round up to</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write || !settings.cashDiscountEnabled}
            value={String(settings.cashRoundIncrement ?? 0.25)}
            onChange={(e) => {
              updateSettings({
                cashRoundIncrement: Number(e.target.value) as CashRoundIncrement,
              });
              persistCashDiscount();
            }}
          >
            {CASH_ROUND_INCREMENTS.map((n) => (
              <option key={n} value={n}>
                ${n.toFixed(2)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">QR</p>
        <div className="grid gap-2">
          {QR_MODE_FLAGS.map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                disabled={!write}
                checked={qrPolicy.flags.includes(flag)}
                onChange={(e) => {
                  const flags = e.target.checked
                    ? ([...qrPolicy.flags, flag] as QrModeFlag[])
                    : (qrPolicy.flags.filter((f) => f !== flag) as QrModeFlag[]);
                  updateSettings({ qrPolicy: { ...qrPolicy, flags }, qrMode: parseQrMode(settings.qrMode) });
                  persistQrPolicy();
                }}
              />
              {QR_FLAG_LABEL[flag]}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Sections</p>
        {sections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sections yet. Draw them on Floor.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <li
                key={s.id}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Waitlist & kiosk</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            disabled={!write}
            checked={!!settings.waitlistEnabled}
            onChange={(e) => {
              updateSettings({ waitlistEnabled: e.target.checked });
              persist({ waitlistEnabled: e.target.checked });
            }}
          />
          Waitlist enabled
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Kiosk mode</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write}
            value={settings.kioskMode ?? "combined"}
            onChange={(e) => {
              const kioskMode = e.target.value as "order" | "checkin" | "combined";
              updateSettings({ kioskMode });
              persist({ kioskMode });
            }}
          >
            <option value="order">Order</option>
            <option value="checkin">Check-in</option>
            <option value="combined">Combined</option>
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Publish</p>
        <p className="text-xs text-muted-foreground">
          Push the catalog to paired stations. Pair tablets on the Devices tab.
        </p>
        <Button size="sm" disabled={!write || busy} onClick={() => void publish()}>
          Publish to stations
        </Button>
        {publishMsg && <p className="text-xs text-muted-foreground">{publishMsg}</p>}
      </section>
    </div>
  );
}
