import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { QuoteSummary } from "@/components/saas/QuoteSummary";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  acceptQuoteFn,
  claimProspectFn,
  getProspectFn,
  issueQuoteFn,
} from "@/lib/saas/api";
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

  if (error) {
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

  const accept = async () => {
    if (!user) {
      window.location.href = `/signup?next=${encodeURIComponent(`/quote/${token}`)}`;
      return;
    }
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

  const regen = async () => {
    setBusy(true);
    try {
      await issueQuoteFn({ data: { token } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh quote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Proposal
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tighter">
          {detail.answers.company.legalName || "Your quote"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Snapshot of software fees. Guest processing is Summex Payments, billed
          separately. Gift cards stay first-party.
        </p>

        {detail.quote ? (
          <div className="mt-8">
            <QuoteSummary quote={detail.quote} status={detail.status} />
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">No quote yet.</p>
        )}

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {detail.status === "quoted" && (
            <Button disabled={busy || isPending} onClick={() => void accept()}>
              {user ? "Accept quote" : "Sign in to accept"}
            </Button>
          )}
          {(detail.status === "prospect" || detail.status === "quoted") && (
            <Button variant="outline" disabled={busy} onClick={() => void regen()}>
              Recalculate
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
    </MarketingShell>
  );
}
