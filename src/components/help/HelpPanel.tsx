import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { askFloorHelpFn } from "@/lib/help/api";
import { buildHelpContext, type HelpSurface } from "@/lib/help/context";
import { HELP_PACK_VERSION } from "@/lib/help/guide-pack";
import type { HelpAnswer } from "@/lib/help/server";

export function HelpButton({
  surface = "pos",
  compact,
}: {
  surface?: HelpSurface;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className={compact ? "h-8 w-8 shrink-0" : "h-9 w-9 shrink-0"}
        aria-label="Help"
        title="Help"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-4 w-4" />
        <span className="sr-only">Help</span>
      </Button>
      <HelpPanel open={open} onOpenChange={setOpen} surface={surface} />
    </>
  );
}

export function HelpPanel({
  open,
  onOpenChange,
  surface,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  surface: HelpSurface;
}) {
  const ctx = buildHelpContext(surface);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await askFloorHelpFn({
        data: { ...ctx, question: q },
      });
      setAnswer(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Help is unavailable");
    } finally {
      setBusy(false);
    }
  };

  const where = [
    ctx.role || "PIN pad",
    ctx.screen,
    ctx.tableLabel ? `table ${ctx.tableLabel}` : "",
    ctx.entityName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1.25rem,28rem)] gap-3">
        <DialogHeader>
          <DialogTitle>Help</DialogTitle>
          <DialogDescription>
            Ask how to do a task on this screen. Answers come from the Operators Guide for your
            role — not a second manual.
          </DialogDescription>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">{where}</p>
        <VoiceTextarea
          value={question}
          onChange={setQuestion}
          rows={3}
          placeholder="How do I seat a table?"
          hint="Speak or type — no card numbers or PINs"
        />
        <Button disabled={busy || !question.trim()} onClick={() => void ask()}>
          {busy ? "Looking up…" : "Ask"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {answer && (
          <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
            {answer.blocked && (
              <p className="text-sm text-danger">
                {answer.note}
                {answer.whoCan ? ` ${answer.whoCan} can do this.` : ""}
              </p>
            )}
            {!answer.blocked && answer.note && (
              <p className="text-sm text-muted-foreground">{answer.note}</p>
            )}
            {answer.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {answer.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
            {answer.sources.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Guide: {answer.sources.join(" · ")}
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Operators Guide v{answer?.packVersion || HELP_PACK_VERSION}. Help reads that guide.
        </p>
      </DialogContent>
    </Dialog>
  );
}
