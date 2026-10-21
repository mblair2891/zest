import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cardTokenFormConfigFn,
  chargeStoredInstrumentFn,
  exchangeCardTokenFn,
} from "@/lib/payments/api";
import { FINIX_JS_SRC, parseFinixTokenId } from "@/lib/payments/finix-tokenize";

type FinixTokenResponse = { data?: { id?: string } } | null;

type FinixPaymentForm = (
  element: string,
  environment: "sandbox" | "prod",
  application: string,
  options: {
    paymentMethods: ["card"];
    showAddress: false;
    submitLabel: string;
    onSubmit: (error: unknown, response: FinixTokenResponse) => void;
  },
) => void;

declare global {
  interface Window {
    Finix?: { PaymentForm: FinixPaymentForm };
  }
}

function finixErrorText(error: unknown): string {
  if (!error) return "The card form did not return a token.";
  if (typeof error === "string") return error.slice(0, 200);
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 200);
  }
  return "The card form did not return a token.";
}

/**
 * Hosted Finix.js card form. Card number, expiration, and CVV stay in the iframe.
 * Online and card-not-present charges use this form.
 */
export function FinixCardForm({
  environment,
  applicationId,
  submitLabel,
  onToken,
  onError,
}: {
  environment: "sandbox" | "prod";
  applicationId: string;
  submitLabel: string;
  onToken: (tokenId: string) => void;
  onError: (message: string) => void;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `finix-card-form-${reactId}`;
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    const host = document.getElementById(elementId);
    if (!host || !applicationId) return;
    let cancel = false;
    host.replaceChildren();
    const start = () => {
      if (cancel || !window.Finix?.PaymentForm) return;
      window.Finix.PaymentForm(elementId, environment, applicationId, {
        paymentMethods: ["card"],
        showAddress: false,
        submitLabel,
        onSubmit(error, response) {
          if (error) {
            onErrorRef.current(finixErrorText(error));
            return;
          }
          const tokenId = parseFinixTokenId(response?.data?.id);
          if (!tokenId) {
            onErrorRef.current("The card form did not return a token.");
            return;
          }
          onTokenRef.current(tokenId);
        },
      });
    };
    if (window.Finix?.PaymentForm) {
      start();
      return () => {
        cancel = true;
      };
    }
    let script = document.querySelector(`script[src="${FINIX_JS_SRC}"]`) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.src = FINIX_JS_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", start);
    return () => {
      cancel = true;
      script?.removeEventListener("load", start);
    };
  }, [applicationId, elementId, environment, submitLabel]);

  return <div id={elementId} data-finix-card-form="" className="min-h-24" />;
}

type FormConfig = {
  environment: "sandbox" | "prod";
  applicationId: string;
  mode: "sandbox" | "live";
  merchantReady: boolean;
};

type InstrumentRow = {
  tokenId: string;
  identityId: string;
  instrumentId: string;
  last4: string | null;
  paymentId: string;
};

function dollarsToCents(raw: string): number {
  const value = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

/**
 * Payments → Online card. A reviewer tokenizes a test card in the Finix form,
 * sees the payment instrument, and can create a transfer from that instrument.
 */
export function CardNotPresentReview({
  orgId,
  locationId,
  entityId,
  amountCents,
  orderId,
  checkId,
  customerRef,
  submitLabel = "Tokenize card",
  guest = false,
  onInstrument,
}: {
  orgId: string;
  locationId: string;
  entityId?: string;
  amountCents?: number;
  orderId?: string;
  checkId?: string;
  customerRef?: string;
  submitLabel?: string;
  /** Guest online checkout. The card form stays. The processor name stays off this copy. */
  guest?: boolean;
  onInstrument?: (row: InstrumentRow) => void;
}) {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<InstrumentRow | null>(null);
  const [label, setLabel] = useState(customerRef ?? "");
  const [dollars, setDollars] = useState(amountCents != null ? (amountCents / 100).toFixed(2) : "1.00");
  const [transferId, setTransferId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !locationId) return;
    let cancel = false;
    void cardTokenFormConfigFn({ data: { orgId, locationId, entityId } })
      .then((result) => {
        if (cancel) return;
        if (!result.ok) {
          setConfig(null);
          setConfigError(result.error);
          return;
        }
        setConfigError(null);
        setConfig({
          environment: result.environment,
          applicationId: result.applicationId,
          mode: result.mode,
          merchantReady: result.merchantReady,
        });
      })
      .catch(() => {
        if (!cancel) setConfigError("The card form did not load.");
      });
    return () => {
      cancel = true;
    };
  }, [orgId, locationId, entityId]);

  const cents = amountCents != null ? Math.max(0, Math.round(amountCents)) : dollarsToCents(dollars);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-online-card="">
      <div>
        <p className="text-sm font-medium">{guest ? "Pay by card" : "Online card"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {guest
            ? "The card number, expiration, and CVV stay in the card form."
            : "The card number, expiration, and CVV stay in the Finix form. A successful form returns a token. Summex creates a payment instrument from that token and stores it on the order. Create transfer uses that payment instrument."}
        </p>
      </div>
      {configError && (
        <p className="text-xs text-warn" role="status">
          {configError}
        </p>
      )}
      {config && (
        <>
          {!guest && (
            <p className="text-xs text-muted-foreground" data-finix-environment={config.environment}>
              {config.mode === "live" ? "Live keys" : "Sandbox keys"} · {config.environment}
              {config.merchantReady ? "" : " · Save a merchant before creating a transfer."}
            </p>
          )}
          {!guest && !amountCents && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Order or customer label"
                aria-label="Order or customer label"
              />
              <Input
                value={dollars}
                onChange={(event) => setDollars(event.target.value)}
                placeholder="1.00"
                inputMode="decimal"
                aria-label="Transfer amount"
              />
            </div>
          )}
          <FinixCardForm
            environment={config.environment}
            applicationId={config.applicationId}
            submitLabel={submitLabel}
            onError={setError}
            onToken={(tokenId) => {
              setBusy(true);
              setError(null);
              setTransferId(null);
              void exchangeCardTokenFn({
                data: {
                  orgId,
                  locationId,
                  entityId,
                  token: tokenId,
                  name: label || undefined,
                  customerRef: label || customerRef,
                  orderId,
                  checkId,
                  amountCents: cents,
                },
              })
                .then((result) => {
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  const next = {
                    tokenId: result.tokenId,
                    identityId: result.identityId,
                    instrumentId: result.instrumentId,
                    last4: result.last4,
                    paymentId: result.paymentId,
                  };
                  setRow(next);
                  onInstrument?.(next);
                })
                .catch(() => setError("The payment instrument was not created."))
                .finally(() => setBusy(false));
            }}
          />
        </>
      )}
      {busy && <p className="text-xs text-muted-foreground">Creating the payment instrument…</p>}
      {error && (
        <p className="text-xs text-warn" role="status">
          {error}
        </p>
      )}
      {row && (
        <div className="space-y-1 text-xs" data-card-token-result="">
          <p data-card-token="">Token {row.tokenId}</p>
          <p data-payment-instrument="">Payment instrument {row.instrumentId}</p>
          <p>Buyer {row.identityId}</p>
          {row.last4 ? <p>Last four {row.last4}</p> : null}
          {!guest && (
          <Button
            type="button"
            size="sm"
            data-create-transfer=""
            disabled={busy || cents <= 0}
            onClick={() => {
              setBusy(true);
              setError(null);
              void chargeStoredInstrumentFn({
                data: {
                  orgId,
                  locationId,
                  entityId,
                  paymentId: row.paymentId,
                  amountCents: cents,
                  kind: "transfer",
                },
              })
                .then((result) => {
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setTransferId(result.id);
                })
                .catch(() => setError("The transfer was not created."))
                .finally(() => setBusy(false));
            }}
          >
            Create transfer
          </Button>
          )}
          {transferId && <p data-finix-transfer="">Transfer {transferId}</p>}
        </div>
      )}
    </div>
  );
}
