import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { saveLocationSettingsFn, publishLocationFn } from "@/lib/access/api";
import {
  confirmCashDiscountRecalc,
  flushLocationCatalog,
  persistCashDiscount,
  persistHostStandPolicy,
  persistQrPolicy,
} from "@/lib/pos/persist-location-setup";
import { isProspectDemo } from "@/lib/demo/session";
import { CASH_ROUND_INCREMENTS, SERVICE_STYLES_VENUE, TAX_MODES } from "@/lib/saas/venue-entity";
import { parseQrMode } from "@/lib/pos/qr-table";
import { parseQrPolicy, QR_FLAG_LABEL, QR_MODE_FLAGS, type QrModeFlag } from "@/lib/pos/qr-policy";
import { canEmployee } from "@/lib/access/permissions";
import { useEffect, useState } from "react";
import type { CashRoundIncrement } from "@/lib/pos/types";
import { TaxRatesEditor, ratesPatch } from "@/components/pos/TaxRatesSettings";
import { noteChecklistSave } from "@/lib/saas/checklist-link";
import { saveLocationProfileChecklist, useOnboardingStore } from "@/lib/saas/onboarding-state";
import {
  DEFAULT_VENUE_TIMEZONE,
  VENUE_TIMEZONES,
  guessTimezoneFromAddress,
  parseVenueTimezone,
} from "@/lib/pos/venue-time";
import { persistTaxRates } from "@/lib/pos/persist-location-setup";
import { JurisdictionFields } from "@/components/pos/SettingsView";
import { BrandLogoField } from "@/components/brand/BrandLogoField";


const STYLE_LABEL: Record<(typeof SERVICE_STYLES_VENUE)[number], string> = {
  full_service: "Full service floor",
  counter: "Counter",
  hybrid: "Hybrid",
  drive_through: "Drive-through",
  serverless_food: "Serverless food + served drinks",
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
  const vendors = usePosStore((s) => s.vendors);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const checklist = useOnboardingStore((s) => (s.locationId === locId ? s.layer : null));
  const [contactName, setContactName] = useState(checklist?.location.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(checklist?.location.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(checklist?.location.contactPhone ?? "");
  useEffect(() => {
    if (!checklist) return;
    setContactName(checklist.location.contactName);
    setContactEmail(checklist.location.contactEmail);
    setContactPhone(checklist.location.contactPhone);
  }, [checklist]);

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
      await flushLocationCatalog("floor");
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
        <BrandLogoField
          locationId={locId}
          operatorId=""
          label="Location logo"
          hint="QR pay page, order and host tablet header, location back office, and location emails. The slip header stays the building name."
          write
        />
        {vendors.map((v) => (
          <BrandLogoField
            key={v.id}
            locationId={locId}
            operatorId={v.id}
            label={`${v.name} logo`}
            hint="Guest check and paid receipt, this entity’s back office, and the QR page under the house name."
            write
          />
        ))}
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Name</span>
          <Input
            value={settings.name}
            disabled={!write}
            data-checklist-focus="location-contact"
            onChange={(e) => updateSettings({ name: e.target.value })}
            onBlur={() => {
              persist({ hostBrandName: settings.name });
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Address</span>
          <Input
            value={settings.address}
            disabled={!write}
            data-checklist-focus="address"
            onChange={(e) => updateSettings({ address: e.target.value })}
            onBlur={() => {
              const guessed = guessTimezoneFromAddress(settings.address);
              const cur = parseVenueTimezone(settings.timezone);
              if (!settings.timezone || cur === DEFAULT_VENUE_TIMEZONE) {
                updateSettings({ timezone: guessed });
                persist({ timezone: guessed });
              }
            }}
          />
        </label>
        <JurisdictionFields write={write} />
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Location timezone (IANA)</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write}
            data-checklist-focus="timezone"
            value={parseVenueTimezone(settings.timezone)}
            onChange={(e) => {
              updateSettings({ timezone: e.target.value });
              persist({ timezone: e.target.value });
            }}
          >
            {(VENUE_TIMEZONES as readonly string[])
              .concat(
                settings.timezone &&
                  !VENUE_TIMEZONES.includes(settings.timezone as (typeof VENUE_TIMEZONES)[number])
                  ? [parseVenueTimezone(settings.timezone)]
                  : [],
              )
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Default from address; editable. Tickets and reports use this zone, not the tablet.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Main contact name</span>
          <Input value={contactName} disabled={!write} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Main contact email</span>
          <Input value={contactEmail} disabled={!write} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Main contact phone</span>
          <Input value={contactPhone} disabled={!write} onChange={(e) => setContactPhone(e.target.value)} />
        </label>
        <Button
          type="button"
          disabled={!write || busy}
          data-checklist-profile-save
          onClick={() => {
            const name = contactName.trim() || settings.name.trim();
            const email = contactEmail.trim();
            const phone = contactPhone.trim();
            persist({
              hostBrandName: settings.name,
              address: settings.address,
              timezone: parseVenueTimezone(settings.timezone),
            });
            void saveLocationProfileChecklist({
              orgId,
              locationId: locId,
              peer,
              filled: {
                contact: Boolean(name && email && phone),
                address: Boolean(settings.address.trim()),
                timezone: Boolean(parseVenueTimezone(settings.timezone)),
              },
              contact: { name, email, phone },
            }).then(() => {
              setProfileMsg("Profile saved. Contact, address, and timezone update together on the checklist.");
            });
          }}
        >
          Save profile
        </Button>
        {profileMsg ? <p className="text-xs text-primary">{profileMsg}</p> : null}
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
        {style === "serverless_food" && (
          <div className="grid gap-3" data-serverless-food="">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-guest-may-order-drinks=""
                disabled={!write}
                checked={settings.guestMayOrderDrinks === true}
                onChange={(e) => {
                  updateSettings({ guestMayOrderDrinks: e.target.checked });
                  persist({ guestMayOrderDrinks: e.target.checked });
                }}
              />
              Guest may order drinks
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Pickup label</span>
              <Input
                data-pickup-label=""
                disabled={!write}
                value={settings.pickupLabel ?? ""}
                placeholder="counter"
                onChange={(e) => {
                  const pickupLabel = e.target.value.slice(0, 40);
                  updateSettings({ pickupLabel });
                  persist({ pickupLabel });
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Remind by text after minutes, if they have not picked up
              </span>
              <Input
                data-pickup-reminder=""
                type="number"
                min={0}
                disabled={!write}
                value={settings.pickupReminderMinutes ?? ""}
                placeholder="Off"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const pickupReminderMinutes = raw === "" ? null : Math.max(0, Math.round(Number(raw) || 0));
                  updateSettings({ pickupReminderMinutes });
                  persist({ pickupReminderMinutes });
                }}
              />
            </label>
          </div>
        )}
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
        <p className="text-xs text-muted-foreground">
          {taxMode === "per_entity"
            ? "Each selling entity may inherit these rates or override them."
            : "Entities inherit these venue rates."}
        </p>
        <div data-checklist-focus="taxes" tabIndex={-1}>
        <TaxRatesEditor
          rates={settings.taxRates ?? []}
          disabled={!write}
          onChange={(next) => {
            const patch = ratesPatch(next);
            updateSettings(patch);
            persist({ ...patch });
            persistTaxRates();
            noteChecklistSave({ tab: "settings", focus: "taxes" });
          }}
        />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium">Cash discount</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            disabled={!write}
            data-checklist-focus="cash-discount"
            checked={!!settings.cashDiscountEnabled}
            onChange={(e) => {
              if (!confirmCashDiscountRecalc()) return;
              updateSettings({ cashDiscountEnabled: e.target.checked });
              persistCashDiscount();
              noteChecklistSave({ tab: "settings", focus: "cash-discount" });
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
            onBlur={() => {
              if (!confirmCashDiscountRecalc()) return;
              persistCashDiscount();
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Round up to</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!write || !settings.cashDiscountEnabled}
            value={String(settings.cashRoundIncrement ?? 0.25)}
            onChange={(e) => {
              if (!confirmCashDiscountRecalc()) return;
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
        <p className="text-xs text-muted-foreground">
          On-premise only (table tent / check QR). The guest is at the location. No e-commerce
          cart, no alcohol delivery, no shipping.
        </p>
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
        <p className="text-sm font-medium">Stations and PINs</p>
        <p className="text-xs text-muted-foreground">
          Device role is the tablet envelope. Staff PIN is which of those actions this person may use.
          Host home is Floor, Checks, Menu, Pay. Waitlist, to-go, and clock are under Checks.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            disabled={!write}
            checked={Boolean(settings.serversAtHostStand)}
            onChange={(e) => {
              updateSettings({ serversAtHostStand: e.target.checked });
              persistHostStandPolicy();
            }}
          />
          <span>Servers may use the host stand (seat + to-go)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            disabled={!write}
            checked={Boolean(settings.hostMayOpenBarTabs)}
            onChange={(e) => {
              updateSettings({ hostMayOpenBarTabs: e.target.checked });
              persistHostStandPolicy();
            }}
          />
          <span>Host may open bar tabs</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            disabled={!write}
            checked={settings.orderMayOpenBarTabs !== false}
            onChange={(e) => {
              updateSettings({ orderMayOpenBarTabs: e.target.checked });
              persistHostStandPolicy();
            }}
          />
          <span>Bar tabs on order devices</span>
        </label>
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
