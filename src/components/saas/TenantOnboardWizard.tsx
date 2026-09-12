import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, ToggleChip, WizardChrome } from "./WizardChrome";
import {
  completeTenantOnboardFn,
  openTenantInviteFn,
  saveTenantOnboardFn,
} from "@/lib/saas/tenant-invite-api";
import {
  EMPTY_TENANT_PAYLOAD,
  type TenantInvitePeek,
  type TenantOnboardPayload,
} from "@/lib/saas/tenant-invite";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";

const LABELS = ["Legal", "MCC", "Menu", "Staff", "Payments", "Tips", "Review"];

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
        <p className="text-lg font-semibold">This entity is in progress</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {peek.displayName} at {peek.hostBrand}. You cannot edit sibling menus or sibling
          Quantum Payments. Live cards wait until this merchant is approved.
        </p>
      </div>
    );
  }

  const total = 7;
  return (
    <WizardChrome
      title={`${peek.displayName} at ${peek.hostBrand}`}
      subtitle={
        peek.peerVenue
          ? "This invite is scoped to your entity only. The building is not a merchant."
          : "Complete your operator details. You cannot change host billing or other tenants."
      }
      step={step}
      total={total}
      labels={LABELS}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onNext={step < total ? () => void go(step + 1) : () => void submit()}
      nextLabel={step < total ? "Continue" : "Submit"}
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
          <Field label="EIN">
            <Input
              value={payload.ein}
              onChange={(e) => patch((p) => ({ ...p, ein: e.target.value }))}
            />
          </Field>
          <Field label="Beneficial owners">
            <Input
              value={payload.ownersNote}
              onChange={(e) => patch((p) => ({ ...p, ownersNote: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field label="MCC">
            <NativeSelect
              value={payload.mcc}
              onChange={(v) => patch((p) => ({ ...p, mcc: v }))}
            >
              <option value="5812">5812 — eating places / food service</option>
              <option value="5813">5813 — drinking places</option>
              <option value="7299">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Bank (payout)">
            <Input
              value={payload.bankName}
              onChange={(e) => patch((p) => ({ ...p, bankName: e.target.value }))}
            />
          </Field>
          <Field label="Account last 4">
            <Input
              value={payload.payoutBankLast4}
              onChange={(e) => patch((p) => ({ ...p, payoutBankLast4: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <Field label="Menu intake">
            <NativeSelect
              value={payload.menuIntake}
              onChange={(v) =>
                patch((p) => ({ ...p, menuIntake: v as TenantOnboardPayload["menuIntake"] }))
              }
            >
              <option value="type">Type it in</option>
              <option value="voice">Voice notes</option>
              <option value="upload">Document upload notes</option>
            </NativeSelect>
          </Field>
          <Field label="Menu + modifiers + recipes">
            <textarea
              className="min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
              value={payload.menuNotes}
              onChange={(e) => patch((p) => ({ ...p, menuNotes: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-3">
          <Field label="Staff PINs + roles" hint="Names, 4-digit PINs, roles, schedule defaults. Hashed later in ops.">
            <textarea
              className="min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
              value={payload.staffNotes}
              onChange={(e) => patch((p) => ({ ...p, staffNotes: e.target.value }))}
            />
          </Field>
          <Field label="Schedule defaults">
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-bg p-3 text-sm"
              value={payload.schedulePrefs}
              onChange={(e) => patch((p) => ({ ...p, schedulePrefs: e.target.value }))}
            />
          </Field>
        </div>
      )}
      {step === 5 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Finix sub-merchant application is required for this entity. Guests still pay one
            check under {peek.hostBrand}. You cannot open a sibling merchant.
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
      {step === 6 && (
        <div className="space-y-3">
          <Field label="Tip mode for your people">
            <Input
              value={payload.tipMode}
              onChange={(e) => patch((p) => ({ ...p, tipMode: e.target.value }))}
              placeholder="Individual, pool, dual food/drink…"
            />
          </Field>
          <Field label="Closeout">
            <Input
              value={payload.closeoutMode}
              onChange={(e) => patch((p) => ({ ...p, closeoutMode: e.target.value }))}
              placeholder="Blind till, server bank…"
            />
          </Field>
          <Field label="Till mode">
            <Input
              value={payload.tillMode}
              onChange={(e) => patch((p) => ({ ...p, tillMode: e.target.value }))}
            />
          </Field>
          <ToggleChip
            on={payload.invoiceOptIn}
            label="Invoice / costing opt-in"
            hint="Recipes and invoices for this entity only."
            onClick={() => patch((p) => ({ ...p, invoiceOptIn: !p.invoiceOptIn }))}
          />
        </div>
      )}
      {step === 7 && (
        <dl className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          <Row k="Legal" v={payload.legalName || "—"} />
          <Row k="DBA" v={payload.dba || "—"} />
          <Row k="EIN" v={payload.ein || "—"} />
          <Row k="MCC" v={payload.mcc || "—"} />
          <Row k="POC" v={`${payload.pocName || "—"} · ${payload.pocEmail || peek.email}`} />
          <Row k="Menu" v={payload.menuIntake} />
          <Row k="Invoices" v={payload.invoiceOptIn ? "On" : "Off"} />
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
