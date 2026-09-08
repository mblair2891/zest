import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { formatCurrency } from "@/lib/utils";
import { saveIntakeFn, submitQuoteRequestFn } from "@/lib/saas/api";
import { generateQuote, DEFAULT_PRICING_RULES, PROCESSING_NOTE } from "@/lib/saas/pricing";
import { HARDWARE_LEAD } from "@/lib/saas/quote-catalog";
import { QuoteSummary } from "./QuoteSummary";
import { Field, ToggleChip, WizardChrome } from "./WizardChrome";
import {
  HOUSE_SHAPE_HINT,
  HOUSE_SHAPE_LABEL,
  HOUSE_SHAPES,
  PRICE_WIZARD_STEPS,
  QR_CHOICE_LABEL,
  QR_CHOICES,
  SERVICE_STYLE_LABEL,
  WIZARD_MODULE_META,
  clampWizard,
  clampWizardStep,
  prefillFromDescription,
  selectHouseShape,
  stylesForShape,
  visibleModules,
  wizardToIntake,
  type PriceWizardState,
  type QrChoice,
  type ServiceStyle,
} from "@/lib/saas/price-wizard";
import type { QuoteCatalog } from "@/lib/saas/prospect-types";
import { clearGetAPriceStorage } from "@/lib/saas/get-a-price-draft";

export function PriceWizard({
  token,
  catalog,
  state,
  step,
  onChange,
  onStep,
}: {
  token: string;
  catalog: QuoteCatalog;
  state: PriceWizardState;
  step: number;
  onChange: (state: PriceWizardState) => void;
  onStep: (step: number) => void;
}) {
  const navigate = useNavigate();
  const [describeOpen, setDescribeOpen] = useState(Boolean(state.describe));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (fn: (s: PriceWizardState) => PriceWizardState) => {
    onChange(clampWizard(fn(state)));
  };

  const answers = useMemo(() => wizardToIntake(state), [state]);
  const quote = useMemo(() => {
    if (!state.shape || !state.style) return null;
    return generateQuote(answers, { ...DEFAULT_PRICING_RULES, quoteCatalog: catalog }, { draft: true });
  }, [answers, catalog, state.shape, state.style]);

  const go = (n: number) => {
    setError(null);
    onStep(clampWizardStep(n));
  };

  const submit = async () => {
    setError(null);
    if (!state.email.includes("@")) {
      setError("Email is required to send the quote.");
      go(7);
      return;
    }
    if (state.legalName.trim().length < 2) {
      setError("Business / legal name is required.");
      go(7);
      return;
    }
    if (!state.shape || !state.style) {
      setError("Pick a house shape and service style first.");
      go(state.shape ? 2 : 1);
      return;
    }
    setBusy(true);
    try {
      const next = wizardToIntake(state);
      await saveIntakeFn({ data: { token, answers: next } });
      const quoted = await submitQuoteRequestFn({ data: { token } });
      clearGetAPriceStorage();
      await navigate({ to: "/quote/$token", params: { token: quoted.publicToken } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request the quote");
    } finally {
      setBusy(false);
    }
  };

  const styles = stylesForShape(state.shape);
  const mods = visibleModules(state);
  const titles = [
    "How is the house organized?",
    "How do guests get served?",
    "Which modules?",
    "Counts",
    "Hardware",
    "Your price",
    "Where should we send this?",
  ];
  const subtitles = [
    "This chooses the commercial shape. Two operators in one building is shared venue, not a single operator.",
    "Choices depend on the shape you picked.",
    "Only modules this house can use. Unchecked items stay off the quote.",
    "Stations are order tablets. Kitchen/bar ODS is +1 display if that module is on.",
    "Tablets, printers, and drawers are yours. Live cards need Finix / Quantum readers we ship.",
    "Monthly software from the live catalog. Processing is a note, not this total.",
    "Creates a CRM lead and a quote request — not a charge.",
  ];

  return (
    <WizardChrome
      title={titles[step - 1] ?? "Get a price"}
      subtitle={subtitles[step - 1]}
      step={step}
      total={7}
      labels={[...PRICE_WIZARD_STEPS]}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => go(step - 1) : undefined}
      onNext={step < 7 ? () => go(step + 1) : () => void submit()}
      nextLabel={step < 7 ? "Continue" : "Request this quote"}
      nextDisabled={
        (step === 1 && !state.shape) ||
        (step === 2 && !state.style) ||
        (step === 7 && (!state.email.includes("@") || state.legalName.trim().length < 2))
      }
      footerExtra={
        step > 1 ? (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline sm:w-auto"
            onClick={() => go(1)}
          >
            Edit from the start
          </button>
        ) : undefined
      }
    >
      {step > 1 && (
        <ol className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          {PRICE_WIZARD_STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                className={i + 1 === step ? "font-medium text-primary" : "hover:text-foreground"}
                onClick={() => go(i + 1)}
              >
                {label}
                {i < PRICE_WIZARD_STEPS.length - 1 ? " →" : ""}
              </button>
            </li>
          ))}
        </ol>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-2">
            {HOUSE_SHAPES.map((id) => (
              <ToggleChip
                key={id}
                on={state.shape === id}
                label={HOUSE_SHAPE_LABEL[id]}
                hint={HOUSE_SHAPE_HINT[id]}
                onClick={() => patch((s) => selectHouseShape(s, id))}
              />
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setDescribeOpen((v) => !v)}
          >
            {describeOpen ? "Hide description" : "Optional: describe in your own words (pre-checks boxes)"}
          </button>
          {describeOpen && (
            <div className="space-y-2">
              <VoiceTextarea
                value={state.describe}
                onChange={(describe) => patch((s) => ({ ...s, describe }))}
                rows={4}
                placeholder="Two operators in one building — a bar and a kitchen…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = prefillFromDescription(state.describe);
                  patch(() => next);
                }}
                disabled={state.describe.trim().length < 8}
              >
                Pre-check from this description
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-2">
            {styles.map((id) => (
              <ToggleChip
                key={id}
                on={state.style === id}
                label={SERVICE_STYLE_LABEL[id]}
                onClick={() => patch((s) => ({ ...s, style: id as ServiceStyle }))}
              />
            ))}
          </div>
          {state.shape && state.shape !== "single" && (
            <Field
              label={state.shape === "peer_venue" ? "Entities (min 2)" : "Tenant entities"}
              hint={
                state.shape === "peer_venue"
                  ? "Independent operators in this building. Default 2."
                  : "Tenant operators at this host."
              }
            >
              <Input
                type="number"
                min={state.shape === "peer_venue" ? 2 : 1}
                value={state.entities}
                onChange={(e) => patch((s) => ({ ...s, entities: Number(e.target.value) }))}
              />
            </Field>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {WIZARD_MODULE_META.filter((m) => mods.includes(m.id)).map((m) => {
            if (m.id === "qr") {
              return (
                <Field key={m.id} label={m.label} hint={m.hint}>
                  <select
                    className="h-10 w-full rounded-lg border border-border bg-bg px-2 text-sm"
                    value={state.modules.qr}
                    onChange={(e) =>
                      patch((s) => ({
                        ...s,
                        modules: { ...s.modules, qr: e.target.value as QrChoice },
                      }))
                    }
                  >
                    {QR_CHOICES.map((id) => (
                      <option key={id} value={id}>
                        {QR_CHOICE_LABEL[id]}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            }
            const on = state.modules[m.id] as boolean;
            return (
              <ToggleChip
                key={m.id}
                on={on}
                label={m.label}
                hint={m.hint}
                onClick={() =>
                  patch((s) => ({ ...s, modules: { ...s.modules, [m.id]: !on } }))
                }
              />
            );
          })}
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Locations">
            <Input
              type="number"
              min={1}
              value={state.locations}
              onChange={(e) => patch((s) => ({ ...s, locations: Number(e.target.value) }))}
            />
          </Field>
          {state.shape && state.shape !== "single" && (
            <Field
              label={state.shape === "peer_venue" ? "Entities (min 2)" : "Tenant entities"}
            >
              <Input
                type="number"
                min={state.shape === "peer_venue" ? 2 : 1}
                value={state.entities}
                onChange={(e) => patch((s) => ({ ...s, entities: Number(e.target.value) }))}
              />
            </Field>
          )}
          <Field label="Seats">
            <Input
              type="number"
              min={0}
              value={state.seats}
              onChange={(e) => patch((s) => ({ ...s, seats: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Order stations">
            <Input
              type="number"
              min={1}
              value={state.stations}
              onChange={(e) => patch((s) => ({ ...s, stations: Number(e.target.value) }))}
            />
          </Field>
          {state.modules.kiosk && (
            <Field label="Kiosks">
              <Input
                type="number"
                min={0}
                value={state.kiosks}
                onChange={(e) => patch((s) => ({ ...s, kiosks: Number(e.target.value) }))}
              />
            </Field>
          )}
          <Field label="Quantum readers">
            <Input
              type="number"
              min={1}
              value={state.readers}
              onChange={(e) => patch((s) => ({ ...s, readers: Number(e.target.value) }))}
            />
          </Field>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3 text-sm">
          <p>{HARDWARE_LEAD}</p>
          <p className="text-muted-foreground">
            This quote includes {state.readers} reader{state.readers === 1 ? "" : "s"} supplied through
            Summex. Staff stations are Android tablets running Summex Station. Printers, cash
            drawers, and stands stay BYO.
          </p>
          <Field label="Reader quantity">
            <Input
              type="number"
              min={1}
              value={state.readers}
              onChange={(e) => patch((s) => ({ ...s, readers: Number(e.target.value) }))}
            />
          </Field>
        </div>
      )}

      {step === 6 && quote && (
        <div className="space-y-4">
          <QuoteSummary quote={quote} />
          <p className="text-xs text-muted-foreground">{PROCESSING_NOTE}</p>
        </div>
      )}
      {step === 6 && !quote && (
        <p className="text-sm text-muted-foreground">Pick a shape and service style to see a price.</p>
      )}

      {step === 7 && (
        <div className="grid gap-3">
          {quote && (
            <p className="text-sm">
              Software <span className="font-semibold tabular">{formatCurrency(quote.monthlyCents)}</span>
              /mo
              {quote.onboardingFeeCents > 0
                ? ` · setup ${formatCurrency(quote.onboardingFeeCents)}`
                : " · no setup fee"}
              . Processing is billed separately.
            </p>
          )}
          <Field label="Business / legal name">
            <Input
              value={state.legalName}
              onChange={(e) => patch((s) => ({ ...s, legalName: e.target.value }))}
              placeholder="Acme Hospitality LLC"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={state.email}
              onChange={(e) => patch((s) => ({ ...s, email: e.target.value }))}
              placeholder="you@company.com"
            />
          </Field>
        </div>
      )}

      {quote && step >= 3 && step < 6 && (
        <p className="text-xs text-muted-foreground">
          Live software total {formatCurrency(quote.monthlyCents)}/mo — updates as you pick.
        </p>
      )}
    </WizardChrome>
  );
}
