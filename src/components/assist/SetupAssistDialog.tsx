import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Field } from "@/components/saas/WizardChrome";
import { usePosStore } from "@/lib/pos/store";
import { assistAiStatusFn, assistSetupTurnFn } from "@/lib/assist/api";
import { applyAssistDraft } from "@/lib/assist/apply-pos";
import {
  ASSIST_DOMAIN_LABEL,
  type AssistContext,
  type AssistDomain,
  type AssistDraft,
  type AssistMessage,
  type AssistQuestion,
  type AssistSource,
} from "@/lib/assist/types";
import { formatCurrency } from "@/lib/utils";
import { cashPriceCents, cashPolicyFromSettings } from "@/lib/pos/cash-discount";

function useAssistContext(): AssistContext {
  const settings = usePosStore((s) => s.settings);
  const categories = usePosStore((s) => s.categories);
  const vendors = usePosStore((s) => s.vendors);
  const sections = usePosStore((s) => s.floorSections);
  const locId = usePosStore((s) => s.tenantLocationId);
  return useMemo(
    () => ({
      locationId: locId ?? undefined,
      locationName: settings.name,
      hostMultiOperator: Boolean(
        settings.hostMultiOperator || settings.multiTenantHallMode,
      ),
      cashDiscountEnabled: Boolean(settings.cashDiscountEnabled),
      cashDiscountPercent: settings.cashDiscountPercent ?? 5,
      cashRoundIncrement: settings.cashRoundIncrement ?? 0.25,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        station: c.station,
      })),
      operators: vendors
        .filter((v) => v.active)
        .map((v) => ({
          id: v.id,
          name: v.name,
          stationType: v.stationType,
        })),
      sections: sections.map((s) => ({ id: s.id, name: s.name })),
    }),
    [settings, categories, vendors, sections, locId],
  );
}

export function SetupAssistButton({
  domain,
  label,
}: {
  domain: AssistDomain;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" />
        {label ?? "Describe with AI"}
      </Button>
      <SetupAssistDialog domain={domain} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SetupAssistDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: AssistDomain;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const ctx = useAssistContext();
  const [ai, setAi] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<AssistMessage[]>([]);
  const [questions, setQuestions] = useState<AssistQuestion[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<AssistDraft | null>(null);
  const [source, setSource] = useState<AssistSource>("guided");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void assistAiStatusFn()
      .then((r) => setAi(r.ai))
      .catch(() => setAi(false));
  }, [open]);

  const reset = () => {
    setText("");
    setMessages([]);
    setQuestions([]);
    setReplies({});
    setDraft(null);
    setError(null);
    setFlash(null);
  };

  const send = async (payload: AssistMessage[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await assistSetupTurnFn({
        data: { domain, messages: payload, context: ctx },
      });
      setSource(res.source);
      if (res.type === "questions") {
        setQuestions(res.questions);
        setDraft(null);
        setReplies({});
        setMessages([
          ...payload,
          {
            role: "assistant",
            text: res.questions.map((q) => q.prompt).join("\n"),
          },
        ]);
      } else {
        setQuestions([]);
        setDraft(res.draft);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse");
    } finally {
      setBusy(false);
    }
  };

  const submitNarrative = async () => {
    const t = text.trim();
    if (t.length < 8) {
      setError("Give a short paragraph — or tap the mic and speak.");
      return;
    }
    const next: AssistMessage[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    setText("");
    await send(next);
  };

  const submitFollowUps = async () => {
    const bits = questions
      .map((q) => `${q.id}: ${(replies[q.id] ?? "").trim()}`)
      .filter((line) => !line.endsWith(":"));
    if (!bits.length) {
      setError("Answer the questions, or skip by typing more above.");
      return;
    }
    const next: AssistMessage[] = [
      ...messages,
      { role: "user", text: bits.join("\n") },
    ];
    setMessages(next);
    await send(next);
  };

  const confirm = () => {
    if (!draft) return;
    const res = applyAssistDraft(draft);
    setFlash(res.detail);
    setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 700);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[min(100vw-1.25rem,36rem)]" showClose>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {ASSIST_DOMAIN_LABEL[domain]}
            {ai !== null && (
              <Badge variant={ai ? "info" : "secondary"}>
                {ai ? "AI setup" : "Guided setup"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Type or speak a paragraph. Summex extracts fields, asks if something is
          unclear, then you confirm. Guest cards stay Quantum Payments.
        </p>

        {messages.length > 0 && (
          <ol className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border bg-bg p-3 text-sm">
            {messages.map((m, i) => (
              <li key={i}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.role === "user" ? "You" : "Summex"}
                </span>
                <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
              </li>
            ))}
          </ol>
        )}

        {!draft && (
          <>
            <VoiceTextarea
              value={text}
              onChange={setText}
              rows={4}
              placeholder="Ribeye, 14oz USDA choice, grilled, mashed potatoes and seasonal veg, fifteen dollars"
            />
            <Button disabled={busy} onClick={() => void submitNarrative()}>
              {busy ? "Reading…" : messages.length ? "Add this" : "Analyze"}
            </Button>
          </>
        )}

        {questions.length > 0 && !draft && (
          <div className="space-y-3">
            {questions.map((q) => (
              <Field key={q.id} label={q.prompt} hint={q.hint}>
                <VoiceTextarea
                  value={replies[q.id] ?? ""}
                  onChange={(v) => setReplies((r) => ({ ...r, [q.id]: v }))}
                  rows={2}
                  className="min-h-20"
                  placeholder="Speak or type"
                />
              </Field>
            ))}
            <Button disabled={busy} onClick={() => void submitFollowUps()}>
              {busy ? "Thinking…" : "Send answers"}
            </Button>
          </div>
        )}

        {draft && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview · edit before save · {source === "ai" ? "AI" : "Guided"}
            </p>
            <DraftFields draft={draft} onChange={setDraft} />
            <div className="flex gap-2">
              <Button onClick={confirm}>Confirm</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(null);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {flash && <p className="text-sm text-success">{flash}</p>}
      </DialogContent>
    </Dialog>
  );
}

function DraftFields({
  draft,
  onChange,
}: {
  draft: AssistDraft;
  onChange: (d: AssistDraft) => void;
}) {
  const settings = usePosStore((s) => s.settings);
  if (draft.domain === "menu_item") {
    const policy = cashPolicyFromSettings(settings);
    const cash = policy ? cashPriceCents(draft.priceCents, policy) : draft.priceCents;
    return (
      <div className="grid gap-2">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <VoiceTextarea
          value={draft.description}
          onChange={(v) => onChange({ ...draft, description: v })}
          rows={3}
          className="min-h-20"
          hint={false}
        />
        <label className="text-xs text-muted-foreground">
          Printed / card price (cents as dollars)
          <Input
            className="mt-1"
            inputMode="decimal"
            value={(draft.priceCents / 100).toFixed(2)}
            onChange={(e) =>
              onChange({
                ...draft,
                priceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
              })
            }
          />
        </label>
        {policy && (
          <p className="text-xs text-muted-foreground">
            Card {formatCurrency(draft.priceCents)} · Cash {formatCurrency(cash)}
            {draft.priceBasis === "cash" ? " · mapped from cash quote" : ""}
          </p>
        )}
        <Input
          value={draft.categoryName}
          onChange={(e) => onChange({ ...draft, categoryName: e.target.value })}
        />
        {draft.vendorName && (
          <p className="text-xs text-muted-foreground">Operator: {draft.vendorName}</p>
        )}
      </div>
    );
  }
  if (draft.domain === "category") {
    return (
      <Input
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
      />
    );
  }
  if (draft.domain === "modifier") {
    return (
      <div className="space-y-2">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        {draft.options.map((o, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {o.name} · {formatCurrency(o.priceCents)}
          </p>
        ))}
      </div>
    );
  }
  if (draft.domain === "floor") {
    return (
      <ul className="space-y-2 text-sm">
        {draft.sections.map((s) => (
          <li key={s.name}>
            <span className="font-medium">{s.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · tables {s.tables.map((t) => t.label).join(", ")} · {s.tables[0]?.seats ?? 4}{" "}
              seats
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (draft.domain === "operator") {
    return (
      <div className="space-y-2">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {draft.stationType} · {draft.payoutNote || "ledger payout placeholder"}
        </p>
      </div>
    );
  }
  if (draft.domain === "station") {
    return (
      <ul className="text-sm">
        {draft.rules.map((r) => (
          <li key={r.target}>
            {r.target} → {r.station}
          </li>
        ))}
      </ul>
    );
  }
  if (draft.domain === "staff") {
    return (
      <div className="space-y-2">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {draft.role}
          {draft.email ? ` · ${draft.email}` : " · PIN only"}
        </p>
      </div>
    );
  }
  if (draft.domain === "location") {
    return (
      <Input
        value={draft.name ?? ""}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        placeholder="Location name"
      />
    );
  }
  if (draft.domain === "cash_discount") {
    return (
      <p className="text-sm">
        {draft.enabled
          ? `${draft.percent}% cash off, round up to $${draft.increment.toFixed(2)}`
          : "Cash discount off"}
      </p>
    );
  }
  return null;
}
