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
import {
  EMPTY_ENTITY_KYC,
  FINIX_KYC_LABEL,
  FINIX_KYC_STATUSES,
  KYC_MCC_LABEL,
  KYC_MCCS,
  MCC_5813_COPY,
  kycStatusFromOnboarding,
  parseEntityKyc,
  parseEntityKycMap,
  type EntityKyc,
  type FinixKycStatus,
} from "@/lib/payments/entity-kyc";
import { persistEntityKyc } from "@/lib/pos/persist-location-setup";
import { usePosStore } from "@/lib/pos/store";
import { noteChecklistSave } from "@/lib/saas/checklist-link";

const STATUS_BADGE: Record<FinixKycStatus, "secondary" | "info" | "warn" | "success" | "danger"> = {
  draft: "secondary",
  submitted: "info",
  pending: "warn",
  approved: "success",
  action_required: "danger",
};

export function QuantumPaymentsOnboardPanel({
  locationId,
  operatorId,
  legalName,
  kind,
  peerVenue = false,
}: {
  locationId?: string;
  operatorId?: string;
  legalName?: string;
  kind: "host" | "operator";
  /** Peer / no-host-merchant: never fetch or setState for a venue Finix application. */
  peerVenue?: boolean;
}) {
  const kycKey = operatorId || locationId || "host";
  const [acc, setAcc] = useState<PaymentAccountView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kyc, setKyc] = useState<EntityKyc>(() => {
    const stored = parseEntityKyc(usePosStore.getState().settings.entityKyc?.[kycKey]);
    return {
      ...EMPTY_ENTITY_KYC,
      ...stored,
      legalName: stored.legalName || legalName || "",
      dba: stored.dba || legalName || "",
    };
  });

  const noVenueFinix = peerVenue && kind === "host";
  const key = { locationId, operatorId };

  const saveLocal = (next: EntityKyc) => {
    setKyc(next);
    const map = parseEntityKycMap(usePosStore.getState().settings.entityKyc);
    map[kycKey] = next;
    usePosStore.getState().updateSettings({ entityKyc: map });
    persistEntityKyc();
    noteChecklistSave({ tab: "payments", focus: "finix" });
    noteChecklistSave({ tab: "payments", focus: "payout" });
    noteChecklistSave({ tab: "payments", focus: "legal-name" });
  };

  const load = useCallback(async () => {
    if (noVenueFinix) return;
    if (!operatorId && peerVenue) return;
    if (!locationId && !operatorId) return;
    try {
      const row = await getPaymentsOnboardingFn({
        data: peerVenue ? { locationId, operatorId } : key,
      });
      setAcc(row);
      setKyc((prev) => {
        const fromServer = kycStatusFromOnboarding(row.entityStatus ?? row.onboardingStatus);
        return {
          ...prev,
          legalName: prev.legalName || row.displayName || legalName || "",
          dba: prev.dba || row.displayName || "",
          bankLast4: prev.bankLast4 || row.payoutBankLast4 || "",
          routingLast4: prev.routingLast4 || row.payoutRoutingLast4 || "",
          status: prev.status === "draft" ? fromServer : prev.status,
        };
      });
    } catch {
      /* isolated demo / no org — keep local KYC */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, operatorId, peerVenue, noVenueFinix]);

  useEffect(() => {
    if (noVenueFinix) return;
    void load();
  }, [load, noVenueFinix]);

  const start = async () => {
    if (noVenueFinix || (peerVenue && !operatorId)) return;
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
    if (noVenueFinix || (peerVenue && !operatorId)) return;
    setBusy(true);
    setError(null);
    try {
      const next = { ...kyc, status: "submitted" as const };
      saveLocal(next);
      const row = await submitSandboxPaymentsFn({
        data: {
          ...key,
          legalName: next.legalName || next.dba || acc?.displayName || "Business",
          ownerName: next.owners || undefined,
          bankLast4: next.bankLast4,
          routingLast4: next.routingLast4 || undefined,
        },
      });
      setAcc(row);
    } catch {
      saveLocal({ ...kyc, status: "submitted" });
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
      saveLocal({ ...kyc, status: kycStatusFromOnboarding(row.entityStatus ?? row.onboardingStatus) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh");
    } finally {
      setBusy(false);
    }
  };

  const status = kyc.status;
  const sandboxRail = !acc?.finixConfigured || acc.paymentsProvider === "sandbox";
  const patch = (p: Partial<EntityKyc>) => saveLocal({ ...kyc, ...p });

  if (noVenueFinix) {
    return (
      <p className="text-xs text-muted-foreground" data-demo="no-venue-finix">
        This venue has no Finix merchant and no venue payout account. Open a selling
        entity application instead.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4" data-demo="entity-kyc">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {kind === "host" ? "Venue Payments / KYC" : "Entity Payments / KYC"}
        </p>
        <Badge variant={STATUS_BADGE[status]}>{FINIX_KYC_LABEL[status]}</Badge>
        <GuideLearnLink topicId="quantum-payments" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        {kind === "host"
          ? "This location’s Quantum Payments merchant (Finix rail). Each brand on a check is its own account; the guest still pays one tender. Complete this before live cards. Cash always works."
          : "This brand’s Quantum Payments / Finix sub-merchant. Guest still pays one check — your merchandise lands here. Live cards wait until this application is approved."}
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
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Legal name</span>
          <Input
            value={kyc.legalName}
            data-checklist-focus="legal-name"
            onChange={(e) => patch({ legalName: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">DBA</span>
          <Input value={kyc.dba} onChange={(e) => patch({ dba: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">EIN</span>
          <Input value={kyc.ein} onChange={(e) => patch({ ein: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Owners</span>
          <Input
            value={kyc.owners}
            onChange={(e) => patch({ owners: e.target.value })}
            placeholder="Beneficial owners"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">Address</span>
          <Input value={kyc.address} onChange={(e) => patch({ address: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">City</span>
          <Input value={kyc.city} onChange={(e) => patch({ city: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">State</span>
            <Input
              value={kyc.state}
              maxLength={2}
              onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">ZIP</span>
            <Input value={kyc.postal} onChange={(e) => patch({ postal: e.target.value })} />
          </label>
        </div>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">MCC</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={kyc.mcc}
            onChange={(e) => patch({ mcc: e.target.value as EntityKyc["mcc"] })}
          >
            <option value="">Select MCC</option>
            {KYC_MCCS.map((m) => (
              <option key={m} value={m}>
                {KYC_MCC_LABEL[m]}
              </option>
            ))}
          </select>
          {kyc.mcc === "5813" && (
            <p className="mt-1 text-xs text-muted-foreground" data-demo="mcc-5813">
              {MCC_5813_COPY}
            </p>
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Bank / payout account</span>
          <Input
            value={kyc.bankName}
            onChange={(e) => patch({ bankName: e.target.value })}
            placeholder="Bank name"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Account last 4</span>
            <Input
              maxLength={4}
              inputMode="numeric"
              value={kyc.bankLast4}
              onChange={(e) => patch({ bankLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Routing last 4</span>
            <Input
              maxLength={4}
              inputMode="numeric"
              value={kyc.routingLast4}
              onChange={(e) => patch({ routingLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </label>
        </div>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">
            Finix sub-merchant application status
          </span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={kyc.status}
            onChange={(e) => patch({ status: e.target.value as FinixKycStatus })}
          >
            {FINIX_KYC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FINIX_KYC_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {acc?.rejectionReason && (
        <p className="text-xs text-danger">{acc.rejectionReason}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <Button size="sm" disabled={busy} onClick={() => void start()}>
            Start application
          </Button>
        )}
        <Button
          size="sm"
          disabled={busy || kyc.bankLast4.length !== 4 || kyc.legalName.trim().length < 2}
          onClick={() => void submit()}
        >
          Submit application
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
          Refresh status
        </Button>
      </div>
    </div>
  );
}
