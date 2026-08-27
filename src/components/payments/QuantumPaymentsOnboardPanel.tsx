import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  getPaymentsOnboardingFn,
  refreshPaymentsOnboardingFn,
  startPaymentsOnboardingFn,
  submitSandboxPaymentsFn,
} from "@/lib/payments/onboarding-api";
import type { PaymentAccountView } from "@/lib/payments/onboarding.server";

const STATUS_BADGE: Record<string, "secondary" | "info" | "warn" | "success" | "danger"> = {
  not_started: "secondary",
  in_progress: "info",
  submitted: "warn",
  approved: "success",
  rejected: "danger",
  needs_info: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Needs attention",
  needs_info: "Update info",
};

export function QuantumPaymentsOnboardPanel({
  locationId,
  operatorId,
  legalName,
  kind,
}: {
  locationId?: string;
  operatorId?: string;
  legalName?: string;
  kind: "host" | "operator";
}) {
  const [acc, setAcc] = useState<PaymentAccountView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState(legalName ?? "");
  const [owner, setOwner] = useState("");
  const [bankLast4, setBankLast4] = useState("");
  const [routingLast4, setRoutingLast4] = useState("");

  const key = { locationId, operatorId };

  const load = useCallback(async () => {
    if (!locationId && !operatorId) return;
    try {
      const row = await getPaymentsOnboardingFn({ data: key });
      setAcc(row);
      if (row.payoutBankLast4) setBankLast4(row.payoutBankLast4);
      if (row.payoutRoutingLast4) setRoutingLast4(row.payoutRoutingLast4);
      if (!legal && row.displayName) setLegal(row.displayName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments status");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, operatorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const row = await startPaymentsOnboardingFn({
        data: {
          ...key,
          returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      setAcc(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start application");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const row = await submitSandboxPaymentsFn({
        data: {
          ...key,
          legalName: legal || acc?.displayName || "Business",
          ownerName: owner || undefined,
          bankLast4,
          routingLast4: routingLast4 || undefined,
        },
      });
      setAcc(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const row = await refreshPaymentsOnboardingFn({ data: key });
      setAcc(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh");
    } finally {
      setBusy(false);
    }
  };

  const status = acc?.onboardingStatus ?? "not_started";
  const sandboxRail = !acc?.finixConfigured || acc.paymentsProvider === "sandbox";

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Quantum Payments</p>
        <Badge variant={STATUS_BADGE[status] ?? "secondary"}>
          {STATUS_LABEL[status] ?? status}
        </Badge>
        <GuideLearnLink topicId="quantum-payments" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        {kind === "host"
          ? "Guest cards capture once under the host brand. Complete this application before turning on live cards. Cash always works."
          : "Payout account for your share of host capture. You can still be ticketed in POS on sandbox and cash before this is approved."}
      </p>
      {sandboxRail && (
        <p className="text-xs text-muted-foreground">
          Sandbox application — recorded on Summex. Not a live card capture. Sensitive KYC stays
          off this form (no SSN, PAN, or full account numbers).
        </p>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {acc?.onboardingLink && (
        <iframe
          title="Quantum Payments application"
          src={acc.onboardingLink}
          className="h-[28rem] w-full rounded-xl border border-border bg-bg"
        />
      )}
      {acc?.rejectionReason && (
        <p className="text-xs text-danger">{acc.rejectionReason}</p>
      )}
      {status !== "approved" && !acc?.onboardingLink && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Legal business name</span>
            <Input value={legal} onChange={(e) => setLegal(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Beneficial owner (name)</span>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Deposit account last 4</span>
            <Input
              maxLength={4}
              inputMode="numeric"
              value={bankLast4}
              onChange={(e) => setBankLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Routing last 4</span>
            <Input
              maxLength={4}
              inputMode="numeric"
              value={routingLast4}
              onChange={(e) => setRoutingLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
        </div>
      )}
      {acc?.payoutBankLast4 && status === "approved" && (
        <p className="text-xs text-muted-foreground">
          Deposit account ••••{acc.payoutBankLast4}
          {acc.payoutRoutingLast4 ? ` · routing ••••${acc.payoutRoutingLast4}` : ""}
          {acc.approvedAt ? ` · approved ${new Date(acc.approvedAt).toLocaleDateString()}` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "not_started" && (
          <Button size="sm" disabled={busy} onClick={() => void start()}>
            Start application
          </Button>
        )}
        {(status === "in_progress" || status === "needs_info") && acc?.onboardingLink && (
          <Button size="sm" disabled={busy} onClick={() => void start()}>
            {status === "needs_info" ? "Update info" : "Continue application"}
          </Button>
        )}
        {status !== "approved" && !acc?.onboardingLink && (
          <Button
            size="sm"
            disabled={busy || bankLast4.length !== 4 || legal.trim().length < 2}
            onClick={() => void submit()}
          >
            Submit application
          </Button>
        )}
        {status !== "not_started" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
            Refresh status
          </Button>
        )}
      </div>
    </div>
  );
}
