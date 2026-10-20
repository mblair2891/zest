import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  computePayPeriod,
  laborRulesAt,
  parseLaborRules,
  payPeriodPolicyOf,
  planPayPeriodChange,
  type PayPeriodKind,
  type PayPeriodPolicy,
} from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const KIND_LABEL: Record<PayPeriodKind, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  semimonthly: "Semi-monthly",
  monthly: "Monthly",
  custom: "Custom",
};

function policyKey(policy: PayPeriodPolicy, pendingAt: number): string {
  return JSON.stringify({ policy, pendingAt });
}

/**
 * Entity Settings → Scheduling / Payroll.
 * Location admin and entity admin save the cycle for one selling entity.
 */
export function EntityPayPeriodSettings(props: { entityId: string; write: boolean; heading?: string }) {
  const entityId = props.entityId || HOST_SCOPE;
  const labor = useOpsStore((s) => s.labor);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const setPayPeriodForEntity = useOpsStore((s) => s.setPayPeriodForEntity);
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const rules = parseLaborRules(laborByEntity[entityId] ?? labor);
  const saved = payPeriodPolicyOf(rules);
  const savedKey = policyKey(saved, rules.payPeriodPendingAt);
  const [draft, setDraft] = useState<PayPeriodPolicy>(saved);
  const [warning, setWarning] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setDraft(payPeriodPolicyOf(parseLaborRules(useOpsStore.getState().laborByEntity[entityId] ?? useOpsStore.getState().labor)));
    setWarning(null);
    setNote(null);
  }, [entityId, savedKey]);

  const live = laborRulesAt(rules, Date.now());
  const open = computePayPeriod(Date.now(), live);
  const name =
    props.heading ||
    (entityId === HOST_SCOPE
      ? settings.name || "Host"
      : vendors.find((v) => v.id === entityId)?.name ||
        vendors.find((v) => v.id === entityId)?.shortName ||
        "This entity");

  const preview = useMemo(
    () =>
      planPayPeriodChange({
        current: saved,
        next: draft,
        now: Date.now(),
        applyNow: false,
      }),
    [saved, draft],
  );

  const save = (applyNow: boolean) => {
    if (!props.write) return;
    const plan = setPayPeriodForEntity(entityId, draft, applyNow);
    setWarning(plan.warning);
    setNote(
      plan.warning
        ? null
        : plan.applied === "now"
          ? "Saved on this entity. The new cycle is in effect."
          : "Saved for the next cycle on this entity.",
    );
    if (plan.warning) setWarning(plan.warning);
  };

  const patch = (partial: Partial<PayPeriodPolicy>) => {
    setNote(null);
    setDraft((cur) => ({ ...cur, ...partial }));
  };

  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
      data-entity-pay-period
      data-pay-period-entity={entityId}
    >
      <div>
        <h3 className="text-sm font-semibold">Scheduling / Payroll</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {name}. Clock punches, shift approval, and the hours export use this cycle. Another
          entity at this location can use a different one.
        </p>
      </div>
      <p className="text-xs text-muted-foreground" data-pay-period-open>
        Current period {open.startIso} – {open.endIso}. Pay date {open.payDateIso}.
      </p>
      {rules.payPeriodPending ? (
        <p className="text-xs text-muted-foreground" data-pay-period-pending>
          Next cycle: {KIND_LABEL[rules.payPeriodPending.payPeriodType]} starts after this period.
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Pay period</span>
        <select
          className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
          disabled={!props.write}
          data-pay-period-type
          value={draft.payPeriodType}
          onChange={(e) => patch({ payPeriodType: e.target.value as PayPeriodKind })}
        >
          {(Object.keys(KIND_LABEL) as PayPeriodKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      </label>
      {draft.payPeriodType === "weekly" || draft.payPeriodType === "biweekly" || draft.payPeriodType === "custom" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Start day</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!props.write}
            data-pay-period-weekday
            value={String(draft.payPeriodStartWeekday)}
            onChange={(e) => patch({ payPeriodStartWeekday: parseInt(e.target.value, 10) || 0 })}
          >
            {WEEKDAYS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {draft.payPeriodType === "biweekly" || draft.payPeriodType === "custom" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            {draft.payPeriodType === "custom" ? "Start date" : "Anchor date"}
          </span>
          <Input
            type="date"
            disabled={!props.write}
            data-pay-period-anchor
            value={draft.payPeriodAnchorDate}
            onChange={(e) => patch({ payPeriodAnchorDate: e.target.value })}
          />
        </label>
      ) : null}
      {draft.payPeriodType === "semimonthly" || draft.payPeriodType === "monthly" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            {draft.payPeriodType === "monthly" ? "Starts on day of month" : "First half starts on day"}
          </span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            disabled={!props.write}
            data-pay-period-start-day
            value={String(draft.payPeriodStartDay)}
            onChange={(e) => patch({ payPeriodStartDay: parseInt(e.target.value, 10) || 1 })}
          >
            {Array.from({ length: draft.payPeriodType === "semimonthly" ? 15 : 28 }, (_, i) => i + 1).map(
              (day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}
      {draft.payPeriodType === "custom" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Length in days</span>
          <Input
            inputMode="numeric"
            disabled={!props.write}
            data-pay-period-length
            value={String(draft.payPeriodCustomDays)}
            onChange={(e) => patch({ payPeriodCustomDays: parseInt(e.target.value, 10) || 14 })}
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Period-end time</span>
        <Input
          type="time"
          disabled={!props.write}
          data-pay-period-end-time
          value={draft.payPeriodEndTime.slice(0, 5)}
          onChange={(e) => patch({ payPeriodEndTime: e.target.value || "04:00" })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Pay date, days after period end</span>
        <Input
          inputMode="numeric"
          disabled={!props.write}
          data-pay-period-offset
          value={String(draft.payDateOffsetDays)}
          onChange={(e) => patch({ payDateOffsetDays: parseInt(e.target.value, 10) || 0 })}
        />
      </label>
      {preview.warning ? (
        <p className="text-xs text-warn" data-pay-period-warning>
          {preview.warning} Punches and shifts already recorded stay on this period.
        </p>
      ) : null}
      {warning && warning !== preview.warning ? (
        <p className="text-xs text-warn" data-pay-period-warning>
          {warning}
        </p>
      ) : null}
      {note ? (
        <p className="text-xs text-muted-foreground" data-pay-period-note>
          {note}
        </p>
      ) : null}
      {props.write ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" data-pay-period-save onClick={() => save(false)}>
            {preview.warning ? "Save for next cycle" : "Save pay period"}
          </Button>
          {preview.warning ? (
            <Button type="button" size="sm" variant="outline" data-pay-period-apply-now onClick={() => save(true)}>
              Apply now
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** One card per selling entity. Location admin uses this while editing the house. */
export function EntityPayPeriodSettingsList(props: { write: boolean; onlyEntityId?: string }) {
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const ids = props.onlyEntityId
    ? [props.onlyEntityId]
    : [...(peer ? [] : [HOST_SCOPE]), ...vendors.map((v) => v.id)];
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) unique.push(HOST_SCOPE);
  return (
    <div className="space-y-3" data-pay-period-list>
      {unique.map((id) => (
        <EntityPayPeriodSettings key={id} entityId={id} write={props.write} />
      ))}
    </div>
  );
}
