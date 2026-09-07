import { useEffect, useState } from "react";
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
  putGetAPriceTokenInUrl,
  readGetAPriceDraft,
  stripGetAPriceTokenFromUrl,
  writeGetAPriceDraft,
} from "@/lib/saas/get-a-price-draft";
import { Button } from "@/components/ui/button";
import { PriceWizard } from "./PriceWizard";
import {
  answersToWizard,
  emptyPriceWizard,
  parsePriceWizard,
  wizardToIntake,
  type PriceWizardState,
} from "@/lib/saas/price-wizard";

function rememberDraft(opts: {
  token: string;
  answers: IntakeAnswers;
  wizard: PriceWizardState;
}) {
  writeProspectToken(opts.token);
  putGetAPriceTokenInUrl(opts.token);
  writeGetAPriceDraft({
    token: opts.token,
    step: 1,
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

export function IntakeWizard({ initialToken }: { initialToken?: string }) {
  const [token, setToken] = useState(initialToken ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [wizard, setWizard] = useState<PriceWizardState>(emptyPriceWizard);
  const [wizardKey, setWizardKey] = useState(0);
  const [catalog, setCatalog] = useState<QuoteCatalog>(DEFAULT_QUOTE_CATALOG);

  useEffect(() => {
    void loadPublicQuoteCatalogFn()
      .then((r) => setCatalog(r.catalog))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
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
        const existing =
          decision.action === "restore" ? draft?.token || initialToken || null : null;
        if (decision.action === "empty") {
          clearGetAPriceStorage();
          stripGetAPriceTokenFromUrl();
        }
        if (existing) {
          try {
            const p = await getProspectFn({ data: { token: existing } });
            if (cancelled) return;
            setToken(p.publicToken);
            const restoredAnswers = draft?.data ? answersFromDraft(draft.data) : p.answers;
            const restoredWizard = draft?.data
              ? wizardFromDraft(draft.data, restoredAnswers)
              : answersToWizard(p.answers);
            setWizard(restoredWizard);
            rememberDraft({
              token: p.publicToken,
              answers: wizardToIntake(restoredWizard),
              wizard: restoredWizard,
            });
            if (p.status !== "prospect") {
              clearGetAPriceStorage();
              return;
            }
            return;
          } catch {
            /* new intake */
          }
        }
        const p = await startProspectFn();
        if (cancelled) return;
        setToken(p.publicToken);
        const fresh = emptyPriceWizard();
        setWizard(fresh);
        rememberDraft({ token: p.publicToken, answers: wizardToIntake(fresh), wizard: fresh });
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
  }, [initialToken]);

  const persist = (next: PriceWizardState) => {
    setWizard(next);
    if (!token) return;
    const answers = wizardToIntake(next);
    rememberDraft({ token, answers, wizard: next });
    void saveIntakeFn({ data: { token, answers } }).catch(() => undefined);
  };

  const startOver = async () => {
    setError(null);
    setBusy(true);
    clearGetAPriceStorage();
    stripGetAPriceTokenFromUrl();
    const fresh = emptyPriceWizard();
    setWizard(fresh);
    setWizardKey((k) => k + 1);
    try {
      const p = await startProspectFn();
      setToken(p.publicToken);
      rememberDraft({ token: p.publicToken, answers: wizardToIntake(fresh), wizard: fresh });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start over");
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
        key={`${token}-${wizardKey}`}
        token={token}
        catalog={catalog}
        initial={wizard}
        onChange={persist}
      />
    </div>
  );
}
