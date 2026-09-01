import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, WizardChrome } from "./WizardChrome";
import {
  completeTenantOnboardFn,
  openTenantInviteFn,
  saveTenantOnboardFn,
} from "@/lib/saas/tenant-invite-api";
import {
  EMPTY_TENANT_PAYLOAD,
  TENANT_KIND_LABEL,
  TENANT_KINDS,
  type TenantInvitePeek,
  type TenantKind,
  type TenantOnboardPayload,
} from "@/lib/saas/tenant-invite";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";

const LABELS = ["Business", "Stations", "Staff", "Payouts", "Schedule", "Review"];

export function TenantOnboardWizard({
  token,
  peek,
}: {
  token: string;
  peek: TenantInvitePeek;
}) {
  const [payload, setPayload] = useState<TenantOnboardPayload>({
    ...EMPTY_TENANT_PAYLOAD,
    dba: peek.displayName,
    legalName: peek.displayName,
    pocName: peek.pocName,
    pocEmail: peek.email,
    stationKind: peek.stationKind,
  });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(peek.completed);

  useEffect(() => {
    void openTenantInviteFn({ data: { token } })
      .then((r) => setPayload((p) => ({ ...p, ...r.payload })))
      .catch(() => undefined);
  }, [token]);

  const patch = (fn: (p: TenantOnboardPayload) => TenantOnboardPayload) => {
    setPayload((prev) => fn(prev));
  };

  const persist = async () => {
    await saveTenantOnboardFn({ data: { token, payload } });
  };

  const go = async (next: number) => {
    setBusy(true);
    setError(null);
    try {
      await persist();
      setStep(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await completeTenantOnboardFn({ data: { token, payload } });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-lg font-semibold">Onboarding complete</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {peek.displayName} is on file for {peek.hostBrand}. The host still owns routing and
          payouts. Sign in later for entity-scoped ops.
        </p>
      </div>
    );
  }

  return (
    <WizardChrome
      title={`${peek.displayName} at ${peek.hostBrand}`}
      subtitle="Complete your operator details. You cannot change host billing or other tenants."
      step={step}
      total={6}
      labels={LABELS}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onNext={step < 6 ? () => void go(step + 1) : () => void submit()}
      nextLabel={step < 6 ? "Continue" : "Submit"}
    >
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name">
            <Input
              value={payload.legalName}
              onChange={(e) => patch((p) => ({ ...p, legalName: e.target.value }))}
            />
          </Field>
          <Field label="DBA / guest-facing">
            <Input value={payload.dba} onChange={(e) => patch((p) => ({ ...p, dba: e.target.value }))} />
          </Field>
          <Field label="POC name">
            <Input
              value={payload.pocName}
              onChange={(e) => patch((p) => ({ ...p, pocName: e.target.value }))}
            />
          </Field>
          <Field label="POC email">
            <Input
              type="email"
              value={payload.pocEmail}
              onChange={(e) => patch((p) => ({ ...p, pocEmail: e.target.value }))}
            />
          </Field>
          <Field label="POC phone">
            <Input
              value={payload.pocPhone}
              onChange={(e) => patch((p) => ({ ...p, pocPhone: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field label="Station type">
            <NativeSelect
              value={payload.stationKind}
              onChange={(v) => patch((p) => ({ ...p, stationKind: v as TenantKind }))}
            >
              {TENANT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {TENANT_KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Stations you operate" hint="e.g. bar rail, expo, pizza oven">
            <Input
              value={payload.stations}
              onChange={(e) => patch((p) => ({ ...p, stations: e.target.value }))}
            />
          </Field>
          <Field label="Menu ownership notes">
            <Input
              value={payload.menuNotes}
              onChange={(e) => patch((p) => ({ ...p, menuNotes: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 3 && (
        <Field label="Staff list (optional)" hint="Names and roles. You can add PINs later in ops.">
          <textarea
            className="min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
            value={payload.staffNotes}
            onChange={(e) => patch((p) => ({ ...p, staffNotes: e.target.value }))}
          />
        </Field>
      )}
      {step === 4 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This brand’s Quantum Payments account. Guests still pay one check under{" "}
            {peek.hostBrand} — your merchandise (plus allocated tax/tip/service) lands
            here. You can finish this wizard before approval; live cards wait until
            this application is approved.
          </p>
          <QuantumPaymentsOnboardPanel
            kind="operator"
            operatorId={peek.operatorId}
            locationId={peek.locationId ?? undefined}
            legalName={payload.legalName || payload.dba}
          />
          <Field label="Payout label">
            <Input
              value={payload.payoutLabel}
              onChange={(e) => patch((p) => ({ ...p, payoutLabel: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 5 && (
        <Field label="Scheduling prefs (optional)">
          <textarea
            className="min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
            value={payload.schedulePrefs}
            onChange={(e) => patch((p) => ({ ...p, schedulePrefs: e.target.value }))}
          />
        </Field>
      )}
      {step === 6 && (
        <dl className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          <Row k="Legal" v={payload.legalName || "—"} />
          <Row k="DBA" v={payload.dba || "—"} />
          <Row k="POC" v={`${payload.pocName || "—"} · ${payload.pocEmail || peek.email}`} />
          <Row k="Type" v={TENANT_KIND_LABEL[payload.stationKind]} />
          <Row k="Stations" v={payload.stations || "—"} />
          <Row k="Payout" v={payload.payoutLabel || payload.payoutBankLast4 || "Quantum Payments application"} />
        </dl>
      )}
    </WizardChrome>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
