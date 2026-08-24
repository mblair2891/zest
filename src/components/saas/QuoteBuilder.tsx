import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  listQuoteCatalogFn,
  saveQuoteDraftFn,
  sendQuoteFn,
  adminMarkQuoteAcceptedFn,
} from "@/lib/saas/api";
import { buildStructuredQuote, type QuoteAddOn } from "@/lib/saas/quote-builder";
import { parseMoneyToCents, newLocalId } from "@/lib/saas/platform-settings";
import type { ProspectDetail } from "@/lib/saas/prospect-types";
import type { PlanSlug } from "@/lib/saas/types";
import { QuoteSummary } from "./QuoteSummary";

export function QuoteBuilder({
  detail,
  onChanged,
}: {
  detail: ProspectDetail;
  onChanged: () => void;
}) {
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof listQuoteCatalogFn>>["plans"]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [planSlug, setPlanSlug] = useState<PlanSlug>(detail.quote?.planSlug ?? "starter");
  const [locationCount, setLocationCount] = useState(
    detail.quote?.locationCount ?? detail.answers.portfolio.locationsNow ?? 1,
  );
  const [setup, setSetup] = useState(
    ((detail.quote?.setupFeeCents ?? detail.quote?.onboardingFeeCents ?? 0) / 100).toFixed(2),
  );
  const [addOns, setAddOns] = useState<QuoteAddOn[]>(detail.quote?.addOns ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listQuoteCatalogFn().then((c) => {
      setPlans(c.plans);
      setTrialDays(c.trialDays);
      if (!detail.quote && c.plans[0]) {
        const suggested =
          c.plans.find((p) => p.slug === planSlug) ?? c.plans.find((p) => p.active) ?? c.plans[0];
        if (suggested) {
          setPlanSlug(suggested.slug);
          if (!detail.quote) setSetup((suggested.onboardingFeeCents / 100).toFixed(2));
        }
      }
    });
  }, [detail.id]);

  const plan = plans.find((p) => p.slug === planSlug) ?? plans[0];
  const preview = useMemo(() => {
    if (!plan) return null;
    return buildStructuredQuote({
      plan,
      locationCount,
      setupFeeCents: parseMoneyToCents(setup),
      addOns,
      trialDays,
      draft: detail.status !== "quoted",
    });
  }, [plan, locationCount, setup, addOns, trialDays, detail.status]);

  const save = async (send: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      await saveQuoteDraftFn({
        data: {
          prospectId: detail.id,
          planSlug,
          locationCount,
          setupFeeCents: parseMoneyToCents(setup),
          addOns: addOns.filter((a) => a.name.trim().length > 0),
        },
      });
      if (send) await sendQuoteFn({ data: { prospectId: detail.id } });
      setMsg(send ? "Quote sent. Status is Sent." : "Draft saved.");
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save quote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quote builder
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Plans come from Settings → Plans & billing. Monthly is price per location. No JSON.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Plan</span>
          <select
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={planSlug}
            onChange={(e) => {
              const slug = e.target.value as PlanSlug;
              setPlanSlug(slug);
              const p = plans.find((x) => x.slug === slug);
              if (p) setSetup((p.onboardingFeeCents / 100).toFixed(2));
            }}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
                {p.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Locations</span>
          <Input
            type="number"
            min={1}
            value={locationCount}
            onChange={(e) => setLocationCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Setup fee (one-time)</span>
          <Input value={setup} inputMode="decimal" onChange={(e) => setSetup(e.target.value)} />
        </label>
        {plan && (
          <p className="self-end text-sm text-muted-foreground">
            {formatCurrency(plan.monthlyCents)} / location / mo · {plan.maxSeats} seats included
            {trialDays ? ` · ${trialDays}-day trial` : ""}
          </p>
        )}
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Add-ons</p>
        {addOns.map((a, i) => (
          <div key={a.id} className="grid grid-cols-[1fr_110px_auto_auto] gap-2">
            <Input
              value={a.name}
              placeholder="Name"
              onChange={(e) => {
                const next = addOns.slice();
                next[i] = { ...a, name: e.target.value };
                setAddOns(next);
              }}
            />
            <Input
              inputMode="decimal"
              value={(a.amountCents / 100).toFixed(2)}
              onChange={(e) => {
                const next = addOns.slice();
                next[i] = { ...a, amountCents: parseMoneyToCents(e.target.value) };
                setAddOns(next);
              }}
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={a.oneTime}
                onChange={(e) => {
                  const next = addOns.slice();
                  next[i] = { ...a, oneTime: e.target.checked };
                  setAddOns(next);
                }}
              />
              One-time
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAddOns(addOns.filter((x) => x.id !== a.id))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setAddOns([
              ...addOns,
              { id: newLocalId("addon"), name: "Add-on", amountCents: 0, oneTime: false },
            ])
          }
        >
          Add add-on
        </Button>
      </div>
      {preview && (
        <div className="mt-4">
          <QuoteSummary quote={preview} status={detail.status} compact />
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>
          Save draft
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void save(true)}>
          {busy ? "Working…" : "Send quote"}
        </Button>
        {detail.status === "quoted" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void adminMarkQuoteAcceptedFn({ data: { prospectId: detail.id } })
                .then(() => {
                  setMsg("Marked accepted.");
                  onChanged();
                })
                .catch((e) => setMsg(e instanceof Error ? e.message : "Failed"))
                .finally(() => setBusy(false));
            }}
          >
            Mark accepted
          </Button>
        )}
      </div>
    </div>
  );
}
