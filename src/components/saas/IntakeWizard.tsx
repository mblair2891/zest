import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LOCATION_TYPE_OPTIONS,
  type IntakeAnswers,
  type LocationTypeCount,
  emptyAnswers,
} from "@/lib/saas/prospect-types";
import type { LocationMode, OperatingModel } from "@/lib/pos/saas-types";
import {
  createProspect,
  getProspectByToken,
  saveProspectAnswers,
  submitProspectQuote,
} from "@/lib/saas/prospect-fns";
import { QuoteCard } from "./QuoteCard";

const STEPS = [
  "Company",
  "Portfolio",
  "Operating model",
  "Modules",
  "Volume",
  "Payments",
  "Review",
] as const;

const TOKEN_KEY = "zest-prospect-token";

export function IntakeWizard({ initialToken }: { initialToken?: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(emptyAnswers());
  const [token, setToken] = useState(initialToken ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quote, setQuote] = useState<
    Awaited<ReturnType<typeof submitProspectQuote>> extends infer R
      ? R extends { quote: infer Q }
        ? Q
        : never
      : never
  >(null);

  useEffect(() => {
    const t =
      initialToken ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem(TOKEN_KEY)
        : null);
    if (!t) return;
    void getProspectByToken({ data: t }).then((rec) => {
      if (!rec) return;
      setToken(rec.publicToken);
      setAnswers(rec.answers);
      if (rec.quote) {
        setQuote(rec.quote);
        setQuoteReady(true);
      }
      if (rec.status === "quoted" || rec.status === "accepted") {
        navigate({
          to: "/pricing/$token",
          params: { token: rec.publicToken },
        });
      }
    });
  }, [initialToken, navigate]);

  const patch = (partial: Partial<IntakeAnswers>) =>
    setAnswers((a) => ({ ...a, ...partial }));
  const patchCo = (partial: Partial<IntakeAnswers["company"]>) =>
    setAnswers((a) => ({ ...a, company: { ...a.company, ...partial } }));
  const patchCh = (partial: Partial<IntakeAnswers["channels"]>) =>
    setAnswers((a) => ({ ...a, channels: { ...a.channels, ...partial } }));

  const persist = async () => {
    let t = token;
    if (!t) {
      const rec = await createProspect();
      t = rec.publicToken;
      setToken(t);
      window.localStorage.setItem(TOKEN_KEY, t);
      navigate({ to: "/pricing/$token", params: { token: t } });
    }
    await saveProspectAnswers({ data: { token: t, answers } });
    return t;
  };

  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      await persist();
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const t = await persist();
      const rec = await submitProspectQuote({ data: t });
      setQuote(rec?.quote ?? null);
      setQuoteReady(true);
      if (rec) {
        navigate({ to: "/pricing/$token", params: { token: rec.publicToken } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate quote");
    } finally {
      setBusy(false);
    }
  };

  const setTypeCount = (mode: LocationMode, count: number) => {
    const rest = answers.locationTypes.filter((t) => t.mode !== mode);
    const nextTypes: LocationTypeCount[] =
      count > 0 ? [...rest, { mode, count }] : rest;
    const total = nextTypes.reduce((s, t) => s + t.count, 0);
    patch({ locationTypes: nextTypes, locationsNow: total || answers.locationsNow });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12">
      <ol className="flex flex-wrap gap-1">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {step === 0 && (
        <Section title="Company">
          <Field label="Legal name">
            <Input
              value={answers.company.legalName}
              onChange={(e) => patchCo({ legalName: e.target.value })}
            />
          </Field>
          <Field label="DBA / guest-facing brand">
            <Input
              value={answers.company.dba}
              onChange={(e) => patchCo({ dba: e.target.value })}
            />
          </Field>
          <Field label="Billing email">
            <Input
              type="email"
              value={answers.company.billingEmail}
              onChange={(e) => patchCo({ billingEmail: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={answers.company.phone}
              onChange={(e) => patchCo({ phone: e.target.value })}
            />
          </Field>
          <Field label="HQ address">
            <Input
              value={answers.company.hqAddress}
              onChange={(e) => patchCo({ hqAddress: e.target.value })}
            />
          </Field>
          <Field label="Tax ID (optional)">
            <Input
              value={answers.company.taxId}
              onChange={(e) => patchCo({ taxId: e.target.value })}
            />
          </Field>
        </Section>
      )}

      {step === 1 && (
        <Section title="Portfolio">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Locations now">
              <Input
                type="number"
                min={1}
                value={answers.locationsNow}
                onChange={(e) =>
                  patch({ locationsNow: Number(e.target.value) || 1 })
                }
              />
            </Field>
            <Field label="Locations in 12 months">
              <Input
                type="number"
                min={1}
                value={answers.locations12mo}
                onChange={(e) =>
                  patch({ locations12mo: Number(e.target.value) || 1 })
                }
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Counts by type</p>
          <ul className="space-y-2">
            {LOCATION_TYPE_OPTIONS.map((opt) => {
              const cur =
                answers.locationTypes.find((t) => t.mode === opt.id)?.count ?? 0;
              return (
                <li
                  key={opt.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>{opt.label}</span>
                  <Input
                    className="w-20"
                    type="number"
                    min={0}
                    value={cur}
                    onChange={(e) =>
                      setTypeCount(opt.id, Number(e.target.value) || 0)
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {step === 2 && (
        <Section title="Operating model">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["single_operator", "Single operator"],
                ["host_multi_operator", "Host + multiple operators"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={answers.operatingModel === id ? "default" : "outline"}
                onClick={() => patch({ operatingModel: id as OperatingModel })}
              >
                {label}
              </Button>
            ))}
          </div>
          {answers.operatingModel === "host_multi_operator" && (
            <>
              <Field label="Estimated operators per location">
                <Input
                  type="number"
                  min={1}
                  value={answers.operatorsPerLocation}
                  onChange={(e) =>
                    patch({ operatorsPerLocation: Number(e.target.value) || 1 })
                  }
                />
              </Field>
              <Toggle
                label="Guest pays one host check; operators settle later"
                on={answers.oneHostCheck}
                set={(v) => patch({ oneHostCheck: v })}
              />
            </>
          )}
          <Toggle
            label="Bar and kitchen are split operations"
            on={answers.barKitchenSplit}
            set={(v) => patch({ barKitchenSplit: v })}
          />
        </Section>
      )}

      {step === 3 && (
        <Section title="Channels & modules">
          {(
            [
              ["floor", "Table service / floor / sections"],
              ["counter", "Counter / QSR"],
              ["kiosk", "Kiosk"],
              ["online", "Online / order-ahead"],
              ["kds", "Kitchen / bar display"],
              ["inventory", "Inventory / purchasing"],
              ["labor", "Labor / scheduling / tip pooling"],
              ["giftCards", "First-party gift cards"],
              ["crm", "CRM / guests"],
              ["marketing", "Marketing"],
              ["vendorPortal", "Vendor portal (host locations)"],
              ["multiLocationReporting", "Multi-location reporting"],
            ] as const
          ).map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              on={answers.channels[key]}
              set={(v) => patchCh({ [key]: v })}
            />
          ))}
        </Section>
      )}

      {step === 4 && (
        <Section title="Volume">
          <Field label="Est. monthly checks">
            <Input
              type="number"
              min={0}
              value={answers.monthlyChecks}
              onChange={(e) =>
                patch({ monthlyChecks: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Monthly GMV band">
            <select
              className="mt-1 flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={answers.gmvBand}
              onChange={(e) =>
                patch({
                  gmvBand: e.target.value as IntakeAnswers["gmvBand"],
                })
              }
            >
              <option value="under_50k">Under $50k</option>
              <option value="50_150k">$50k–$150k</option>
              <option value="150_500k">$150k–$500k</option>
              <option value="500k_plus">$500k+</option>
            </select>
          </Field>
          <Field label="Peak concurrent devices">
            <Input
              type="number"
              min={1}
              value={answers.peakDevices}
              onChange={(e) =>
                patch({ peakDevices: Number(e.target.value) || 1 })
              }
            />
          </Field>
          <Field label="Staff seats (FOH + BOH logins)">
            <Input
              type="number"
              min={1}
              value={answers.staffSeats}
              onChange={(e) =>
                patch({ staffSeats: Number(e.target.value) || 1 })
              }
            />
          </Field>
        </Section>
      )}

      {step === 5 && (
        <Section title="Payments">
          <Toggle
            label="I understand guest cards run on Zest Payments only (host MID for multi-operator)"
            on={answers.zestPaymentsAck}
            set={(v) => patch({ zestPaymentsAck: v })}
          />
          <Toggle
            label="Tips"
            on={answers.tips}
            set={(v) => patch({ tips: v })}
          />
          <Toggle
            label="Split tenders"
            on={answers.splitTenders}
            set={(v) => patch({ splitTenders: v })}
          />
          <Toggle
            label="Room charge"
            on={answers.roomCharge}
            set={(v) => patch({ roomCharge: v })}
          />
          <Field label="Operator payout frequency (informational)">
            <select
              className="mt-1 flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={answers.operatorPayoutFrequency}
              onChange={(e) =>
                patch({
                  operatorPayoutFrequency: e.target
                    .value as IntakeAnswers["operatorPayoutFrequency"],
                })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>
          </Field>
        </Section>
      )}

      {step === 6 && (
        <Section title="Timeline & review">
          <Field label="Target go-live">
            <Input
              type="date"
              value={answers.goLiveDate}
              onChange={(e) => patch({ goLiveDate: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={answers.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            {answers.company.legalName || "Company"} ·{" "}
            {answers.locationsNow} location(s) · {answers.operatingModel.replaceAll("_", " ")}
          </p>
          {quoteReady && quote && <QuoteCard quote={quote} />}
        </Section>
      )}

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={busy} onClick={() => void next()}>
            {busy ? "Saving…" : "Continue"}
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Generating…" : "Generate quote"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={on}
        onChange={(e) => set(e.target.checked)}
      />
      {label}
    </label>
  );
}
