import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { getPaymentsStatusFn } from "@/lib/payments/api";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";
import type { LocationPaymentsMode, PaymentsStatus } from "@/lib/payments/types";
import { isProspectDemo } from "@/lib/demo/session";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useDemoOperatingEntityId } from "@/lib/demo/use-demo-operating-entity";
import {
  FINIX_KYC_LABEL,
  KYC_MCC_LABEL,
  parseEntityKyc,
  parseEntityKycMap,
  type FinixKycStatus,
  type KycMcc,
} from "@/lib/payments/entity-kyc";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { parseGiftLimits } from "@/lib/pos/gift-limits";
import { formatCurrency } from "@/lib/utils";

/**
 * Venue / entity Payments.
 * Peer venues (hostEntityId null, Operating as House): never mount a venue Finix
 * application or payout form, and never setState from hostMerchant / payout /
 * Finix-on-venue in an effect.
 */
export function QuantumPaymentsSettings({ write }: { write: boolean }) {
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const peerVenue = usePosStore(
    (s) => Boolean(s.settings.peerVenue || s.settings.operatingModel === "peer_venue"),
  );
  const vendors = usePosStore((s) => s.vendors);
  const entityKyc = usePosStore((s) => s.settings.entityKyc);
  const paymentMethods = usePosStore((s) => s.settings.paymentMethods);
  const giftSettings = usePosStore((s) => s.settings);
  const giftCards = usePosStore((s) => s.giftCards);
  const setView = usePosStore((s) => s.setView);
  const demoScope = useDemoOperatingEntityId();
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const selling = vendors.filter((v) => v.active);
  const entityId = demoScope || pickedId;
  const venueLevel = peerVenue && !entityId;

  useEffect(() => {
    if (!locId) return;
    let cancelled = false;
    void getPaymentsStatusFn({ data: { locationId: locId } })
      .then((row) => {
        if (!cancelled) setStatus(row);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locId]);

  const saveMode = (paymentsMode: LocationPaymentsMode) => {
    if (!write || isProspectDemo() || !orgId || !locId) return;
    if (paymentsMode === "live" && status?.lifecycleForcesSandbox) return;
    if (paymentsMode === "live" && !status?.readers.some((r) => r.serial)) return;
    setSaving(true);
    void saveLocationSettingsFn({
      data: { orgId, locationId: locId, setup: { paymentsMode } },
    })
      .then(() =>
        getPaymentsStatusFn({ data: { locationId: locId } }).then(setStatus),
      )
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  if (!locId) return null;

  const kycMap = parseEntityKycMap(entityKyc);
  const payCfg = parsePaymentMethods(paymentMethods);
  const enabledMethods = [
    payCfg.cash ? "Cash" : null,
    payCfg.card ? "Card (Quantum Payments)" : null,
    payCfg.giftCard ? "Gift" : null,
    payCfg.check ? "Check" : null,
    payCfg.houseAccount ? "House account" : null,
    payCfg.comp ? "Comp" : null,
    payCfg.other ? payCfg.otherLabel || "Other" : null,
  ].filter(Boolean) as string[];
  const giftLimits = parseGiftLimits(giftSettings);
  const giftOutstanding = giftCards
    .filter((g) => g.active && g.status !== "void" && g.status !== "closed")
    .reduce((s, g) => s + g.balanceCents, 0);

  const entity = entityId ? selling.find((v) => v.id === entityId) : null;

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-border bg-surface p-4" data-demo="venue-payments">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Quantum Payments</h3>
        <Badge variant={status?.mode === "live" && status.liveReady ? "success" : "warn"}>
          {status?.lifecycleForcesSandbox
            ? "Sandbox · training"
            : status?.mode === "live"
              ? status.liveReady
                ? "Live"
                : "Live · not ready"
              : "Sandbox"}
        </Badge>
        <GuideLearnLink topicId="quantum-payments" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        Quantum Payments. The guest pays once. Finix splits by line owner. No processor
        marketplace — card is Quantum Payments only.
      </p>
      {status?.lifecycleForcesSandbox && (
        <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs font-medium text-warn">
          TRAINING — live processor keys are ignored. Quantum Payments sandbox
          only until this location goes live.
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Capture mode</span>
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write || saving || status?.lifecycleForcesSandbox}
          value={
            status?.lifecycleForcesSandbox
              ? "sandbox"
              : (status?.locationOverride ?? "inherit")
          }
          onChange={(e) => saveMode(e.target.value as LocationPaymentsMode)}
        >
          <option value="inherit">
            Inherit platform default ({status?.platformDefault ?? "sandbox"})
          </option>
          <option value="sandbox">Sandbox (training)</option>
          <option
            value="live"
            disabled={
              !(status?.sellingMerchantsReady ?? status?.hostPaymentsApproved) ||
              status?.lifecycleForcesSandbox ||
              !status?.readers.some((r) => r.serial)
            }
          >
            Live card-present
            {status?.lifecycleForcesSandbox
              ? " (go live first)"
              : !(status?.sellingMerchantsReady ?? status?.hostPaymentsApproved)
                ? " (each selling entity must be approved)"
                : !status?.readers.some((r) => r.serial)
                  ? " (enroll a Finix/Quantum reader)"
                  : ""}
          </option>
        </select>
      </label>
      {status && <p className="text-xs text-muted-foreground">{status.message}</p>}

      {venueLevel ? (
        <PeerVenuePaymentsHome
          enabledMethods={enabledMethods}
          giftOutstanding={giftOutstanding}
          giftLimits={giftLimits}
          selling={selling.map((v) => {
            const kyc = kycMap[v.id] ?? parseEntityKyc(undefined);
            return {
              id: v.id,
              name: v.name,
              mcc: kyc.mcc,
              status: kyc.status,
            };
          })}
          onOpen={(id) => setPickedId(id)}
          onGift={() => setView("customers")}
        />
      ) : entity && peerVenue ? (
        <div className="space-y-3">
          {!demoScope && (
            <Button size="sm" variant="outline" type="button" onClick={() => setPickedId(null)}>
              ← All selling entities
            </Button>
          )}
          <QuantumPaymentsOnboardPanel
            kind="operator"
            operatorId={entity.id}
            locationId={locId}
            legalName={entity.name}
            peerVenue
          />
          <p className="text-xs text-muted-foreground">
            Reader enrollment: live cards need a Finix/Quantum reader on Devices. Training
            / sandbox works without a physical reader. Tablets are not card readers.
          </p>
        </div>
      ) : peerVenue ? (
        <p className="text-xs text-muted-foreground">
          This is a shared venue. The building has no Finix merchant and no venue payout
          account. Open a selling entity to complete its Payments / KYC application.
        </p>
      ) : (
        <QuantumPaymentsOnboardPanel kind="host" locationId={locId} />
      )}

      {status && status.readers.length > 0 && (
        <ul className="space-y-1 text-xs">
          {status.readers.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span>{r.label}</span>
              <span className="tabular text-muted-foreground">
                {r.serial || "no reader id"} · {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {status && status.readers.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No terminals enrolled. Devices → Hardware: add a Quantum reader (serial =
          processor reader id). SYOH tablets are not card readers.
        </p>
      )}
    </section>
  );
}

function PeerVenuePaymentsHome({
  enabledMethods,
  giftOutstanding,
  giftLimits,
  selling,
  onOpen,
  onGift,
}: {
  enabledMethods: string[];
  giftOutstanding: number;
  giftLimits: ReturnType<typeof parseGiftLimits>;
  selling: Array<{ id: string; name: string; mcc: KycMcc | ""; status: FinixKycStatus }>;
  onOpen: (id: string) => void;
  onGift: () => void;
}) {
  return (
    <div className="space-y-3" data-demo="peer-venue-payments">
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
        This is a shared venue. The building has no Finix merchant and no venue payout
        account. Each selling entity completes its own Payments / KYC application. The
        guest still pays one check — Finix splits by line owner.
      </p>
      <div className="rounded-xl border border-border px-3 py-2">
        <p className="text-xs font-medium">Payment methods</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {enabledMethods.length ? enabledMethods.join(" · ") : "None"} — change on
          Settings.
        </p>
      </div>
      <div className="rounded-xl border border-border px-3 py-2" data-demo="gift-ledger-summary">
        <p className="text-xs font-medium">First-party gift ledger</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Outstanding {formatCurrency(giftOutstanding)}. Max load / balance $
          {(giftLimits.maxBalanceCents / 100).toFixed(2)} · max sell per txn $
          {(giftLimits.maxSellPerTxnCents / 100).toFixed(2)}. In-ledger only — not sold
          online.
        </p>
        <Button size="sm" variant="outline" className="mt-2" type="button" onClick={onGift}>
          Limits / freeze / void
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {selling.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-border bg-bg px-3 py-3"
            data-demo="entity-payments-card"
          >
            <p className="text-sm font-semibold">{v.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              MCC {v.mcc ? KYC_MCC_LABEL[v.mcc] : "not set"}
            </p>
            <p className="text-xs text-muted-foreground">
              Finix {FINIX_KYC_LABEL[v.status]}
            </p>
            <Button
              size="sm"
              className="mt-2"
              type="button"
              onClick={() => onOpen(v.id)}
            >
              Open application
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
