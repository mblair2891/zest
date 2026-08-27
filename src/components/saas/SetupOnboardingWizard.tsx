import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect, ToggleChip, WizardChrome } from "./WizardChrome";
import {
  applyOnboardingStepFn,
  getProspectFn,
  saveOnboardingFn,
} from "@/lib/saas/api";
import { payloadFromAnswers } from "@/lib/saas/onboarding-defaults";
import type {
  OnboardingPayload,
  OnboardingStepId,
  ProspectDetail,
} from "@/lib/saas/prospect-types";
import { ONBOARDING_STEP_IDS } from "@/lib/saas/prospect-types";
import { VENUE_ENTITIES } from "@/lib/pos/entities";
import { NetworkReadinessPanel } from "./NetworkReadinessPanel";
import { AccessPointsCard } from "@/components/pos/AccessPointsCard";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { sameOriginVenueHref } from "@/lib/saas/open-location";
import { setActiveContextFn } from "@/lib/saas/api";
import type { LocationMode } from "@/lib/pos/saas-types";
import { QuantumPaymentsOnboardPanel } from "@/components/payments/QuantumPaymentsOnboardPanel";

const LABELS = [
  "Organization",
  "Locations",
  "Operators",
  "Floor",
  "Menu",
  "Devices",
  "Team",
  "Settlement",
  "Payments",
  "Network",
  "Go-live",
];

export function SetupOnboardingWizard({ token }: { token: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState(true);

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
      <p className="py-16 text-center text-sm text-muted-foreground">
        {error ?? "Loading setup…"}
      </p>
    );
  }

  if (detail.status === "rejected" || detail.status === "churned") {
    return (
      <p className="text-sm text-muted-foreground">
        This application is {detail.status}. Contact the platform team.
      </p>
    );
  }

  const stepId = ONBOARDING_STEP_IDS[step - 1]!;
  const hostLocs = payload.locations.filter((l) => l.operatingModel === "host_operators");

  const patch = (fn: (p: OnboardingPayload) => OnboardingPayload) => {
    setPayload((prev) => (prev ? fn(prev) : prev));
  };

  const apply = async (id: OnboardingStepId) => {
    setError(null);
    setBusy(true);
    try {
      await saveOnboardingFn({ data: { token, payload } });
      const next = await applyOnboardingStepFn({ data: { token, step: id, payload } });
      setDetail(next);
      setPayload(next.onboarding?.payload ?? payload);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step failed");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    try {
      let body = payload;
      if (stepId === "network") {
        body = {
          ...payload,
          locations: payload.locations.map((l) => ({
            ...l,
            networkReadyStatus: l.networkReadyStatus ?? "skipped",
            networkCheckedAt: l.networkCheckedAt ?? new Date().toISOString(),
          })),
        };
        setPayload(body);
      }
      setError(null);
      setBusy(true);
      await saveOnboardingFn({ data: { token, payload: body } });
      const d = await applyOnboardingStepFn({ data: { token, step: stepId, payload: body } });
      setDetail(d);
      setPayload(d.onboarding?.payload ?? body);
      if (step < 11) setStep(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step failed");
    } finally {
      setBusy(false);
    }
  };

  const loc = payload.locations[0];
  const live = detail.liveChecklist;
  const canOpenPos = detail.status === "live" && live.hasLocation && detail.orgId;

  return (
    <WizardChrome
      learnTopicId={
        stepId === "operators"
          ? "single-vs-multi"
          : stepId === "settlement"
            ? "settlement"
            : stepId === "payments"
              ? "quantum-payments"
              : stepId === "network"
                ? "network-readiness"
                : "onboarding-wizard"
      }
      title={
        [
          "Confirm the organization",
          "Locations",
          "Operators",
          "Floor",
          "Menu starting point",
          "Devices",
          "People to invite",
          "Settlement",
          "Quantum Payments",
          "Network readiness",
          "Go-live checklist",
        ][step - 1] ?? "Onboarding"
      }
      subtitle="Each step writes real org data. POS stays empty until you add a menu. Network check is warn-only."
      step={step}
      total={11}
      labels={LABELS}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onNext={() => void next()}
      nextLabel={
        stepId === "network"
          ? loc?.networkReadyStatus === "fail" || loc?.networkReadyStatus === "warn"
            ? "Continue anyway"
            : loc?.networkReadyStatus === "pass"
              ? "Save & continue"
              : "Skip for now"
          : step < 11
            ? "Save & continue"
            : "Complete setup"
      }
    >
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name">
            <Input
              value={payload.org.legalName}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, legalName: e.target.value } }))
              }
            />
          </Field>
          <Field label="DBA / guest-facing">
            <Input
              value={payload.org.dba}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, dba: e.target.value } }))}
            />
          </Field>
          <Field label="Billing email">
            <Input
              type="email"
              value={payload.org.billingEmail}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, billingEmail: e.target.value } }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={payload.org.phone}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, phone: e.target.value } }))}
            />
          </Field>
          <Field label="Owner contact">
            <Input
              value={payload.org.ownerContactName}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, ownerContactName: e.target.value } }))
              }
            />
          </Field>
          <Field label="Billing contact">
            <Input
              value={payload.org.billingContactName}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, billingContactName: e.target.value } }))
              }
            />
          </Field>
          <Field label="Ops contact">
            <Input
              value={payload.org.opsContactName}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, opsContactName: e.target.value } }))
              }
            />
          </Field>
          <Field label="Ops email">
            <Input
              type="email"
              value={payload.org.opsContactEmail}
              onChange={(e) =>
                patch((p) => ({ ...p, org: { ...p.org, opsContactEmail: e.target.value } }))
              }
            />
          </Field>
          <Field label="Currency">
            <NativeSelect
              value={payload.org.currency || "USD"}
              onChange={(val) => patch((p) => ({ ...p, org: { ...p.org, currency: val } }))}
            >
              {["USD", "CAD", "GBP", "EUR", "AUD", "MXN"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tax ID">
            <Input
              value={payload.org.taxId}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, taxId: e.target.value } }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="HQ address">
              <Input
                value={payload.org.hqAddress}
                onChange={(e) =>
                  patch((p) => ({ ...p, org: { ...p.org, hqAddress: e.target.value } }))
                }
              />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {payload.locations.map((l, i) => (
            <div key={l.clientId} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location {i + 1}
              </p>
              <Field label="Name">
                <Input
                  value={l.name}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, name: e.target.value };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <Field label="Address">
                <Input
                  value={l.address}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, address: e.target.value };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Timezone">
                  <NativeSelect
                    value={l.timezone}
                    onChange={(val) =>
                      patch((p) => {
                        const locations = p.locations.slice();
                        locations[i] = { ...l, timezone: val };
                        return { ...p, locations };
                      })
                    }
                  >
                    {[
                      "America/Los_Angeles",
                      "America/Denver",
                      "America/Chicago",
                      "America/New_York",
                    ].map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Venue type">
                  <NativeSelect
                    value={l.venueType}
                    onChange={(val) =>
                      patch((p) => {
                        const locations = p.locations.slice();
                        locations[i] = { ...l, venueType: val as LocationMode };
                        return { ...p, locations };
                      })
                    }
                  >
                    {VENUE_ENTITIES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Host brand (guest-facing)">
                <Input
                  value={l.hostBrandName}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, hostBrandName: e.target.value };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleChip
                  on={l.operatingModel === "single"}
                  label="Single operator"
                  onClick={() =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, operatingModel: "single", operators: [] };
                      return { ...p, locations };
                    })
                  }
                />
                <ToggleChip
                  on={l.operatingModel === "host_operators"}
                  label="Host + operators"
                  onClick={() =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      const ops =
                        l.operators.length >= 2
                          ? l.operators
                          : [
                              emptyOp("Operator 1"),
                              emptyOp("Operator 2"),
                            ];
                      locations[i] = { ...l, operatingModel: "host_operators", operators: ops };
                      return { ...p, locations };
                    })
                  }
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              patch((p) => ({
                ...p,
                locations: [
                  ...p.locations,
                  {
                    clientId: `draft_${p.locations.length}_${Date.now()}`,
                    name: "",
                    address: p.org.hqAddress,
                    timezone: "America/Los_Angeles",
                    venueType: "restaurant" as LocationMode,
                    hostBrandName: p.org.dba || p.org.legalName,
                    operatingModel: "single" as const,
                    operators: [],
                    tableCount: 0,
                    sectionNames: "",
                    floorLater: true,
                    menuMode: "empty" as const,
                    devices: { pos: 2, kds: 1, handhelds: 0 },
                  },
                ],
              }))
            }
          >
            Add location
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {hostLocs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Single-operator host. Tenant invites are for host + operator locations. Continue.
            </p>
          )}
          {hostLocs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Optional tenant slots only. After this host is live, you invite each operator by
              email/SMS from Operators / Tenants. They complete their own legal, stations, and
              payout stubs. Not required to finish host onboarding.
            </p>
          )}
          {payload.locations.map((l, li) =>
            l.operatingModel !== "host_operators" ? null : (
              <div key={l.clientId} className="space-y-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold">{l.name || `Location ${li + 1}`}</p>
                {l.operators.map((op, oi) => (
                  <div key={oi} className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2">
                    <Field label="Legal name">
                      <Input
                        value={op.legalName}
                        onChange={(e) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = { ...op, legalName: e.target.value };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      />
                    </Field>
                    <Field label="DBA">
                      <Input
                        value={op.dba}
                        onChange={(e) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = { ...op, dba: e.target.value };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      />
                    </Field>
                    <Field label="Contact email">
                      <Input
                        type="email"
                        value={op.contactEmail}
                        onChange={(e) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = { ...op, contactEmail: e.target.value };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      />
                    </Field>
                    <Field label="Station">
                      <NativeSelect
                        value={op.stationTypes[0] ?? "both"}
                        onChange={(val) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = {
                              ...op,
                              stationTypes: [val as "bar" | "kitchen" | "both"],
                            };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      >
                        <option value="both">Bar + kitchen</option>
                        <option value="bar">Bar</option>
                        <option value="kitchen">Kitchen</option>
                      </NativeSelect>
                    </Field>
                    <Field label="Bank last 4" hint="Host collects this. Guest operators cannot edit payouts.">
                      <Input
                        value={op.payoutBankLast4}
                        maxLength={4}
                        onChange={(e) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = {
                              ...op,
                              payoutBankLast4: e.target.value.replace(/\D/g, "").slice(0, 4),
                            };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      />
                    </Field>
                    <Field label="Routing token stub">
                      <Input
                        value={op.payoutRoutingToken}
                        onChange={(e) =>
                          patch((p) => {
                            const locations = p.locations.slice();
                            const ops = locations[li]!.operators.slice();
                            ops[oi] = { ...op, payoutRoutingToken: e.target.value };
                            locations[li] = { ...locations[li]!, operators: ops };
                            return { ...p, locations };
                          })
                        }
                      />
                    </Field>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[li] = {
                        ...l,
                        operators: [...l.operators, emptyOp(`Operator ${l.operators.length + 1}`)],
                      };
                      return { ...p, locations };
                    })
                  }
                >
                  Add operator
                </Button>
              </div>
            ),
          )}
        </div>
      )}

      {step === 4 && loc && (
        <FloorStep payload={payload} patch={patch} />
      )}

      {step === 5 && (
        <div className="grid gap-2">
          {(
            [
              ["empty", "Start empty", "No categories or items. POS shows a CTA to build the menu."],
              ["categories", "Template categories only", "Starters, mains, sides, drinks — no priced items."],
              ["csv_later", "Upload CSV later", "Leave the menu empty; import when files are ready."],
            ] as const
          ).map(([id, label, hint]) => (
            <ToggleChip
              key={id}
              on={payload.locations.every((l) => l.menuMode === id)}
              label={label}
              hint={hint}
              onClick={() =>
                patch((p) => ({
                  ...p,
                  locations: p.locations.map((l) => ({ ...l, menuMode: id })),
                }))
              }
            />
          ))}
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          {payload.locations.map((l, i) => (
            <div key={l.clientId} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-3">
              <p className="sm:col-span-3 text-sm font-semibold">{l.name}</p>
              {(["pos", "kds", "handhelds"] as const).map((k) => (
                <Field key={k} label={k === "kds" ? "ODS" : k.toUpperCase()}>
                  <Input
                    type="number"
                    min={0}
                    value={l.devices[k]}
                    onChange={(e) =>
                      patch((p) => {
                        const locations = p.locations.slice();
                        locations[i] = {
                          ...l,
                          devices: { ...l.devices, [k]: Number(e.target.value) || 0 },
                        };
                        return { ...p, locations };
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          ))}
        </div>
      )}

      {step === 7 && (
        <InvitesStep payload={payload} patch={patch} />
      )}

      {step === 8 && (
        <div className="space-y-3">
          <Field label="Settlement period">
            <NativeSelect
              value={payload.settlement.periodType}
              onChange={(val) =>
                patch((p) => ({
                  ...p,
                  settlement: {
                    ...p.settlement,
                    periodType: val as OnboardingPayload["settlement"]["periodType"],
                  },
                }))
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </NativeSelect>
          </Field>
          <Field label="Host cut %" hint="Used when a location is host + operators">
            <Input
              type="number"
              min={0}
              max={100}
              value={payload.settlement.hostCutPercent}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  settlement: {
                    ...p.settlement,
                    hostCutPercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </Field>
        </div>
      )}

      {stepId === "payments" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Guest cards capture as Quantum Payments under the host brand. Complete this
            application before enabling live cards. Cash is always available.
          </p>
          {loc?.serverId ? (
            <QuantumPaymentsOnboardPanel
              kind="host"
              locationId={loc.serverId}
              legalName={payload.org.legalName || payload.org.dba}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Save the Locations step first so we can attach the application to the site.
            </p>
          )}
        </div>
      )}

      {stepId === "network" && loc && (
        <div className="space-y-6">
          <NetworkReadinessPanel
            value={{
              networkReadyStatus: loc.networkReadyStatus,
              networkCheckedAt: loc.networkCheckedAt,
              networkNotes: loc.networkNotes,
              networkChecklist: loc.networkChecklist,
            }}
            onChange={(n) =>
              patch((p) => ({
                ...p,
                locations: p.locations.map((l) => ({ ...l, ...n })),
              }))
            }
          />
          <AccessPointsCard
            venueType={loc.venueType}
            locationId={loc.serverId}
          />
        </div>
      )}

      {stepId === "checklist" && (
        <div className="space-y-3">
          <ToggleChip
            on={payload.checklist.trainingAck}
            label="Training scheduled or complete"
            onClick={() =>
              patch((p) => ({
                ...p,
                checklist: { ...p.checklist, trainingAck: !p.checklist.trainingAck },
              }))
            }
          />
          <ToggleChip
            on={payload.checklist.hardwareAck}
            label="Hardware arrival acknowledged"
            onClick={() =>
              patch((p) => ({
                ...p,
                checklist: { ...p.checklist, hardwareAck: !p.checklist.hardwareAck },
              }))
            }
          />
          <ToggleChip
            on={payload.checklist.paymentsAck}
            label="Quantum Payments is the only guest card processor"
            onClick={() =>
              patch((p) => ({
                ...p,
                checklist: { ...p.checklist, paymentsAck: !p.checklist.paymentsAck },
              }))
            }
          />
          <ul className="space-y-1 rounded-2xl border border-border bg-surface p-4 text-sm">
            <CheckRow ok={live.hasOrg} label="Organization created" />
            <CheckRow ok={live.hasLocation} label="At least one location" />
            <CheckRow ok={live.hasOwner} label="Owner membership" />
            <CheckRow ok={live.hasPlan} label="Plan attached from accepted quote" />
            <CheckRow
              ok
              label="Tenant invites unlock after host is ready (multi-op)"
            />
            <CheckRow
              ok={Boolean(payload.checklist.paymentsAck)}
              label="Quantum Payments application (live cards wait for approval)"
            />
          </ul>
          {detail.status === "live" && (
            <p className="text-sm text-success">
              Host is ready. Open POS. If this is a multi-operator house, invite tenants from
              Operators / Tenants — they complete their own onboarding.
            </p>
          )}
          {canOpenPos && loc && (
            <Button
              type="button"
              onClick={() => {
                const locationId =
                  payload.locations[0]?.serverId ||
                  detail.operators[0]?.locationId ||
                  "";
                const venueType = payload.locations[0]?.venueType ?? "restaurant";
                if (!locationId || !detail.orgId) {
                  void navigate({ to: "/dashboard" });
                  return;
                }
                saveTenantPosContext({
                  orgId: detail.orgId,
                  locationId,
                  venueType,
                  locationName: payload.locations[0]?.name ?? "",
                  orgName: payload.org.dba || payload.org.legalName,
                  ownerName: "Owner",
                });
                void setActiveContextFn({
                  data: { orgId: detail.orgId, locationId },
                }).finally(() => {
                  window.location.assign(sameOriginVenueHref(venueType, locationId));
                });
              }}
            >
              Open POS
            </Button>
          )}
          <Link to="/dashboard" className="block text-sm text-primary underline-offset-2 hover:underline">
            Dashboard
          </Link>
        </div>
      )}
    </WizardChrome>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <Badge variant={ok ? "success" : "secondary"}>{ok ? "Ready" : "Needed"}</Badge>
    </li>
  );
}

function emptyOp(dba: string): OnboardingPayload["locations"][0]["operators"][0] {
  return {
    legalName: "",
    dba,
    contactEmail: "",
    contactPhone: "",
    stationTypes: ["both"],
    payoutBankLast4: "",
    payoutRoutingToken: "",
  };
}

function FloorStep({
  payload,
  patch,
}: {
  payload: OnboardingPayload;
  patch: (fn: (p: OnboardingPayload) => OnboardingPayload) => void;
}) {
  return (
    <div className="space-y-4">
      {payload.locations.map((l, i) => (
        <div key={l.clientId} className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">{l.name}</p>
          <ToggleChip
            on={l.floorLater}
            label="Set up floor later"
            hint="POS opens with an empty floor and a CTA"
            onClick={() =>
              patch((p) => {
                const locations = p.locations.slice();
                locations[i] = { ...l, floorLater: !l.floorLater };
                return { ...p, locations };
              })
            }
          />
          {!l.floorLater && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rough table count">
                <Input
                  type="number"
                  min={0}
                  value={l.tableCount}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, tableCount: Number(e.target.value) || 0 };
                      return { ...p, locations };
                    })
                  }
                />
              </Field>
              <Field label="Section names" hint="Comma-separated">
                <Input
                  value={l.sectionNames}
                  onChange={(e) =>
                    patch((p) => {
                      const locations = p.locations.slice();
                      locations[i] = { ...l, sectionNames: e.target.value };
                      return { ...p, locations };
                    })
                  }
                  placeholder="Dining, Patio, Bar"
                />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InvitesStep({
  payload,
  patch,
}: {
  payload: OnboardingPayload;
  patch: (fn: (p: OnboardingPayload) => OnboardingPayload) => void;
}) {
  return (
    <div className="space-y-3">
      {payload.invites.map((inv, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px]">
          <Input
            type="email"
            placeholder="teammate@company.com"
            value={inv.email}
            onChange={(e) =>
              patch((p) => {
                const invites = p.invites.slice();
                invites[i] = { ...inv, email: e.target.value };
                return { ...p, invites };
              })
            }
          />
          <NativeSelect
            value={inv.role}
            onChange={(val) =>
              patch((p) => {
                const invites = p.invites.slice();
                invites[i] = {
                  ...inv,
                  role: val as OnboardingPayload["invites"][0]["role"],
                };
                return { ...p, invites };
              })
            }
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="vendor">Vendor</option>
          </NativeSelect>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          patch((p) => ({
            ...p,
            invites: [...p.invites, { email: "", role: "manager" }],
          }))
        }
      >
        Add invite
      </Button>
    </div>
  );
}
