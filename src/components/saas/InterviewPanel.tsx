import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Badge } from "@/components/ui/badge";
import { Field, ToggleChip } from "./WizardChrome";
import {
  finishInterviewFn,
  interviewAiStatusFn,
  interviewTurnFn,
  loadPublicQuoteCatalogFn,
} from "@/lib/saas/api";
import type {
  InterviewMessage,
  InterviewQuestion,
  InterviewRecommendation,
  InterviewSource,
  QuoteCatalog,
} from "@/lib/saas/prospect-types";
import { MODULE_LABELS } from "@/lib/saas/prospect-types";
import type { IntakeAnswers } from "@/lib/saas/prospect-types";
import { VENUE_ENTITIES } from "@/lib/pos/entities";
import type { LocationMode } from "@/lib/pos/saas-types";
import { applyRecommendation } from "@/lib/saas/interview";
import { DEFAULT_PRICING_RULES, emptyIntakeAnswers, generateQuote, planLabel } from "@/lib/saas/pricing";
import { DEFAULT_QUOTE_CATALOG } from "@/lib/saas/quote-catalog";
import { QuoteSummary } from "./QuoteSummary";

export function InterviewPanel({
  token,
  initialEmail,
  initialFreeText,
  initialMessages,
  initialRec,
  onSkip,
  onAccepted,
}: {
  token: string;
  initialEmail?: string;
  initialFreeText?: string;
  initialMessages?: InterviewMessage[];
  initialRec?: InterviewRecommendation | null;
  onSkip: () => void;
  onAccepted: (answers: IntakeAnswers) => void;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [freeText, setFreeText] = useState(initialFreeText ?? "");
  const [messages, setMessages] = useState<InterviewMessage[]>(initialMessages ?? []);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [rec, setRec] = useState<InterviewRecommendation | null>(initialRec ?? null);
  const [source, setSource] = useState<InterviewSource | null>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<QuoteCatalog>(DEFAULT_QUOTE_CATALOG);

  useEffect(() => {
    void interviewAiStatusFn()
      .then((r) => setAi(r.ai))
      .catch(() => setAi(false));
    void loadPublicQuoteCatalogFn()
      .then((r) => setCatalog(r.catalog))
      .catch(() => undefined);
  }, []);

  const runTurn = async (withReplies: boolean) => {
    setError(null);
    if (freeText.trim().length < 40) {
      setError("Give us a bit more — locations, how guests pay, bar vs kitchen, what you need.");
      return;
    }
    setBusy(true);
    try {
      const payload = Object.entries(replies)
        .filter(([, v]) => v.trim())
        .map(([id, answer]) => ({ id, answer }));
      const res = await interviewTurnFn({
        data: {
          token,
          freeText: email.trim()
            ? `Contact email: ${email.trim()}\n${freeText.trim()}`
            : freeText.trim(),
          replies: withReplies ? payload : [],
        },
      });
      setMessages(res.messages);
      setSource(res.turn.source);
      if (res.turn.type === "questions") {
        setQuestions(res.turn.questions);
        setReplies({});
        if (res.turn.draftRecommendation) setRec(res.turn.draftRecommendation);
      } else {
        setQuestions([]);
        setRec(res.turn.recommendation);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze");
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      const res = await finishInterviewFn({
        data: { token, status: "accepted", recommendation: rec, email },
      });
      onAccepted(res.answers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply recommendation");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      await finishInterviewFn({ data: { token, status: "skipped", email } });
      onSkip();
    } catch {
      onSkip();
    } finally {
      setBusy(false);
    }
  };

  const label = ai ? "AI recommendations" : "Guided recommendations";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Stage A · Interview
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Describe the operation</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Type or speak what you run. Follow-ups are specific to what you typed — we
          will not walk a canned list. Guest cards are always Quantum Payments.
        </p>
        {ai !== null && (
          <Badge className="mt-2" variant={ai ? "info" : "secondary"}>
            {label}
          </Badge>
        )}
      </div>

      <Field label="Contact email" hint="Optional — used if you accept a quote later">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Describe your operation in your own words">
        <VoiceTextarea
          value={freeText}
          onChange={setFreeText}
          rows={7}
          className="min-h-36"
          placeholder="We run a hall with a bar program and two kitchens. Guests pay one check. We need floor, ODS, and operator payouts…"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {freeText.trim().length}/40 minimum
        </span>
      </Field>

      {questions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            From what you wrote
          </p>
          {questions.map((q) => (
            <Field key={q.id} label={q.prompt} hint={q.hint}>
              <VoiceTextarea
                value={replies[q.id] ?? ""}
                onChange={(text) => setReplies((r) => ({ ...r, [q.id]: text }))}
                rows={3}
                className="min-h-24"
                placeholder="Speak or type your answer"
              />
            </Field>
          ))}
          <Button disabled={busy} onClick={() => void runTurn(true)}>
            {busy ? "Thinking…" : "Send answers"}
          </Button>
        </div>
      )}

      {rec && (
        <RecommendationCard
          rec={rec}
          source={source}
          catalog={catalog}
          onChange={setRec}
          onAccept={() => void accept()}
          busy={busy}
        />
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!rec && (
          <Button disabled={busy} onClick={() => void runTurn(false)}>
            {busy ? "Analyzing…" : questions.length || messages.length ? "Re-analyze" : "Analyze"}
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void skip()}>
          Enter details myself
        </Button>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  source,
  catalog,
  onChange,
  onAccept,
  busy,
}: {
  rec: InterviewRecommendation;
  source: InterviewSource | null;
  catalog: QuoteCatalog;
  onChange: (r: InterviewRecommendation) => void;
  onAccept: () => void;
  busy: boolean;
}) {
  const venueName = (id: LocationMode) =>
    VENUE_ENTITIES.find((v) => v.id === id)?.name ?? id.replaceAll("_", " ");

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommendation
          </p>
          <p className="mt-1 text-sm">{rec.summary}</p>
        </div>
        <Badge variant={source === "ai" ? "info" : "secondary"}>
          {source === "ai" ? "AI" : "Guided"}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ToggleChip
          on={rec.operatingModel === "single_operator"}
          label="Single operator"
          onClick={() => onChange({ ...rec, operatingModel: "single_operator" })}
        />
        <ToggleChip
          on={rec.operatingModel === "host_multi_operator"}
          label="Host + tenants"
          onClick={() => onChange({ ...rec, operatingModel: "host_multi_operator" })}
        />
        <ToggleChip
          on={rec.operatingModel === "peer_venue"}
          label="Shared venue (peers)"
          onClick={() => onChange({ ...rec, operatingModel: "peer_venue" })}
        />
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Venue types
      </p>
      <div className="flex flex-wrap gap-2">
        {VENUE_ENTITIES.map((v) => {
          const on = rec.venueTypes.includes(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                const venueTypes = on
                  ? rec.venueTypes.filter((x) => x !== v.id)
                  : [...rec.venueTypes, v.id];
                onChange({
                  ...rec,
                  venueTypes: venueTypes.length ? venueTypes : [v.id],
                });
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                on ? "border-primary bg-primary/15 text-primary" : "border-border"
              }`}
            >
              {v.shortName}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Modules
      </p>
      <div className="flex flex-wrap gap-2">
        {MODULE_LABELS.map((m) => {
          const on = rec.modules.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const modules = on
                  ? rec.modules.filter((x) => x !== m.id)
                  : [...rec.modules, m.id];
                onChange({ ...rec, modules });
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                on ? "border-primary bg-primary/15 text-primary" : "border-border"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["locations", rec.estimates.locations],
            ["operators", rec.estimates.operators],
            ["seats", rec.estimates.seats],
            ["devices", rec.estimates.devices],
          ] as const
        ).map(([k, val]) => (
          <Field key={k} label={k}>
            <Input
              type="number"
              min={1}
              value={val}
              onChange={(e) =>
                onChange({
                  ...rec,
                  estimates: {
                    ...rec.estimates,
                    [k]: Math.max(1, Number(e.target.value) || 1),
                  },
                })
              }
            />
          </Field>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Suggested plan: {planLabel(rec.pricingHints.suggestedPlan)}
        {rec.pricingHints.notes ? ` — ${rec.pricingHints.notes}` : ""}
      </p>
      <QuoteSummary
        quote={generateQuote(
          applyRecommendation(emptyIntakeAnswers(), rec),
          { ...DEFAULT_PRICING_RULES, quoteCatalog: catalog },
          { draft: true },
        )}
        compact
      />
      {rec.rationale.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {rec.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        Venue: {rec.venueTypes.map(venueName).join(", ")}. You can still change every
        field on the next screens.
      </p>

      <div className="flex gap-2">
        <Button disabled={busy} onClick={onAccept}>
          {busy ? "Saving…" : "Accept"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onAccept}>
          Edit on the form
        </Button>
      </div>
    </div>
  );
}
