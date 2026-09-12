import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, ToggleChip, WizardChrome } from "./WizardChrome";
import { applyOnboardingStepFn, getProspectFn, saveOnboardingFn } from "@/lib/saas/api";
import { payloadFromAnswers } from "@/lib/saas/onboarding-defaults";
import type { OnboardingPayload, ProspectDetail } from "@/lib/saas/prospect-types";
import {
  applyVenueKind,
  patchVenueWizardFields,
  readVenueWizardFields,
  setEntityCount,
  VENUE_OWNER_STEP_IDS,
  VENUE_OWNER_STEPS,
  venueKindFromLocation,
  venueWizardStepComplete,
  type VenueOwnerStepId,
} from "@/lib/saas/venue-wizard";
import {
  CASH_ROUND_INCREMENTS,
  VENUE_QR_LABEL,
  QR_VENUE_MODES,
} from "@/lib/saas/venue-entity";

const TITLES: Record<VenueOwnerStepId, string> = {
  building: "Building",
  model: "How is this house organized?",
  entity_count: "How many selling entities?",
  service: "Service style",
  cash: "Cash-discount rounding",
  qr: "Guest QR",
  tax: "Tax",
  entity_slots: "Name each operator",
  devices_plan: "Shared devices (counts only)",
};

const SUBS: Record<VenueOwnerStepId, string> = {
  building: "Named building — not a merchant. Address and timezone live on the venue.",
  model: "Shared building has no host merchant. Single-operator is the same screens with one entity.",
  entity_count: "Peer venues need at least two independent operators.",
  service: "Full service floor, counter, or hybrid.",
  cash: "Cash is discounted then rounded up to this increment.",
  qr: "How guests use table QR. Pairing tablets comes later.",
  tax: "One venue rate, or each entity files its own.",
  entity_slots: "DBA plus a POC email or SMS. They complete Finix and menus themselves.",
  devices_plan: "Counts only. Pair Android tablets later from Devices. No Finix form here. No menu here.",
};

export function VenueOwnerWizard({ token }: { token: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState(true);
  const [done, setDone] = useState(false);

  const load = async () => {
    const d = await getProspectFn({ data: { token } });
    setDetail(d);
    setPayload(d.onboarding?.payload ?? payloadFromAnswers(d.answers));
    return d;
  };

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((d) => {
        if (cancelled) return;
        if (d.status === "prospect" || d.status === "quoted" || d.status === "accepted") {
          void navigate({ to: "/quote/$token", params: { token: d.publicToken } });
        }
        const doneSteps = (d.onboarding?.steps ?? {}) as Record<string, { done?: boolean }>;
        const firstOpen = VENUE_OWNER_STEP_IDS.findIndex((id) => !doneSteps[id]?.done);
        if (firstOpen > 0) setStep(firstOpen + 1);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load");
      })
      .finally(() => {
        if (!cancelled) setBoot(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (boot || !payload || !detail) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">{error ?? "Loading setup…"}</p>
    );
  }

  const stepId = VENUE_OWNER_STEP_IDS[step - 1]!;
  const loc = payload.locations[0];
  const kind = venueKindFromLocation(loc);
  const fields = readVenueWizardFields(loc);

  const patch = (fn: (p: OnboardingPayload) => OnboardingPayload) => {
    setPayload((prev) => (prev ? fn(prev) : prev));
  };

  const next = async () => {
    const gate = venueWizardStepComplete(stepId, payload);
    if (!gate.ok) {
      setError(gate.error || "Complete this step first");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveOnboardingFn({ data: { token, payload } });
      const d = await applyOnboardingStepFn({ data: { token, step: stepId, payload } });
      setDetail(d);
      setPayload(d.onboarding?.payload ?? payload);
      if (step >= VENUE_OWNER_STEP_IDS.length) {
        setDone(true);
        return;
      }
      setStep(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step failed");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-lg font-semibold">Venue onboarding saved</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Status is onboarding / awaiting entities. Each operator completes their own legal packet,
          Quantum Payments application, and menu. This building has no Finix identity and no menu.
        </p>
        <Button className="mt-6" onClick={() => void navigate({ to: "/dashboard" })}>
          Open venue dashboard
        </Button>
      </div>
    );
  }

  return (
    <WizardChrome
      learnTopicId="peer-venue-setup"
      title={TITLES[stepId]}
      subtitle={SUBS[stepId]}
      step={step}
      total={VENUE_OWNER_STEP_IDS.length}
      labels={[...VENUE_OWNER_STEPS]}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onNext={() => void next()}
      nextLabel={step === VENUE_OWNER_STEP_IDS.length ? "Finish" : "Continue"}
    >
      {stepId === "building" && loc && (
        <div className="grid gap-3">
          <Field label="Building name">
            <Input
              value={loc.name}
              onChange={(e) =>
                patch((p) => {
                  const locations = p.locations.slice();
                  locations[0] = { ...loc, name: e.target.value, hostBrandName: e.target.value };
                  return {
                    ...p,
                    locations,
                    org: { ...p.org, dba: e.target.value || p.org.dba },
                  };
                })
              }
            />
          </Field>
          <Field label="Address">
            <Input
              value={loc.address}
              onChange={(e) =>
                patch((p) => {
                  const locations = p.locations.slice();
                  locations[0] = { ...loc, address: e.target.value };
                  return { ...p, locations, org: { ...p.org, hqAddress: e.target.value } };
                })
              }
            />
          </Field>
          <Field label="Timezone">
            <Input
              value={loc.timezone}
              onChange={(e) =>
                patch((p) => {
                  const locations = p.locations.slice();
                  locations[0] = { ...loc, timezone: e.target.value };
                  return { ...p, locations };
                })
              }
            />
          </Field>
        </div>
      )}

      {stepId === "model" && (
        <div className="grid gap-2">
          <ToggleChip
            on={kind === "peer"}
            label="Shared building — no host merchant"
            hint="Named building. Two or more independent operators. No landlord POS."
            onClick={() => patch((p) => applyVenueKind(p, "peer"))}
          />
          <ToggleChip
            on={kind === "single_operator"}
            label="Single operator"
            hint="Same screens. Venue plus exactly one selling entity."
            onClick={() => patch((p) => applyVenueKind(p, "single_operator"))}
          />
        </div>
      )}

      {stepId === "entity_count" && loc && (
        <Field
          label={kind === "peer" ? "Selling entities (min 2)" : "Selling entities"}
          hint={kind === "peer" ? "Independent operators in this building." : "One entity for this shop."}
        >
          <Input
            type="number"
            min={kind === "peer" ? 2 : 1}
            max={40}
            value={loc.operators.length || (kind === "peer" ? 2 : 1)}
            onChange={(e) => patch((p) => setEntityCount(p, Number(e.target.value)))}
            disabled={kind === "single_operator"}
          />
        </Field>
      )}

      {stepId === "service" && (
        <div className="grid gap-2">
          {(
            [
              ["full_service", "Full service floor"],
              ["counter", "Counter"],
              ["hybrid", "Hybrid"],
              ["drive_through", "Drive-through"],
            ] as const
          ).map(([id, label]) => (
            <ToggleChip
              key={id}
              on={fields.serviceStyle === id}
              label={label}
              onClick={() => patch((p) => patchVenueWizardFields(p, { serviceStyle: id }))}
            />
          ))}
        </div>
      )}

      {stepId === "cash" && (
        <div className="grid gap-2">
          {CASH_ROUND_INCREMENTS.map((n) => (
            <ToggleChip
              key={n}
              on={fields.cashRoundIncrement === n}
              label={`Nearest $${n.toFixed(2)}`}
              onClick={() => patch((p) => patchVenueWizardFields(p, { cashRoundIncrement: n }))}
            />
          ))}
        </div>
      )}

      {stepId === "qr" && (
        <div className="grid gap-2">
          {QR_VENUE_MODES.map((id) => (
            <ToggleChip
              key={id}
              on={fields.qrMode === id}
              label={VENUE_QR_LABEL[id]}
              onClick={() => patch((p) => patchVenueWizardFields(p, { qrMode: id }))}
            />
          ))}
        </div>
      )}

      {stepId === "tax" && (
        <div className="grid gap-2">
          <ToggleChip
            on={fields.taxMode === "venue_shared"}
            label="Venue-shared tax"
            hint="One rate for the building."
            onClick={() => patch((p) => patchVenueWizardFields(p, { taxMode: "venue_shared" }))}
          />
          <ToggleChip
            on={fields.taxMode === "per_entity"}
            label="Per-entity tax"
            hint="Each operator files their own."
            onClick={() => patch((p) => patchVenueWizardFields(p, { taxMode: "per_entity" }))}
          />
        </div>
      )}

      {stepId === "entity_slots" && loc && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Invite each POC. They cannot edit a sibling menu or sibling Finix application.
          </p>
          {loc.operators.map((op, oi) => (
            <div key={oi} className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2">
              <Field label="DBA / guest-facing">
                <Input
                  value={op.dba}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      const ops = loc.operators.slice();
                      ops[oi] = { ...op, dba: e.target.value };
                      locations[0] = { ...loc, operators: ops };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <Field label="Legal name">
                <Input
                  value={op.legalName}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      const ops = loc.operators.slice();
                      ops[oi] = { ...op, legalName: e.target.value };
                      locations[0] = { ...loc, operators: ops };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <Field label="POC email">
                <Input
                  type="email"
                  value={op.contactEmail}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      const ops = loc.operators.slice();
                      ops[oi] = { ...op, contactEmail: e.target.value };
                      locations[0] = { ...loc, operators: ops };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <Field label="POC SMS">
                <Input
                  value={op.contactPhone}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      const ops = loc.operators.slice();
                      ops[oi] = { ...op, contactPhone: e.target.value };
                      locations[0] = { ...loc, operators: ops };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
            </div>
          ))}
        </div>
      )}

      {stepId === "devices_plan" && loc && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Order tablets" hint="Android only. Pair later from Devices.">
            <Input
              type="number"
              min={1}
              value={loc.devices.pos || 1}
              onChange={(e) =>
                patch((p) => {
                  const locations = p.locations.slice();
                  locations[0] = {
                    ...loc,
                    devices: { ...loc.devices, pos: Number(e.target.value) || 0 },
                  };
                  return { ...p, locations };
                })
              }
            />
          </Field>
          <Field label="ODS displays">
            <Input
              type="number"
              min={0}
              value={loc.devices.kds || 0}
              onChange={(e) =>
                patch((p) => {
                  const locations = p.locations.slice();
                  locations[0] = {
                    ...loc,
                    devices: { ...loc.devices, kds: Number(e.target.value) || 0 },
                  };
                  return { ...p, locations };
                })
              }
            />
          </Field>
          <Field label="Host stands">
            <Input
              type="number"
              min={0}
              value={loc.devices.host ?? loc.hostCount ?? 0}
              onChange={(e) =>
                patch((p) => {
                  const n = Number(e.target.value) || 0;
                  const locations = p.locations.slice();
                  locations[0] = {
                    ...loc,
                    hostCount: n,
                    devices: { ...loc.devices, host: n },
                  };
                  return { ...p, locations };
                })
              }
            />
          </Field>
          <Field label="Kiosks">
            <Input
              type="number"
              min={0}
              value={loc.devices.kiosk ?? loc.kioskCount ?? 0}
              onChange={(e) =>
                patch((p) => {
                  const n = Number(e.target.value) || 0;
                  const locations = p.locations.slice();
                  locations[0] = {
                    ...loc,
                    kioskCount: n,
                    devices: { ...loc.devices, kiosk: n },
                  };
                  return { ...p, locations };
                })
              }
            />
          </Field>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Staff stations are Android tablets running Summex Station. iPad and browser POS are not
            supported. Pairing QR codes come from the Devices tab after this wizard.
          </p>
        </div>
      )}
    </WizardChrome>
  );
}
