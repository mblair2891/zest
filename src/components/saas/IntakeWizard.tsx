import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Field, NativeSelect, ToggleChip, WizardChrome } from "./WizardChrome";
import { VENUE_ENTITIES } from "@/lib/pos/entities";
import {
  submitQuoteRequestFn,
  saveIntakeFn,
  startProspectFn,
  getProspectFn,
  loadPublicQuoteCatalogFn,
} from "@/lib/saas/api";
import { emptyIntakeAnswers } from "@/lib/saas/pricing";
import { DEFAULT_QUOTE_CATALOG } from "@/lib/saas/quote-catalog";
import { LiveQuotePanel } from "./LiveQuotePanel";
import type { QuoteCatalog } from "@/lib/saas/prospect-types";
import type { IntakeAnswers, InterviewMessage, InterviewRecommendation } from "@/lib/saas/prospect-types";
import { MODULE_LABELS } from "@/lib/saas/prospect-types";
import { readProspectToken, writeProspectToken } from "@/lib/saas/prospect-token";
import type { LocationMode } from "@/lib/pos/saas-types";
import { InterviewPanel } from "./InterviewPanel";

const LABELS = [
  "Company",
  "House",
  "Ops model",
  "Floor",
  "Stations",
  "Payments",
  "Your price",
];

export function IntakeWizard({ initialToken }: { initialToken?: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState(initialToken ?? "");
  const [answers, setAnswers] = useState<IntakeAnswers>(emptyIntakeAnswers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [phase, setPhase] = useState<"interview" | "form">("interview");
  const [prefilled, setPrefilled] = useState(false);
  const [interviewText, setInterviewText] = useState("");
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([]);
  const [interviewRec, setInterviewRec] = useState<InterviewRecommendation | null>(null);
  const [catalog, setCatalog] = useState<QuoteCatalog>(DEFAULT_QUOTE_CATALOG);

  useEffect(() => {
    void loadPublicQuoteCatalogFn()
      .then((r) => setCatalog(r.catalog))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const existing = initialToken || readProspectToken();
        if (existing) {
          try {
            const p = await getProspectFn({ data: { token: existing } });
            if (cancelled) return;
            setToken(p.publicToken);
            setAnswers(p.answers);
            setInterviewText(p.interviewFreeText);
            setInterviewMessages(p.interviewMessages);
            setInterviewRec(p.interviewRecommendation);
            if (p.interviewStatus === "accepted" || p.interviewStatus === "skipped") {
              setPhase("form");
              setPrefilled(p.interviewStatus === "accepted");
            }
            writeProspectToken(p.publicToken);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("t", p.publicToken);
              window.history.replaceState({}, "", url.toString());
            }
            if (p.status !== "prospect") {
              void navigate({
                to: "/quote/$token",
                params: { token: p.publicToken },
              });
              return;
            }
            return;
          } catch {
            /* start a new intake */
          }
        }
        const p = await startProspectFn();
        if (cancelled) return;
        setToken(p.publicToken);
        setAnswers(p.answers);
        writeProspectToken(p.publicToken);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("t", p.publicToken);
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not start intake");
      } finally {
        if (!cancelled) setBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [initialToken, navigate]);

  const persist = async (next: IntakeAnswers) => {
    if (!token) return;
    await saveIntakeFn({ data: { token, answers: next } });
  };

  const patch = (fn: (a: IntakeAnswers) => IntakeAnswers) => {
    setAnswers((prev) => fn(prev));
  };

  const go = async (n: number) => {
    setError(null);
    setBusy(true);
    try {
      await persist(answers);
      setStep(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!answers.payments.quantumPaymentsAck) {
      setError("Please acknowledge Quantum Payments as the only guest card processor.");
      return;
    }
    if (answers.company.legalName.trim().length < 2) {
      setError("Legal name is required.");
      setStep(1);
      return;
    }
    if (!answers.company.billingEmail.includes("@")) {
      setError("Billing email is required.");
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      await persist(answers);
      const quoted = await submitQuoteRequestFn({ data: { token } });
      writeProspectToken(quoted.publicToken);
      await navigate({ to: "/quote/$token", params: { token: quoted.publicToken } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate quote");
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Opening intake…</p>
    );
  }

  if (phase === "interview") {
    return (
      <InterviewPanel
        token={token}
        initialEmail={answers.company.billingEmail}
        initialFreeText={interviewText}
        initialMessages={interviewMessages}
        initialRec={interviewRec}
        onSkip={() => {
          setPhase("form");
          setPrefilled(false);
        }}
        onAccepted={(next) => {
          setAnswers(next);
          setPrefilled(true);
          setPhase("form");
        }}
      />
    );
  }

  const c = answers.company;
  const p = answers.portfolio;
  const o = answers.operating;
  const v = answers.volume;

  return (
    <>
      {prefilled && (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          Pre-filled from the interview. Change anything — this form is what the quote uses.
        </p>
      )}
    <WizardChrome
      learnTopicId={step === 3 ? "single-vs-multi" : step === 6 ? "quantum-payments" : "prospect-intake"}
      title={
        [
          "Company",
          "What you run",
          "How the house operates",
          "Floor & ops",
          "Stations & terminals",
          "Payments",
          "Your price",
        ][step - 1] ?? "Intake"
      }
      subtitle={
        [
          "Legal entity we will quote. Guest-facing brand can differ.",
          "Entity type and how many locations.",
          "Single operator vs host with tenant brands. Guest can pay one check.",
          "Floor, reservations, waitlist, recipes/costing/HR.",
          "Order stations, ODS, kiosks, and whether you need Quantum terminals.",
          "Guest cards run through Quantum Payments only. Each entity is its own merchant; one guest check.",
          "Live monthly software. Toggle modules — price recalculates. Then request this quote.",
        ][step - 1]
      }
      step={step}
      total={7}
      labels={LABELS}
      error={error}
      busy={busy}
      onBack={step > 1 ? () => void go(step - 1) : undefined}
      onNext={step < 7 ? () => void go(step + 1) : () => void submit()}
      nextLabel={step < 7 ? "Continue" : "Request this quote"}
    >
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name">
            <Input
              value={c.legalName}
              onChange={(e) =>
                patch((a) => ({ ...a, company: { ...a.company, legalName: e.target.value } }))
              }
              placeholder="Acme Hospitality LLC"
            />
          </Field>
          <Field label="DBA / guest-facing brand">
            <Input
              value={c.dba}
              onChange={(e) =>
                patch((a) => ({ ...a, company: { ...a.company, dba: e.target.value } }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Billing email">
            <Input
              type="email"
              value={c.billingEmail}
              onChange={(e) =>
                patch((a) => ({
                  ...a,
                  company: { ...a.company, billingEmail: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={c.phone}
              onChange={(e) =>
                patch((a) => ({ ...a, company: { ...a.company, phone: e.target.value } }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="HQ address">
              <Input
                value={c.hqAddress}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    company: { ...a.company, hqAddress: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Tax ID" hint="Optional at this stage">
            <Input
              value={c.taxId}
              onChange={(e) =>
                patch((a) => ({ ...a, company: { ...a.company, taxId: e.target.value } }))
              }
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Locations now">
              <Input
                type="number"
                min={1}
                value={p.locationsNow}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    portfolio: {
                      ...a.portfolio,
                      locationsNow: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Locations in 12 months">
              <Input
                type="number"
                min={0}
                value={p.locations12mo}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    portfolio: {
                      ...a.portfolio,
                      locations12mo: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </Field>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Count by venue type
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {VENUE_ENTITIES.map((ent) => (
              <div
                key={ent.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2"
              >
                <span>
                  <span className="block text-sm font-medium">{ent.name}</span>
                  <span className="text-[11px] text-muted-foreground">{ent.tagline}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  className="h-10 w-20"
                  value={p.typeCounts[ent.id as LocationMode] ?? 0}
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value) || 0);
                    patch((a) => ({
                      ...a,
                      portfolio: {
                        ...a.portfolio,
                        typeCounts: { ...a.portfolio.typeCounts, [ent.id]: n },
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid gap-2">
            {(
              [
                ["single", "Single operator", "One team runs the location"],
                [
                  "host_operators",
                  "Host + operators",
                  "Hall / pod host with vendors. Guest can pay one check.",
                ],
                ["mixed", "Mixed portfolio", "Some locations host, some single-operator"],
              ] as const
            ).map(([id, label, hint]) => (
              <ToggleChip
                key={id}
                on={o.model === id}
                label={label}
                hint={hint}
                onClick={() =>
                  patch((a) => ({ ...a, operating: { ...a.operating, model: id } }))
                }
              />
            ))}
          </div>
          {o.model !== "single" && (
            <>
              <Field label="Estimated operators per host location">
                <Input
                  type="number"
                  min={1}
                  value={o.operatorsPerLocation}
                  onChange={(e) =>
                    patch((a) => ({
                      ...a,
                      operating: {
                        ...a.operating,
                        operatorsPerLocation: Number(e.target.value) || 1,
                      },
                    }))
                  }
                />
              </Field>
              <ToggleChip
                on={o.guestPaysHostCheck}
                label="Guest pays one host check"
                hint="One guest check; capture splits to each brand’s merchant; receipts group by vendor"
                onClick={() =>
                  patch((a) => ({
                    ...a,
                    operating: {
                      ...a.operating,
                      guestPaysHostCheck: !a.operating.guestPaysHostCheck,
                    },
                  }))
                }
              />
            </>
          )}
          <ToggleChip
            on={o.hostStand}
            label="Host stand"
            hint="Seating map, waitlist, to-go at the stand"
            onClick={() =>
              patch((a) => ({
                ...a,
                operating: { ...a.operating, hostStand: !a.operating.hostStand },
                modules: { ...a.modules, tableService: !a.operating.hostStand ? true : a.modules.tableService },
              }))
            }
          />
          <ToggleChip
            on={o.barKitchenSplit}
            label="Bar and kitchen are split ops"
            hint="Separate station teams / ODS rails"
            onClick={() =>
              patch((a) => ({
                ...a,
                operating: { ...a.operating, barKitchenSplit: !a.operating.barKitchenSplit },
              }))
            }
          />
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_LABELS.map((m) => (
            <ToggleChip
              key={m.id}
              on={answers.modules[m.id]}
              label={m.label}
              hint={m.hint}
              onClick={() =>
                patch((a) => ({
                  ...a,
                  modules: { ...a.modules, [m.id]: !a.modules[m.id] },
                }))
              }
            />
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Order stations" hint="Handhelds + bar POS">
              <Input
                type="number"
                min={1}
                value={v.orderStations}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    volume: { ...a.volume, orderStations: Math.max(1, Number(e.target.value) || 1) },
                  }))
                }
              />
            </Field>
            <Field label="ODS displays" hint="Kitchen / bar tickets. 1 included in base.">
              <Input
                type="number"
                min={0}
                value={v.odsStations}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    volume: {
                      ...a.volume,
                      odsStations: Math.max(0, Number(e.target.value) || 0),
                    },
                    modules: { ...a.modules, kds: (Number(e.target.value) || 0) > 0 },
                  }))
                }
              />
            </Field>
            <Field label="Kiosks" hint="$29 each / mo">
              <Input
                type="number"
                min={0}
                value={v.kioskCount}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    volume: { ...a.volume, kioskCount: Math.max(0, Number(e.target.value) || 0) },
                    modules: { ...a.modules, kiosk: (Number(e.target.value) || 0) > 0 },
                  }))
                }
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            First 4 order+ODS stations are included. Extra stations are $19 / mo each.
          </p>
          <p className="text-sm text-muted-foreground">
            Bring your own tablets, printers, cash drawers, stands. Summex is the software.
            Card readers can be yours or shipped by our payments partner.
          </p>
          <ToggleChip
            on={answers.hardware.ownsTabletsPrintersDrawers}
            label="We already own tablets, printers, and cash drawers"
            hint="Default. $0 hardware. We'll list what you still need to provide."
            onClick={() =>
              patch((a) => ({
                ...a,
                hardware: {
                  ...a.hardware,
                  ownsTabletsPrintersDrawers: !a.hardware.ownsTabletsPrintersDrawers,
                },
              }))
            }
          />
          <ToggleChip
            on={answers.hardware.shipReaders}
            label="Need card readers shipped to us"
            hint="Finix/Quantum partner hardware. Typically more expensive than a BYO ~$75 reader. Drop-ships to your site."
            onClick={() =>
              patch((a) => ({
                ...a,
                hardware: {
                  ...a.hardware,
                  shipReaders: !a.hardware.shipReaders,
                  readerQty: a.hardware.readerQty || 1,
                },
                volume: {
                  ...a.volume,
                  terminalNeed: !a.hardware.shipReaders ? "buy" : "none",
                },
              }))
            }
          />
          {answers.hardware.shipReaders && (
            <Field label="How many readers">
              <Input
                type="number"
                min={1}
                value={answers.hardware.readerQty || 1}
                onChange={(e) =>
                  patch((a) => ({
                    ...a,
                    hardware: {
                      ...a.hardware,
                      readerQty: Math.max(1, Number(e.target.value) || 1),
                    },
                  }))
                }
              />
            </Field>
          )}
          <ToggleChip
            on={answers.hardware.shipPartnerDevices}
            label="Need kiosk or other partner devices shipped"
            hint="Optional stands/kiosks from the payments partner. Not a Summex hardware kit."
            onClick={() =>
              patch((a) => ({
                ...a,
                hardware: {
                  ...a.hardware,
                  shipPartnerDevices: !a.hardware.shipPartnerDevices,
                },
              }))
            }
          />
        </div>
      )}

      {step === 6 && (
        <div className="space-y-3">
          <ToggleChip
            on={answers.payments.quantumPaymentsAck}
            label="Guest cards process on Quantum Payments only"
            hint="Required. Each entity is its own merchant; one guest check. Gift cards stay first-party."
            onClick={() =>
              patch((a) => ({
                ...a,
                payments: {
                  ...a.payments,
                  quantumPaymentsAck: !a.payments.quantumPaymentsAck,
                },
              }))
            }
          />
          <ToggleChip
            on={answers.payments.tips}
            label="Tips"
            onClick={() =>
              patch((a) => ({
                ...a,
                payments: { ...a.payments, tips: !a.payments.tips },
              }))
            }
          />
          <ToggleChip
            on={answers.payments.splitTenders}
            label="Split tenders"
            onClick={() =>
              patch((a) => ({
                ...a,
                payments: { ...a.payments, splitTenders: !a.payments.splitTenders },
              }))
            }
          />
          <ToggleChip
            on={answers.payments.roomCharge}
            label="Room charge"
            onClick={() =>
              patch((a) => ({
                ...a,
                payments: { ...a.payments, roomCharge: !a.payments.roomCharge },
              }))
            }
          />
          <Field label="Operator payout frequency" hint="Informational for the quote">
            <NativeSelect
              value={answers.payments.payoutFrequency}
              onChange={(val) =>
                patch((a) => ({
                  ...a,
                  payments: {
                    ...a.payments,
                    payoutFrequency: val as IntakeAnswers["payments"]["payoutFrequency"],
                  },
                }))
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </NativeSelect>
          </Field>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-4">
          <LiveQuotePanel
            answers={answers}
            catalog={catalog}
            onChange={(next) => {
              setAnswers(next);
              void persist(next);
            }}
          />
          <Field label="Notes for the proposal (optional)">
            <VoiceTextarea
              value={answers.timeline.notes}
              onChange={(notes) =>
                patch((a) => ({
                  ...a,
                  timeline: { ...a.timeline, notes },
                }))
              }
              rows={3}
              placeholder="Anything we should flag for onboarding."
            />
          </Field>
        </div>
      )}
    </WizardChrome>
    </>
  );
}
