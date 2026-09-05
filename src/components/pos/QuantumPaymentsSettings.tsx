import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { getPaymentsStatusFn } from "@/lib/payments/api";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";
import type { LocationPaymentsMode, PaymentsStatus } from "@/lib/payments/types";
import { isProspectDemo } from "@/lib/demo/session";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";

export function QuantumPaymentsSettings({ write }: { write: boolean }) {
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const peerVenue = usePosStore(
    (s) => Boolean(s.settings.peerVenue || s.settings.operatingModel === "peer_venue"),
  );
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    if (!locId) return;
    void getPaymentsStatusFn({ data: { locationId: locId } })
      .then(setStatus)
      .catch(() => undefined);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locId]);

  const saveMode = (paymentsMode: LocationPaymentsMode) => {
    if (!write || isProspectDemo() || !orgId || !locId) return;
    if (paymentsMode === "live" && status?.lifecycleForcesSandbox) return;
    if (paymentsMode === "live" && !status?.readers.some((r) => r.serial)) return;
    setSaving(true);
    void saveLocationSettingsFn({
      data: { orgId, locationId: locId, setup: { paymentsMode } },
    })
      .then(() => reload())
      .finally(() => setSaving(false));
  };

  if (!locId) return null;

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
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
        Each brand is its own Quantum Payments account. The guest still pays one
        check — capture splits by merchandise owner. Tablets run POS; live cards
        require an enrolled Finix/Quantum reader supplied through Summex.
        Customer-owned Square, Stripe, or bank terminals are not supported.
        Training/sandbox works without a physical reader (cash + sandbox). Never
        store PAN or CVV. Cash still works if the processor is down.
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
      {status?.entityMerchants && status.entityMerchants.length > 0 && (
        <ul className="space-y-1 text-xs">
          {status.entityMerchants.map((m) => (
            <li key={`${m.kind}:${m.entityId}`} className="flex justify-between gap-2">
              <span>
                {m.displayName}
                <span className="text-muted-foreground"> · {m.kind}</span>
              </span>
              <span className="tabular text-muted-foreground">
                {m.status}
                {m.canCapture ? "" : " · blocked"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {peerVenue || status?.operatingModel === "peer_venue" ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          This is a shared venue. The building name is guest branding only — not a merchant.
          Each operator completes their own Quantum Payments application. Live cards wait
          until every selling entity is approved (sandbox is OK in training).
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
