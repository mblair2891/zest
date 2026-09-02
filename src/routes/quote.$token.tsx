import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { QuoteSummary } from "@/components/saas/QuoteSummary";
import { QuotePrintView } from "@/components/saas/QuotePrintView";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { acceptQuoteFn, claimProspectFn, getProspectFn, requestQuoteChangesFn } from "@/lib/saas/api";
import type { ProspectDetail } from "@/lib/saas/prospect-types";
import { writeProspectToken } from "@/lib/saas/prospect-token";

export const Route = createFileRoute("/quote/$token")({
  component: QuotePage,
});

function QuotePage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const load = () => {
    void getProspectFn({ data: { token } })
      .then((d) => {
        setDetail(d);
        writeProspectToken(d.publicToken);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!user || !detail) return;
    if (!detail.ownerUserId) {
      void claimProspectFn({ data: { token } }).then(load).catch(() => undefined);
    }
  }, [user, detail?.id]);

  if (error && !detail) {
    return (
      <MarketingShell>
        <main className="mx-auto max-w-xl px-4 py-16 text-sm text-danger">{error}</main>
      </MarketingShell>
    );
  }
  if (!detail) {
    return (
      <MarketingShell>
        <main className="mx-auto max-w-xl px-4 py-16 text-sm text-muted-foreground">
          Loading quote…
        </main>
      </MarketingShell>
    );
  }

  const sent = detail.status !== "prospect" && Boolean(detail.quote) && !detail.quote?.draft;
  const canAccept = detail.status === "quoted" && sent;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptQuoteFn({ data: { token } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  };

  const printQuote = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrinting(false), 300);
    }, 50);
  };

  return (
    <MarketingShell>
      <style>{`@media print { header, footer, .no-print { display: none !important; } body { background: #fff; } }`}</style>
      {printing && sent ? (
        <QuotePrintView detail={detail} />
      ) : (
        <main className="mx-auto max-w-3xl px-4 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Proposal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {detail.answers.company.legalName || "Your quote"}
          </h1>
          {!sent ? (
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              We received your pricing request
              {detail.answers.company.billingEmail
                ? ` for ${detail.answers.company.billingEmail}`
                : ""}
              . Summex will send a proposal to that inbox. This page updates when it is sent.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Snapshot of software fees. Guest processing is Quantum Payments, billed
              separately. Gift cards stay first-party.
            </p>
          )}

          {sent && detail.quote ? (
            <div className="mt-8">
              <QuoteSummary quote={detail.quote} status={detail.status} />
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Status: request received. A platform admin is preparing the quote from live plans.
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="no-print mt-8 flex flex-wrap gap-2">
            {canAccept && (
              <Button disabled={busy || isPending} onClick={() => void accept()}>
                Accept quote
              </Button>
            )}
            {canAccept && (
              <div className="flex w-full flex-wrap items-center gap-2">
                <input
                  className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-bg px-3 text-sm"
                  placeholder="Request changes…"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={busy || changeNote.trim().length < 4}
                  onClick={() => {
                    setBusy(true);
                    void requestQuoteChangesFn({ data: { token, message: changeNote } })
                      .then(() => {
                        setChangeNote("");
                        load();
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : "Could not send"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Request changes
                </Button>
              </div>
            )}
            {sent && (
              <Button variant="outline" onClick={printQuote}>
                Print / PDF
              </Button>
            )}
            <Link
              to="/get-pricing"
              search={{ t: token }}
              className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm"
            >
              Edit answers
            </Link>
            {detail.status === "accepted" && (
              <p className="w-full text-sm text-muted-foreground">
                Accepted. A platform admin will mark the contract signed. Onboarding
                unlocks after that.
              </p>
            )}
            {(detail.status === "contracted" ||
              detail.status === "onboarding" ||
              detail.status === "live") && (
              <Button onClick={() => void navigate({ to: "/setup/$token", params: { token } })}>
                Continue onboarding
              </Button>
            )}
          </div>
        </main>
      )}
    </MarketingShell>
  );
}
