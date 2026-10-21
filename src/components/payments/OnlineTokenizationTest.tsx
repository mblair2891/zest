import { useEffect, useState } from "react";
import { FinixCardForm } from "@/components/payments/CardNotPresentReview";
import { sandboxExchangeTokenFn, sandboxTokenFormConfigFn } from "@/lib/payments/api";

/**
 * Platform → Payments → Online Tokenization Test.
 * The card number, expiration, and CVV stay in the Finix.js iframe.
 */
export function OnlineTokenizationTest() {
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [last4, setLast4] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void sandboxTokenFormConfigFn()
      .then((result) => {
        if (cancel) return;
        if (!result.ok) {
          setApplicationId(null);
          setConfigError(result.error);
          return;
        }
        setConfigError(null);
        setApplicationId(result.applicationId);
      })
      .catch(() => {
        if (!cancel) setConfigError("The card form did not load.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <section
      className="mb-4 space-y-3 rounded-2xl border border-border bg-surface p-4"
      data-online-tokenization-test=""
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Online Tokenization Test</h3>
        <span
          className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn"
          data-tokenize-test-only=""
        >
          Test only
        </span>
      </div>
      <p className="text-xs text-muted-foreground" data-tokenize-test-banner="">
        Sandbox tokenization form for Finix review. Simulates online order card entry.
      </p>
      <p className="text-xs text-muted-foreground" data-finix-environment="sandbox">
        Sandbox keys. The card number, expiration, and CVV stay in the Finix form.
      </p>
      {configError && (
        <p className="text-xs text-warn" role="status">
          {configError}
        </p>
      )}
      {applicationId && (
        <FinixCardForm
          environment="sandbox"
          applicationId={applicationId}
          submitLabel="Tokenize card"
          onError={setError}
          onToken={(nextToken) => {
            setTokenId(nextToken);
            setInstrumentId(null);
            setLast4(null);
            setError(null);
            setBusy(true);
            void sandboxExchangeTokenFn({ data: { token: nextToken } })
              .then((result) => {
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setTokenId(result.tokenId);
                setInstrumentId(result.instrumentId);
                setLast4(result.last4);
              })
              .catch(() => setError("The payment instrument was not created."))
              .finally(() => setBusy(false));
          }}
        />
      )}
      {busy && <p className="text-xs text-muted-foreground">Creating the payment instrument…</p>}
      {error && (
        <p className="text-xs text-warn" role="status">
          {error}
        </p>
      )}
      {tokenId && (
        <div className="space-y-1 text-xs" data-card-token-result="">
          <p data-card-token="">Token {tokenId}</p>
          {instrumentId ? <p data-payment-instrument="">Payment instrument {instrumentId}</p> : null}
          {last4 ? <p>Last four {last4}</p> : null}
          {instrumentId ? (
            <p data-tokenize-success="">Tokenization complete — Payment Instrument created.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
