import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, ToggleChip } from "./WizardChrome";
import {
  finishInterviewFn,
  interviewAiStatusFn,
  interviewTurnFn,
} from "@/lib/saas/api";
import type {
  InterviewMessage,
  InterviewQuestion,
  InterviewRecommendation,
  InterviewSource,
} from "@/lib/saas/prospect-types";
import { MODULE_LABELS } from "@/lib/saas/prospect-types";
import type { IntakeAnswers } from "@/lib/saas/prospect-types";
import { VENUE_ENTITIES } from "@/lib/pos/entities";
import type { LocationMode } from "@/lib/pos/saas-types";
import { planLabel } from "@/lib/saas/pricing";

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

  useEffect(() => {
    void interviewAiStatusFn()
      .then((r) => setAi(r.ai))
      .catch(() => setAi(false));
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
        setRec(null);
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
        <h2 className="mt-1 text-2xl font-black tracking-tighter">Describe the operation</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          In your own words: locations, bar vs kitchen, host vs single operator, volume,
          what you need. We will ask a few follow-ups, then recommend a setup you can
          edit. Guest cards are always Summex Payments.
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
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={7}
          className="min-h-36 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="We run a hall with a bar program and two kitchens. Guests pay one check. We need floor, KDS, and operator payouts…"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {freeText.trim().length}/40 minimum
        </span>
      </Field>

      {messages.filter((m) => m.role === "assistant").length > 0 && (
        <ol className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          {messages.map((m, i) => (
            <li key={`${m.at}-${i}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? "You" : "Summex"}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.text.replace(/\[q:[^\]]+\]\s*/g, "")}</p>
            </li>
          ))}
        </ol>
      )}

      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q) => (
            <Field key={q.id} label={q.prompt} hint={q.hint}>
              <Input
                value={replies[q.id] ?? ""}
                onChange={(e) => setReplies((r) => ({ ...r, [q.id]: e.target.value }))}
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
            {busy ? "Analyzing…" : questions.length ? "Re-analyze" : "Analyze"}
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
  onChange,
  onAccept,
  busy,
}: {
  rec: InterviewRecommendation;
  source: InterviewSource | null;
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

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleChip
          on={rec.operatingModel === "single_operator"}
          label="Single operator"
          onClick={() => onChange({ ...rec, operatingModel: "single_operator" })}
        />
        <ToggleChip
          on={rec.operatingModel === "host_multi_operator"}
          label="Host + multiple operators"
          onClick={() => onChange({ ...rec, operatingModel: "host_multi_operator" })}
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
