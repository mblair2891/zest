import { useEffect, useRef, useState } from "react";
import {
  saveIntakeFn,
  startProspectFn,
  getProspectFn,
  loadPublicQuoteCatalogFn,
} from "@/lib/saas/api";
import { emptyIntakeAnswers, parseIntakeAnswers } from "@/lib/saas/pricing";
import { DEFAULT_QUOTE_CATALOG } from "@/lib/saas/quote-catalog";
import type { QuoteCatalog } from "@/lib/saas/prospect-types";
import type { IntakeAnswers } from "@/lib/saas/prospect-types";
import { writeProspectToken } from "@/lib/saas/prospect-token";
import {
  clearGetAPriceStorage,
  decideGetAPriceLoad,
  navigationType,
  peekGetAPricePath,
  readGetAPriceDraft,
  withGetAPriceStep,
  withGetAPriceToken,
  writeGetAPriceDraft,
  type GetAPriceSearch,
} from "@/lib/saas/get-a-price-draft";
import { Button } from "@/components/ui/button";
import { PriceWizard } from "./PriceWizard";
import {
  answersToWizard,
  clampWizard,
  clampWizardStep,
  emptyPriceWizard,
  parsePriceWizard,
  wizardToIntake,
  type PriceWizardState,
} from "@/lib/saas/price-wizard";

function rememberDraft(opts: {
  token: string;
  step: number;
  answers: IntakeAnswers;
  wizard: PriceWizardState;
}) {
  writeProspectToken(opts.token);
  writeGetAPriceDraft({
    token: opts.token,
    step: opts.step,
    phase: "form",
    data: { answers: opts.answers, wizard: opts.wizard },
  });
}

function wizardFromDraft(data: unknown, answers: IntakeAnswers): PriceWizardState {
  if (data && typeof data === "object" && "wizard" in data) {
    const w = parsePriceWizard((data as { wizard: unknown }).wizard);
    if (w) return w;
  }
  const parsed = parsePriceWizard(data);
  if (parsed?.shape) return parsed;
  return answersToWizard(answers);
}

function answersFromDraft(data: unknown): IntakeAnswers {
  if (data && typeof data === "object" && "answers" in data) {
    return parseIntakeAnswers((data as { answers: unknown }).answers);
  }
  return parseIntakeAnswers(data);
}

export function IntakeWizard({
  search,
  onSearch,
}: {
  search: GetAPriceSearch;
  onSearch: (next: GetAPriceSearch | ((prev: GetAPriceSearch) => GetAPriceSearch)) => void;
}) {
  const [token, setToken] = useState(search.t ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [wizard, setWizard] = useState<PriceWizardState>(emptyPriceWizard);
  const [wizardKey, setWizardKey] = useState(0);
  const [catalog, setCatalog] = useState<QuoteCatalog>(DEFAULT_QUOTE_CATALOG);
  const step = clampWizardStep(search.step ?? 1);

  const tokenRef = useRef(token);
  const stepRef = useRef(step);
  const wizardRef = useRef(wizard);
  tokenRef.current = token;
  stepRef.current = step;
  wizardRef.current = wizard;

  const landingRef = useRef({ t: search.t, step: search.step });
  const bootedRef = useRef(false);

  useEffect(() => {
    void loadPublicQuoteCatalogFn()
      .then((r) => setCatalog(r.catalog))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;
    const landing = landingRef.current;
    const boot = async () => {
      try {
        const draft = readGetAPriceDraft();
        const decision = decideGetAPriceLoad({
          draft,
          previousPathname: peekGetAPricePath(),
          currentPathname: typeof window !== "undefined" ? window.location.pathname : "/get-pricing",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          origin: typeof window !== "undefined" ? window.location.origin : "",
          navigationType: navigationType(),
        });
        if (decision.action === "empty") {
          clearGetAPriceStorage();
        }
        const existing =
          decision.action === "restore" ? draft?.token || landing.t || null : null;
        if (existing) {
          try {
            const p = await getProspectFn({ data: { token: existing } });
            if (cancelled) return;
            if (p.status !== "prospect") {
              clearGetAPriceStorage();
              setBooting(false);
              return;
            }
            const restoredAnswers = draft?.data ? answersFromDraft(draft.data) : p.answers;
            const restoredWizard = clampWizard(
              draft?.data ? wizardFromDraft(draft.data, restoredAnswers) : answersToWizard(p.answers),
            );
            const restoredStep = clampWizardStep(draft?.step ?? landing.step ?? 1);
            setToken(p.publicToken);
            setWizard(restoredWizard);
            rememberDraft({
              token: p.publicToken,
              step: restoredStep,
              answers: wizardToIntake(restoredWizard),
              wizard: restoredWizard,
            });
            onSearch({ t: p.publicToken, step: restoredStep });
            return;
          } catch {
            /* new intake */
          }
        }
        const p = await startProspectFn();
        if (cancelled) return;
        const fresh = emptyPriceWizard();
        setToken(p.publicToken);
        setWizard(fresh);
        rememberDraft({
          token: p.publicToken,
          step: 1,
          answers: emptyIntakeAnswers(),
          wizard: fresh,
        });
        onSearch({ t: p.publicToken, step: 1 });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not start intake");
      } finally {
        if (!cancelled) setBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // Boot once per mount. Search updates (token/step) must not re-hydrate or remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistWizard = (next: PriceWizardState) => {
    const clamped = clampWizard(next);
    setWizard(clamped);
    wizardRef.current = clamped;
    const t = tokenRef.current;
    if (!t) return;
    rememberDraft({
      token: t,
      step: stepRef.current,
      answers: wizardToIntake(clamped),
      wizard: clamped,
    });
    if (!clamped.shape) return;
    void saveIntakeFn({ data: { token: t, answers: wizardToIntake(clamped) } }).catch(() => undefined);
  };

  const persistStep = (nextStep: number) => {
    const n = clampWizardStep(nextStep);
    stepRef.current = n;
    const t = tokenRef.current;
    if (t) {
      rememberDraft({
        token: t,
        step: n,
        answers: wizardToIntake(wizardRef.current),
        wizard: wizardRef.current,
      });
    }
    onSearch((prev) => withGetAPriceStep(withGetAPriceToken(prev, t || prev.t || ""), n));
  };

  const startOver = async () => {
    setError(null);
    setBusy(true);
    clearGetAPriceStorage();
    const fresh = emptyPriceWizard();
    setWizard(fresh);
    wizardRef.current = fresh;
    setWizardKey((k) => k + 1);
    try {
      const p = await startProspectFn();
      setToken(p.publicToken);
      tokenRef.current = p.publicToken;
      rememberDraft({
        token: p.publicToken,
        step: 1,
        answers: emptyIntakeAnswers(),
        wizard: fresh,
      });
      onSearch({ t: p.publicToken, step: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start over");
      onSearch({});
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Opening Get a price…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void startOver()}>
          Start over
        </Button>
      </div>
      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <PriceWizard
        key={wizardKey}
        token={token}
        catalog={catalog}
        state={wizard}
        step={step}
        onChange={persistWizard}
        onStep={persistStep}
      />
    </div>
  );
}
