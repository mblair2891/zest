import { useEffect, useRef, useState } from "react";
import { ArrowUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { formatCurrency } from "@/lib/utils";
import { qualifyTurnFn, saveIntakeFn, submitQuoteRequestFn } from "@/lib/saas/api";
import { clearGetAPriceStorage } from "@/lib/saas/get-a-price-draft";
import { QuoteSummary } from "./QuoteSummary";
import {
  applyChip,
  applyUserText,
  openingTurn,
  qualifyPhase,
  sessionToIntake,
} from "@/lib/saas/qualify-engine";
import { quoteFromQualifySession } from "@/lib/saas/qualify-quote";
import {
  QUALIFY_PHASES,
  type QualifyChip,
  type QualifyEntity,
  type QualifySession,
} from "@/lib/saas/qualify-session";
import { useNavigate } from "@tanstack/react-router";

const PHASE_LABEL: Record<(typeof QUALIFY_PHASES)[number], string> = {
  location: "Location",
  operation: "Operation",
  hardware: "Hardware",
  quote: "Quote",
};

export function QualifyChat({
  token,
  initial,
  onSessionChange,
}: {
  token: string;
  initial?: QualifySession | null;
  onSessionChange?: (s: QualifySession) => void;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<QualifySession>(() => initial ?? openingTurn().session);

  useEffect(() => {
    setSession(initial ?? openingTurn().session);
    setDraft("");
    setEmail(initial?.facts.contactEmail ?? "");
    setName(initial?.facts.contactName ?? "");
  }, [token]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(initial?.facts.contactEmail ?? "");
  const [name, setName] = useState(initial?.facts.contactName ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);

  const push = (next: QualifySession) => {
    if (next.showQuote && next.readyToQuote && !next.quote) {
      next = { ...next, quote: quoteFromQualifySession(next), assumptions: quoteFromQualifySession(next).assumptions };
    } else if (next.showQuote && next.readyToQuote) {
      const quote = quoteFromQualifySession(next);
      next = { ...next, quote, assumptions: quote.assumptions };
    }
    setSession(next);
    onSessionChange?.(next);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length, busy]);

  const run = async (opts: { message?: string; chip?: QualifyChip }) => {
    setError(null);
    setBusy(true);
    const local = opts.chip ? applyChip(session, opts.chip) : applyUserText(session, opts.message ?? "");
    push(local.session);
    setDraft("");
    try {
      const res = await qualifyTurnFn({
        data: {
          message: opts.message,
          chip: opts.chip ?? null,
          session,
          open: false,
        },
      });
      push(res.session);
    } catch {
      /* heuristic local turn already applied */
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    void run({ message: text });
  };

  const phase = qualifyPhase(session);
  const phaseIdx = QUALIFY_PHASES.indexOf(phase);

  const submitQuote = async () => {
    setError(null);
    if (!email.includes("@")) {
      setError("Email is how we send the quote.");
      return;
    }
    setBusy(true);
    try {
      const next = {
        ...session,
        facts: { ...session.facts, contactEmail: email, contactName: name },
        showQuote: true,
      };
      const answers = sessionToIntake(next);
      answers.company.billingEmail = email;
      answers.company.legalName = name.trim() || answers.company.legalName || "Prospect";
      answers.payments.quantumPaymentsAck = true;
      await saveIntakeFn({ data: { token, answers } });
      const quoted = await submitQuoteRequestFn({ data: { token } });
      clearGetAPriceStorage();
      onSessionChange?.({ ...next, quote: quoted.quote ?? next.quote });
      await navigate({ to: "/quote/$token", params: { token: quoted.publicToken } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the quote");
    } finally {
      setBusy(false);
    }
  };

  if (session.showQuote && session.quote) {
    return (
      <div className="space-y-6">
        <PhaseBar index={3} />
        <QuoteSummary quote={session.quote} />
        {session.quote.assumptions.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assumptions</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
              {session.quote.assumptions.slice(0, 12).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email to send the quote</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </label>
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              push({ ...session, showQuote: false, quote: session.quote })
            }
          >
            Adjust in chat
          </Button>
          <Button disabled={busy} onClick={() => void submitQuote()}>
            {busy ? "Sending…" : "Request this quote"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Software {formatCurrency(session.quote.monthlyCents)}/mo · hardware listed separately ·
          setup {formatCurrency(session.quote.onboardingFeeCents)}.
        </p>
      </div>
    );
  }

  const lastChips =
    session.messages.filter((m) => m.role === "assistant").at(-1)?.chips ?? session.chips;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-4">
        <PhaseBar index={phaseIdx} />
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {session.messages.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[90%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[90%] rounded-2xl border border-border bg-bg px-3 py-2 text-sm"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <p className="text-xs text-muted-foreground">Thinking…</p>
            )}
            <div ref={bottomRef} />
          </div>
          {lastChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lastChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ chip: c })}
                  className="min-h-11 rounded-full border border-border bg-bg px-3 py-2 text-sm hover:border-primary hover:bg-primary/10"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <VoiceTextarea
              value={draft}
              onChange={setDraft}
              rows={2}
              hint={false}
              className="min-h-12 flex-1"
              placeholder="Single location, 2 entities…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button size="icon" className="h-12 w-12 shrink-0" disabled={busy || !draft.trim()} onClick={send}>
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <SummaryCard
        session={session}
        onChange={(next) => {
          const quoted =
            next.showQuote || next.readyToQuote ? { ...next, quote: quoteFromQualifySession(next) } : next;
          push(quoted);
        }}
        onPrice={() => {
          if (!session.readyToQuote) return;
          push({ ...session, showQuote: true, quote: quoteFromQualifySession(session) });
        }}
      />
    </div>
  );
}

function PhaseBar({ index }: { index: number }) {
  return (
    <ol className="flex flex-wrap gap-1 text-xs">
      {QUALIFY_PHASES.map((id, i) => (
        <li
          key={id}
          className={`rounded-full px-2.5 py-1 ${
            i === index
              ? "bg-primary/15 font-medium text-primary"
              : i < index
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {i < index ? "✓ " : ""}
          {PHASE_LABEL[id]}
          {i < QUALIFY_PHASES.length - 1 ? " →" : ""}
        </li>
      ))}
    </ol>
  );
}

function SummaryCard({
  session,
  onChange,
  onPrice,
}: {
  session: QualifySession;
  onChange: (s: QualifySession) => void;
  onPrice: () => void;
}) {
  const f = session.facts;
  const patchFacts = (patch: Partial<QualifySession["facts"]>) =>
    onChange({ ...session, facts: { ...session.facts, ...patch } });
  const patchEntity = (id: string, patch: Partial<QualifyEntity>) =>
    onChange({
      ...session,
      entities: session.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });

  return (
    <aside className="rounded-2xl border border-border bg-surface p-4 text-sm">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Pencil className="h-3 w-3" /> Running summary
      </p>
      <label className="mt-3 block space-y-1">
        <span className="text-xs text-muted-foreground">Locations</span>
        <Input
          type="number"
          min={1}
          value={f.locationCount ?? ""}
          placeholder="—"
          onChange={(e) =>
            patchFacts({ locationCount: e.target.value ? Math.max(1, Number(e.target.value)) : null })
          }
        />
      </label>
      <label className="mt-2 block space-y-1">
        <span className="text-xs text-muted-foreground">City / state or zip</span>
        <Input
          value={[f.city, f.region].filter(Boolean).join(", ")}
          placeholder="Optional"
          onChange={(e) => {
            const [city, region] = e.target.value.split(",").map((s) => s.trim());
            patchFacts({ city: city ?? "", region: region ?? "" });
          }}
        />
      </label>
      <ul className="mt-3 space-y-3">
        {session.entities.map((e) => (
          <li key={e.id} className="rounded-xl border border-border p-2">
            <Input
              value={e.label}
              className="mb-2 h-8"
              onChange={(ev) => patchEntity(e.id, { label: ev.target.value })}
            />
            <select
              className="h-8 w-full rounded-md border border-border bg-bg px-2 text-xs"
              value={e.venueType ?? ""}
              onChange={(ev) =>
                patchEntity(e.id, {
                  venueType: (ev.target.value || null) as QualifyEntity["venueType"],
                })
              }
            >
              <option value="">Venue type</option>
              <option value="bar_lounge">Bar</option>
              <option value="restaurant">Restaurant</option>
              <option value="cafe">Café</option>
              <option value="qsr">QSR</option>
              <option value="retail">Retail</option>
            </select>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {(
                [
                  ["wells", "Wells", e.wells],
                  ["tills", "Tills", e.tills],
                  ["hostStands", "Host", e.hostStands],
                  ["kiosks", "Kiosks", e.kiosks],
                ] as const
              ).map(([key, lab, val]) => (
                <label key={key} className="text-[11px] text-muted-foreground">
                  {lab}
                  <Input
                    type="number"
                    min={0}
                    className="mt-0.5 h-8"
                    value={val ?? ""}
                    placeholder="—"
                    onChange={(ev) =>
                      patchEntity(e.id, {
                        [key]: ev.target.value === "" ? null : Math.max(0, Number(ev.target.value)),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {session.entities.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Nothing extracted yet — start in the chat.</p>
      )}
      {session.readyToQuote && (
        <Button className="mt-3 w-full" onClick={onPrice}>
          I can price this now
        </Button>
      )}
    </aside>
  );
}
