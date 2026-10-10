import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogoField } from "@/components/brand/BrandLogoField";
import { loadEntitySettingsFn, saveEntitySettingsFn } from "@/lib/access/api";
import {
  ENTITY_FIELD_PLACEHOLDERS,
  ENTITY_TIP_PLACEHOLDERS,
  tipPercentFields,
} from "@/lib/saas/entity-settings";

/**
 * Legal name, DBA, logo, tip percents, menu name, and staff PIN length
 * for one selling entity. Venue payment and tax stay off this form.
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
        },
      });
      setLegalName(row.legalName);
      setDba(row.dba);
      setMenuDisplayName(row.menuDisplayName);
      setTips(tipPercentFields(row.tipPercents));
      setPinLength(row.pinLength == null ? "" : String(row.pinLength));
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
