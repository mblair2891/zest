import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { ProspectRecord } from "@/lib/saas/prospect-types";
import {
  acceptQuote,
  getProspectByToken,
} from "@/lib/saas/prospect-fns";
import { IntakeWizard } from "./IntakeWizard";
import { QuoteCard } from "./QuoteCard";

export function ProspectPortal({ token }: { token: string }) {
  const [rec, setRec] = useState<ProspectRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    getProspectByToken({ data: token }).then((r) => {
      setRec(r);
      if (!r) setError("This pricing link was not found.");
    });

  useEffect(() => {
    void load();
  }, [token]);

  if (!rec) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading…"}
      </p>
    );
  }

  if (rec.status === "prospect") {
    return <IntakeWizard initialToken={token} />;
  }

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await acceptQuote({ data: token });
      setRec(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rec.company.legalName || rec.company.dba || "Prospect"}
        </p>
        <p className="mt-1 text-lg font-semibold capitalize">
          Status: {rec.status}
        </p>
        <p className="text-sm text-muted-foreground">
          Guest-facing brand: {rec.company.dba || "—"}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {rec.quote && <QuoteCard quote={rec.quote} />}

      {rec.status === "quoted" && (
        <Button disabled={busy} onClick={() => void accept()}>
          {busy ? "Saving…" : "Accept quote"}
        </Button>
      )}

      {rec.status === "accepted" && (
        <p className="text-sm text-muted-foreground">
          Quote accepted. A platform admin will mark the contract signed. You
          will then continue onboarding at this same link.
        </p>
      )}

      {(rec.status === "contracted" ||
        rec.status === "onboarding" ||
        rec.status === "live") && (
        <Link to="/onboard/$token" params={{ token }}>
          <Button>Continue onboarding</Button>
        </Link>
      )}
    </div>
  );
}
