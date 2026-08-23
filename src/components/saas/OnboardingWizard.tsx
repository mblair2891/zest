import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaasStore } from "@/lib/pos/saas-store";
import {
  LOCATION_TYPE_OPTIONS,
  type OnboardingLocationDraft,
  type OnboardingPayload,
  type OnboardingSteps,
  type ProspectRecord,
  emptyOnboardingPayload,
  emptyOnboardingSteps,
  liveReady,
} from "@/lib/saas/prospect-types";
import type { LocationMode, OperatingModel, OperatorStationType } from "@/lib/pos/saas-types";
import {
  attachOrgId,
  getProspectByToken,
  saveOnboarding,
} from "@/lib/saas/prospect-fns";

const STEPS: { id: keyof OnboardingSteps; label: string }[] = [
  { id: "org", label: "Organization" },
  { id: "locations", label: "Locations" },
  { id: "operators", label: "Operators" },
  { id: "floor", label: "Floor" },
  { id: "menu", label: "Menu" },
  { id: "devices", label: "Devices" },
  { id: "invites", label: "Users" },
  { id: "settlement", label: "Settlement" },
  { id: "checklist", label: "Go-live" },
];

export function OnboardingWizard({ token }: { token: string }) {
  const [rec, setRec] = useState<ProspectRecord | null>(null);
  const [payload, setPayload] = useState<OnboardingPayload>(emptyOnboardingPayload());
  const [steps, setSteps] = useState<OnboardingSteps>(emptyOnboardingSteps());
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const applyOnboarding = useSaasStore((s) => s.applyOnboarding);

  useEffect(() => {
    void getProspectByToken({ data: token }).then((r) => {
      setRec(r);
      if (r?.onboarding) {
        setPayload(r.onboarding.payload);
        setSteps(r.onboarding.steps);
      } else if (r) {
        setPayload(emptyOnboardingPayload(r.answers));
      }
    });
  }, [token]);

  const mark = (id: keyof OnboardingSteps) =>
    setSteps((s) => ({ ...s, [id]: true }));

  const persist = async (nextSteps = steps, nextPayload = payload) => {
    const saved = await saveOnboarding({
      data: { token, payload: nextPayload, steps: nextSteps },
    });
    setRec(saved);
    return saved;
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextSteps = { ...steps, checklist: true };
      setSteps(nextSteps);
      await persist(nextSteps, payload);
      if (!liveReady(payload, nextSteps)) {
        setError("Complete required fields: org, location, owner, Zest Payments ack.");
        return;
      }
      const applied = applyOnboarding(payload, rec?.quote?.packageIds);
      if (!applied.ok) {
        setError(applied.error ?? "Could not create tenant");
        return;
      }
      await attachOrgId({ data: { token, orgId: applied.orgId } });
      const saved = await persist(nextSteps, payload);
      setRec(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!rec) {
    return <p className="text-sm text-muted-foreground">Loading onboarding…</p>;
  }
  if (
    rec.status !== "contracted" &&
    rec.status !== "onboarding" &&
    rec.status !== "live"
  ) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        Onboarding unlocks after the contract is marked signed.
        <div className="mt-3">
          <Link to="/pricing/$token" params={{ token }}>
            <Button variant="outline" size="sm">
              Back to quote
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const step = STEPS[idx]!;
  const loc = payload.locations[0];

  const updateLoc = (i: number, patch: Partial<OnboardingLocationDraft>) => {
    setPayload((p) => ({
      ...p,
      locations: p.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Post-contract onboarding · {rec.company.legalName}
      </p>
      <ol className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setIdx(i)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                i === idx
                  ? "bg-primary text-primary-foreground"
                  : steps[s.id]
                    ? "border border-success/40 text-success"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {rec.status === "live" && rec.orgId && (
        <div className="rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
          This subscriber is live.
          <div className="mt-2">
            <Link to="/platform">
              <Button size="sm">Open SaaS</Button>
            </Link>
          </div>
        </div>
      )}

      {step.id === "org" && (
        <Box title="Organization">
          <Field label="Org name">
            <Input
              value={payload.orgName}
              onChange={(e) =>
                setPayload((p) => ({ ...p, orgName: e.target.value }))
              }
            />
          </Field>
          <Field label="Legal name">
            <Input
              value={payload.legalName}
              onChange={(e) =>
                setPayload((p) => ({ ...p, legalName: e.target.value }))
              }
            />
          </Field>
          <Field label="Billing email">
            <Input
              value={payload.billingEmail}
              onChange={(e) =>
                setPayload((p) => ({ ...p, billingEmail: e.target.value }))
              }
            />
          </Field>
        </Box>
      )}

      {step.id === "locations" && (
        <Box title="Locations">
          {payload.locations.map((l, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <Field label="Location name">
                <Input
                  value={l.name}
                  onChange={(e) => updateLoc(i, { name: e.target.value })}
                />
              </Field>
              <Field label="Host brand (guest-facing)">
                <Input
                  value={l.hostBrandName}
                  onChange={(e) =>
                    updateLoc(i, { hostBrandName: e.target.value })
                  }
                />
              </Field>
              <Field label="Address">
                <Input
                  value={l.address}
                  onChange={(e) => updateLoc(i, { address: e.target.value })}
                />
              </Field>
              <Field label="Timezone">
                <Input
                  value={l.timezone}
                  onChange={(e) => updateLoc(i, { timezone: e.target.value })}
                />
              </Field>
              <Field label="Venue type">
                <select
                  className="mt-1 flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  value={l.mode}
                  onChange={(e) =>
                    updateLoc(i, { mode: e.target.value as LocationMode })
                  }
                >
                  {LOCATION_TYPE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["single_operator", "Single operator"],
                    ["host_multi_operator", "Host + operators"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    type="button"
                    variant={
                      l.operatingModel === id ? "default" : "outline"
                    }
                    onClick={() =>
                      updateLoc(i, { operatingModel: id as OperatingModel })
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </Box>
      )}

      {step.id === "operators" && (
        <Box title="Operators">
          {payload.locations.map((l, li) =>
            l.operatingModel !== "host_multi_operator" ? (
              <p key={li} className="text-sm text-muted-foreground">
                {l.name || `Location ${li + 1}`} is single-operator.
              </p>
            ) : (
              <div key={li} className="space-y-2">
                <p className="text-sm font-medium">{l.name || `Location ${li + 1}`}</p>
                {l.operators.map((o, oi) => (
                  <div
                    key={oi}
                    className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2"
                  >
                    <Input
                      placeholder="Operator name"
                      value={o.name}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi ? { ...x, name: e.target.value } : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    />
                    <Input
                      placeholder="Legal name"
                      value={o.legalName}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi ? { ...x, legalName: e.target.value } : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    />
                    <Input
                      placeholder="Contact"
                      value={o.contact}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi ? { ...x, contact: e.target.value } : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    />
                    <select
                      className="h-11 rounded-lg border border-border bg-surface px-3 text-sm"
                      value={o.stationType}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi
                            ? {
                                ...x,
                                stationType: e.target
                                  .value as OperatorStationType,
                              }
                            : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    >
                      <option value="bar">Bar</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="both">Both</option>
                    </select>
                    <Input
                      placeholder="Payout account label"
                      value={o.payoutAccountLabel}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi
                            ? { ...x, payoutAccountLabel: e.target.value }
                            : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    />
                    <Input
                      placeholder="Last 4"
                      maxLength={4}
                      value={o.payoutLast4}
                      onChange={(e) => {
                        const ops = l.operators.map((x, j) =>
                          j === oi
                            ? {
                                ...x,
                                payoutLast4: e.target.value.replace(/\D/g, ""),
                              }
                            : x,
                        );
                        updateLoc(li, { operators: ops });
                      }}
                    />
                  </div>
                ))}
              </div>
            ),
          )}
        </Box>
      )}

      {step.id === "floor" && loc && (
        <Box title="Floor (optional)">
          <Field label="Approx. table count (0 = setup later)">
            <Input
              type="number"
              value={loc.tableCount}
              onChange={(e) =>
                updateLoc(0, { tableCount: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Section names (comma-separated)">
            <Input
              value={loc.sectionNames}
              onChange={(e) => updateLoc(0, { sectionNames: e.target.value })}
            />
          </Field>
        </Box>
      )}

      {step.id === "menu" && loc && (
        <Box title="Menu start">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={loc.menuStart === "empty" ? "default" : "outline"}
              onClick={() => updateLoc(0, { menuStart: "empty" })}
            >
              Start empty
            </Button>
            <Button
              size="sm"
              variant={
                loc.menuStart === "template_categories" ? "default" : "outline"
              }
              onClick={() =>
                updateLoc(0, { menuStart: "template_categories" })
              }
            >
              Template categories only
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No demo items or fake prices. CSV import can be added later.
          </p>
        </Box>
      )}

      {step.id === "devices" && (
        <Box title="Devices">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="POS">
              <Input
                type="number"
                value={payload.devices.pos}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    devices: {
                      ...p.devices,
                      pos: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </Field>
            <Field label="KDS">
              <Input
                type="number"
                value={payload.devices.kds}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    devices: {
                      ...p.devices,
                      kds: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Handhelds">
              <Input
                type="number"
                value={payload.devices.handhelds}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    devices: {
                      ...p.devices,
                      handhelds: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </Field>
          </div>
        </Box>
      )}

      {step.id === "invites" && (
        <Box title="Users to invite">
          {payload.invites.map((inv, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Name"
                value={inv.name}
                onChange={(e) => {
                  const invites = payload.invites.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  );
                  setPayload((p) => ({ ...p, invites }));
                }}
              />
              <Input
                placeholder="Email"
                value={inv.email}
                onChange={(e) => {
                  const invites = payload.invites.map((x, j) =>
                    j === i ? { ...x, email: e.target.value } : x,
                  );
                  setPayload((p) => ({ ...p, invites }));
                }}
              />
              <select
                className="h-11 rounded-lg border border-border bg-surface px-3 text-sm"
                value={inv.role}
                onChange={(e) => {
                  const invites = payload.invites.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          role: e.target.value as typeof inv.role,
                        }
                      : x,
                  );
                  setPayload((p) => ({ ...p, invites }));
                }}
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
          ))}
        </Box>
      )}

      {step.id === "settlement" && (
        <Box title="Settlement">
          <Field label="Period">
            <select
              className="mt-1 flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={payload.settlementPeriod}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  settlementPeriod: e.target
                    .value as OnboardingPayload["settlementPeriod"],
                }))
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Host cut % (multi-operator)">
            <Input
              type="number"
              value={payload.hostCutPercent}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  hostCutPercent: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
        </Box>
      )}

      {step.id === "checklist" && (
        <Box title="Go-live acknowledgements">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.acknowledgements.training}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  acknowledgements: {
                    ...p.acknowledgements,
                    training: e.target.checked,
                  },
                }))
              }
            />
            Training scheduled
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.acknowledgements.hardware}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  acknowledgements: {
                    ...p.acknowledgements,
                    hardware: e.target.checked,
                  },
                }))
              }
            />
            Hardware plan confirmed
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.acknowledgements.zestPayments}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  acknowledgements: {
                    ...p.acknowledgements,
                    zestPayments: e.target.checked,
                  },
                }))
              }
            />
            Guest cards run on Zest Payments only
          </label>
        </Box>
      )}

      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          disabled={idx === 0 || busy}
          onClick={() => setIdx((i) => i - 1)}
        >
          Back
        </Button>
        {idx < STEPS.length - 1 ? (
          <Button
            disabled={busy}
            onClick={() => {
              mark(step.id);
              void persist({ ...steps, [step.id]: true }, payload);
              setIdx((i) => i + 1);
            }}
          >
            Continue
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void finish()}>
            {busy ? "Applying…" : "Finish & create tenant"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
