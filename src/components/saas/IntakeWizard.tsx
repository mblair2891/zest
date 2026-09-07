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
import { emptyIntakeAnswers, parseIntakeAnswers } from "@/lib/saas/pricing";
import { DEFAULT_QUOTE_CATALOG } from "@/lib/saas/quote-catalog";
import { LiveQuotePanel } from "./LiveQuotePanel";
import type { QuoteCatalog } from "@/lib/saas/prospect-types";
import type { IntakeAnswers, InterviewMessage, InterviewRecommendation } from "@/lib/saas/prospect-types";
import { MODULE_LABELS } from "@/lib/saas/prospect-types";
import { writeProspectToken } from "@/lib/saas/prospect-token";
import {
  clearGetAPriceStorage,
  decideGetAPriceLoad,
  navigationType,
  peekGetAPricePath,
  putGetAPriceTokenInUrl,
  readGetAPriceDraft,
  stripGetAPriceTokenFromUrl,
  writeGetAPriceDraft,
} from "@/lib/saas/get-a-price-draft";
import type { LocationMode } from "@/lib/pos/saas-types";
import { QualifyChat } from "./QualifyChat";
import { Button } from "@/components/ui/button";
import { parseQualifySession, type QualifySession } from "@/lib/saas/qualify-session";
import { sessionToIntake } from "@/lib/saas/qualify-engine";

const LABELS = [
  "Company",
  "House",
  "Ops model",
  "Floor",
  "Stations",
  "Payments",
  "Your price",
];

function rememberDraft(opts: {
  token: string;
  answers: IntakeAnswers;
  step: number;
  phase: "interview" | "form";
  prefilled?: boolean;
  interviewText?: string;
  qualify?: QualifySession | null;
}) {
  writeProspectToken(opts.token);
  putGetAPriceTokenInUrl(opts.token);
  writeGetAPriceDraft({
    token: opts.token,
    step: opts.step,
    phase: opts.phase,
    prefilled: opts.prefilled,
    interviewText: opts.interviewText,
    data: { answers: opts.answers, qualify: opts.qualify ?? null },
  });
}

function answersFromDraft(data: unknown): IntakeAnswers {
  if (data && typeof data === "object" && "answers" in data) {
    return parseIntakeAnswers((data as { answers: unknown }).answers);
  }
  return parseIntakeAnswers(data);
}

function qualifyFromDraft(data: unknown): QualifySession | null {
  if (data && typeof data === "object" && "qualify" in data) {
    return parseQualifySession((data as { qualify: unknown }).qualify);
  }
  return parseQualifySession(data);
}

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
  const [qualify, setQualify] = useState<QualifySession | null>(null);
  const [chatKey, setChatKey] = useState(0);
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
        const draft = readGetAPriceDraft();
        const decision = decideGetAPriceLoad({
          draft,
          previousPathname: peekGetAPricePath(),
          currentPathname: typeof window !== "undefined" ? window.location.pathname : "/get-pricing",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          origin: typeof window !== "undefined" ? window.location.origin : "",
          navigationType: navigationType(),
        });
        const existing =
          decision.action === "restore" ? draft?.token || initialToken || null : null;
        if (decision.action === "empty") {
          clearGetAPriceStorage();
          stripGetAPriceTokenFromUrl();
        }
        if (existing) {
          try {
            const p = await getProspectFn({ data: { token: existing } });
            if (cancelled) return;
            setToken(p.publicToken);
            const restoredAnswers = draft?.data ? answersFromDraft(draft.data) : p.answers;
            const restoredQualify = draft?.data ? qualifyFromDraft(draft.data) : null;
            if (restoredQualify) setQualify(restoredQualify);
            const restoredText = draft?.interviewText || p.interviewFreeText;
            setAnswers(restoredAnswers);
            setInterviewText(restoredText);
            setInterviewMessages(p.interviewMessages);
            setInterviewRec(p.interviewRecommendation);
            if (draft?.step && draft.step >= 1 && draft.step <= 7) setStep(draft.step);
            if (draft?.phase === "form" || draft?.phase === "interview") setPhase(draft.phase);
            if (p.interviewStatus === "accepted" || p.interviewStatus === "skipped") {
              setPhase("form");
              setPrefilled(p.interviewStatus === "accepted");
            }
            rememberDraft({
              token: p.publicToken,
              answers: restoredAnswers,
              interviewText: restoredText,
              step: draft?.step ?? 1,
              phase: "interview",
              prefilled: p.interviewStatus === "accepted",
              qualify: restoredQualify,
            });
            if (p.status !== "prospect") {
              clearGetAPriceStorage();
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
        setStep(1);
        setPhase("interview");
        setPrefilled(false);
        setInterviewText("");
        setInterviewMessages([]);
        setInterviewRec(null);
        setQualify(null);
        rememberDraft({
          token: p.publicToken,
          answers: p.answers,
          step: 1,
          phase: "interview",
          qualify: null,
        });
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

  const persist = async (
    next: IntakeAnswers,
    meta?: { step?: number; phase?: "interview" | "form" },
  ) => {
    if (!token) return;
    rememberDraft({
      token,
      answers: next,
      step: meta?.step ?? step,
      phase: meta?.phase ?? phase,
      prefilled,
      interviewText,
      qualify,
    });
    await saveIntakeFn({ data: { token, answers: next } });
  };

  const patch = (fn: (a: IntakeAnswers) => IntakeAnswers) => {
    setAnswers((prev) => {
      const next = fn(prev);
      if (token) {
        rememberDraft({
          token,
          answers: next,
          step,
          phase,
          prefilled,
          interviewText,
        });
      }
      return next;
    });
  };

  const go = async (n: number) => {
    setError(null);
    setBusy(true);
    try {
      await persist(answers, { step: n });
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
      clearGetAPriceStorage();
      stripGetAPriceTokenFromUrl();
      writeProspectToken(quoted.publicToken);
      await navigate({ to: "/quote/$token", params: { token: quoted.publicToken } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate quote");
    } finally {
      setBusy(false);
    }
  };

  const startOver = async () => {
    setError(null);
    setBusy(true);
    clearGetAPriceStorage();
    stripGetAPriceTokenFromUrl();
    setAnswers(emptyIntakeAnswers());
    setStep(1);
    setPhase("interview");
    setPrefilled(false);
    setInterviewText("");
    setInterviewMessages([]);
    setInterviewRec(null);
    setQualify(null);
    setChatKey((k) => k + 1);
    try {
      const p = await startProspectFn();
      setToken(p.publicToken);
      setAnswers(p.answers);
      rememberDraft({
        token: p.publicToken,
        answers: p.answers,
        step: 1,
        phase: "interview",
        qualify: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start over");
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Opening intake…</p>
    );
  }

  const startOverControl = (
    <div className="mb-4 flex justify-end">
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void startOver()}>
        Start over
      </Button>
    </div>
  );

  if (phase === "interview") {
    return (
      <div>
        {startOverControl}
        <QualifyChat
          key={`${token}-${chatKey}`}
          token={token}
          initial={qualify}
          onSessionChange={(s) => {
            setQualify(s);
            const nextAnswers = sessionToIntake(s);
            setAnswers(nextAnswers);
            rememberDraft({
              token,
              answers: nextAnswers,
              step: 1,
              phase: "interview",
              qualify: s,
            });
          }}
        />
      </div>
    );
  }

  const c = answers.company;
  const p = answers.portfolio;
  const o = answers.operating;
  const v = answers.volume;

  return (
    <>
      {startOverControl}
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
                ["single", "Single operator", "One entity, one merchant"],
                [
                  "host_operators",
                  "Host + tenants",
                  "Host subscriber plus guest operators. Host may sell.",
                ],
                [
                  "peer_venue",
                  "Shared venue (peers)",
                  "Named building only. Independent operators. No landlord-brand POS.",
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
              <Field
                label={
                  o.model === "peer_venue"
                    ? "Selling entities at the venue"
                    : "Estimated operators per host location"
                }
              >
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
            Bring your own tablets, printers, cash drawers, and stands. Summex is the
            software. Live cards require Finix / Quantum Payments readers supplied through
            Summex — we ship them to your site. Customer-owned Square, Stripe, or bank
            terminals are not supported.
          </p>
          <ToggleChip
            on
            label="We provide tablets, printers, and cash drawers"
            hint="Required BYO. $0. Summex does not sell a hardware kit."
            onClick={() => undefined}
          />
          <Field label="How many Finix/Quantum payments readers (required for live cards)">
            <Input
              type="number"
              min={1}
              value={answers.hardware.readerQty || 1}
              onChange={(e) =>
                patch((a) => ({
                  ...a,
                  hardware: {
                    ...a.hardware,
                    shipReaders: true,
                    readerQty: Math.max(1, Number(e.target.value) || 1),
                  },
                  volume: { ...a.volume, terminalNeed: "buy" },
                }))
              }
            />
          </Field>
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
