import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogoField } from "@/components/brand/BrandLogoField";
import { EntityPayPeriodSettings } from "@/components/pos/EntityPayPeriodSettings";
import { loadEntitySettingsFn, saveEntitySettingsFn } from "@/lib/access/api";
import { applyEntityGiftToStation } from "@/lib/pos/apply-entity-gift";
import {
  GIFT_ACTION_ROLES,
  defaultEntityGiftPolicy,
  type EntityGiftPolicy,
  type VenueGiftRules,
} from "@/lib/pos/gift-policy";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import type { EmployeeRole } from "@/lib/pos/types";
import {
  ENTITY_FIELD_PLACEHOLDERS,
  ENTITY_TIP_PLACEHOLDERS,
  tipPercentFields,
} from "@/lib/saas/entity-settings";

/**
 * Legal name, DBA, logo, tip percents, menu name, staff PIN length,
 * and gift cards for one selling entity. Venue payment and tax stay off this form.
 */
export function EntityOwnedSettings(props: {
  orgId: string;
  locationId: string;
  operatorId: string;
  write: boolean;
  heading?: string;
  showLogo?: boolean;
}) {
  const showLogo = props.showLogo !== false;
  const [legalName, setLegalName] = useState("");
  const [dba, setDba] = useState("");
  const [menuDisplayName, setMenuDisplayName] = useState("");
  const [tips, setTips] = useState<string[]>(["", "", "", ""]);
  const [pinLength, setPinLength] = useState("");
  const [gift, setGift] = useState<EntityGiftPolicy>(defaultEntityGiftPolicy());
  const [venueGift, setVenueGift] = useState<VenueGiftRules>({
    enabled: true,
    entitiesMaySell: true,
    entitiesMayRedeem: true,
    sellRoles: [...GIFT_ACTION_ROLES],
    redeemRoles: [...GIFT_ACTION_ROLES],
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!props.orgId || !props.locationId || !props.operatorId) return;
    let cancelled = false;
    setReady(false);
    void loadEntitySettingsFn({
      data: {
        orgId: props.orgId,
        locationId: props.locationId,
        operatorId: props.operatorId,
      },
    })
      .then((row) => {
        if (cancelled) return;
        setLegalName(row.legalName);
        setDba(row.dba);
        setMenuDisplayName(row.menuDisplayName);
        setTips(tipPercentFields(row.tipPercents));
        setPinLength(row.pinLength == null ? "" : String(row.pinLength));
        setGift(row.giftPolicy ?? defaultEntityGiftPolicy());
        if (row.venueGift) setVenueGift(row.venueGift);
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setMsg(e instanceof Error ? e.message : "Could not open entity settings.");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.orgId, props.locationId, props.operatorId]);

  const save = async () => {
    if (!props.write || !props.orgId || !props.locationId || !props.operatorId) return;
    setBusy(true);
    setMsg(null);
    try {
      const row = await saveEntitySettingsFn({
        data: {
          orgId: props.orgId,
          locationId: props.locationId,
          operatorId: props.operatorId,
          legalName,
          dba,
          menuDisplayName,
          tipPercents: tips,
          pinLength: pinLength || null,
          giftPolicy: gift,
        },
      });
      setLegalName(row.legalName);
      setDba(row.dba);
      setMenuDisplayName(row.menuDisplayName);
      setTips(tipPercentFields(row.tipPercents));
      setPinLength(row.pinLength == null ? "" : String(row.pinLength));
      setGift(row.giftPolicy ?? defaultEntityGiftPolicy());
      if (row.venueGift) setVenueGift(row.venueGift);
      applyEntityGiftToStation(props.operatorId, row.giftPolicy ?? defaultEntityGiftPolicy());
      setMsg("Saved on this entity.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save this entity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-auto max-w-2xl space-y-4"
      data-entity-settings
      data-entity-operator={props.operatorId}
    >
      <div>
        <h2 className="text-sm font-semibold">{props.heading || "This entity"}</h2>
        <p className="mt-1 text-xs text-muted-foreground" data-entity-settings-note>
          Saved on this entity. The location contact can change these.
        </p>
      </div>
      <section
        className="space-y-3 rounded-2xl border border-border bg-surface p-4"
        data-entity-settings-mode={props.write ? "edit" : "view"}
      >
        {!ready ? <p className="text-sm text-muted-foreground">Opening entity settings…</p> : null}
        {showLogo ? (
          <div data-entity-logo>
            <BrandLogoField
              locationId={props.locationId}
              operatorId={props.operatorId}
              label="Logo"
              hint="Guest check, this entity’s back office, and the QR page under the house name. Name text until a file is stored."
              write={props.write}
            />
          </div>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Legal name</span>
          <Input
            value={legalName}
            disabled={!props.write}
            placeholder={ENTITY_FIELD_PLACEHOLDERS.legalName}
            data-entity-legal
            onChange={(e) => setLegalName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">DBA</span>
          <Input
            value={dba}
            disabled={!props.write}
            placeholder={ENTITY_FIELD_PLACEHOLDERS.dba}
            data-entity-dba
            onChange={(e) => setDba(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Menu display name</span>
          <Input
            value={menuDisplayName}
            disabled={!props.write}
            placeholder={ENTITY_FIELD_PLACEHOLDERS.menuDisplayName}
            data-entity-menu-name
            onChange={(e) => setMenuDisplayName(e.target.value)}
          />
        </label>
        <fieldset className="space-y-2" data-entity-tips>
          <legend className="text-sm text-muted-foreground">Default tip percents</legend>
          <div className="grid grid-cols-4 gap-2">
            {tips.map((value, i) => (
              <Input
                key={i}
                value={value}
                disabled={!props.write}
                inputMode="decimal"
                placeholder={ENTITY_TIP_PLACEHOLDERS[i]}
                data-entity-tip={i}
                aria-label={`Tip percent ${i + 1}`}
                onChange={(e) => {
                  const next = tips.slice();
                  next[i] = e.target.value;
                  setTips(next);
                }}
              />
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Staff PIN length</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={pinLength}
            disabled={!props.write}
            data-entity-pin-length
            onChange={(e) => setPinLength(e.target.value)}
          >
            <option value="">{ENTITY_FIELD_PLACEHOLDERS.pinLength}</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </label>
        <EntityGiftFields
          write={props.write}
          gift={gift}
          venue={venueGift}
          onChange={setGift}
        />
        <EntityPayPeriodSettings entityId={props.operatorId} write={props.write} />
        {props.write ? (
          <Button type="button" size="sm" disabled={busy || !ready} data-entity-settings-save onClick={() => void save()}>
            {busy ? "Saving…" : "Save entity"}
          </Button>
        ) : null}
        {msg ? <p className="text-xs text-muted-foreground" data-entity-settings-msg>{msg}</p> : null}
      </section>
    </div>
  );
}

function toggleGiftRole(list: string[] | null, venueRoles: string[], role: string, on: boolean): string[] {
  const base = list ?? venueRoles;
  return on ? Array.from(new Set([...base, role])) : base.filter((item) => item !== role);
}

function EntityGiftFields({
  write,
  gift,
  venue,
  onChange,
}: {
  write: boolean;
  gift: EntityGiftPolicy;
  venue: VenueGiftRules;
  onChange: (next: EntityGiftPolicy) => void;
}) {
  const locked = !write || !venue.enabled;
  const sellLocked = locked || !venue.entitiesMaySell || !gift.enabled;
  const redeemLocked = locked || !venue.entitiesMayRedeem || !gift.enabled;
  const sellRoles = gift.sellRoles ?? venue.sellRoles;
  const redeemRoles = gift.redeemRoles ?? venue.redeemRoles;
  return (
    <section className="space-y-3 border-t border-border pt-3" data-entity-gift-cards>
      <div>
        <p className="text-sm font-medium">Gift cards</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {venue.enabled
            ? "This entity can turn gift cards off for its own sales. Who may sell and who may redeem stay inside the venue’s list."
            : "The venue has gift cards off. This entity cannot turn them on."}
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          data-entity-gift-enabled
          disabled={locked}
          checked={venue.enabled && gift.enabled}
          onChange={(e) => onChange({ ...gift, enabled: e.target.checked })}
        />
        <span>Enable gift cards for this entity</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          data-entity-gift-sell
          disabled={sellLocked}
          checked={venue.enabled && venue.entitiesMaySell && gift.enabled && gift.sell}
          onChange={(e) => onChange({ ...gift, sell: e.target.checked })}
        />
        <span>
          This entity may sell
          {!venue.entitiesMaySell ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">The venue does not allow entities to sell.</span>
          ) : null}
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          data-entity-gift-redeem
          disabled={redeemLocked}
          checked={venue.enabled && venue.entitiesMayRedeem && gift.enabled && gift.redeem}
          onChange={(e) => onChange({ ...gift, redeem: e.target.checked })}
        />
        <span>
          This entity may redeem
          {!venue.entitiesMayRedeem ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">The venue does not allow entities to redeem.</span>
          ) : null}
        </span>
      </label>
      <fieldset className="space-y-1" data-entity-gift-sell-roles>
        <legend className="text-sm text-muted-foreground">Who can sell</legend>
        <div className="grid grid-cols-2 gap-1">
          {GIFT_ACTION_ROLES.map((role) => {
            const allowed = venue.sellRoles.includes(role);
            return (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  data-entity-gift-sell-role={role}
                  disabled={sellLocked || !gift.sell || !allowed}
                  checked={allowed && sellRoles.includes(role)}
                  onChange={(e) =>
                    onChange({
                      ...gift,
                      sellRoles: toggleGiftRole(gift.sellRoles, venue.sellRoles, role, e.target.checked),
                    })
                  }
                />
                {ROLE_LABEL[role as EmployeeRole]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="space-y-1" data-entity-gift-redeem-roles>
        <legend className="text-sm text-muted-foreground">Who can redeem</legend>
        <div className="grid grid-cols-2 gap-1">
          {GIFT_ACTION_ROLES.map((role) => {
            const allowed = venue.redeemRoles.includes(role);
            return (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  data-entity-gift-redeem-role={role}
                  disabled={redeemLocked || !gift.redeem || !allowed}
                  checked={allowed && redeemRoles.includes(role)}
                  onChange={(e) =>
                    onChange({
                      ...gift,
                      redeemRoles: toggleGiftRole(gift.redeemRoles, venue.redeemRoles, role, e.target.checked),
                    })
                  }
                />
                {ROLE_LABEL[role as EmployeeRole]}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
