import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { DEFAULT_VOICE_BY_ROLE, parseVoiceByRole, voiceEnabledForRole } from "@/lib/voice/roles";
import { useVoiceCommand } from "@/lib/voice/use-voice-command";
import {
  commitVoicePending,
  logVoiceResult,
  previewVoiceCommand,
  type VoiceExecuteResult,
} from "@/lib/voice/execute";
import { cn } from "@/lib/utils";

export function VoiceCommandButton() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const settings = usePosStore((s) => s.settings);
  const map = parseVoiceByRole(settings.voiceControlEnabledByRole ?? DEFAULT_VOICE_BY_ROLE);
  const enabled = voiceEnabledForRole(map, emp?.role);
  const voice = useVoiceCommand();
  const [panel, setPanel] = useState<VoiceExecuteResult | null>(null);
  const [transcript, setTranscript] = useState("");

  if (!enabled || !emp || emp.role === "kiosk") return null;

  const go = (text: string) => {
    setTranscript(text);
    const preview = previewVoiceCommand(text);
    logVoiceResult(text, preview);
    if (preview.ok && !preview.needsConfirm && !preview.didYouMean && preview.pending) {
      const done = commitVoicePending(preview.pending, preview.intent);
      logVoiceResult(text, done);
      setPanel(done);
      voice.reset();
      return;
    }
    setPanel(preview);
    voice.reset();
  };

  const confirm = () => {
    if (!panel?.pending) return;
    const done = commitVoicePending(panel.pending, panel.intent);
    logVoiceResult(transcript, done);
    setPanel(done);
  };

  const pick = (id: string) => {
    if (!panel) return;
    const pending = {
      kind: panel.intent.kind,
      itemId: id,
      tableId: panel.pending?.tableId,
    } as NonNullable<VoiceExecuteResult["pending"]>;
    if (panel.needsConfirm || panel.intent.destructive) {
      setPanel({ ...panel, pending, didYouMean: undefined, ok: true, message: "Confirm?" });
      return;
    }
    const done = commitVoicePending(pending, panel.intent);
    logVoiceResult(transcript, done);
    setPanel(done);
  };

  const listening = voice.status === "listening";
  const processing = voice.status === "processing";

  return (
    <div className="relative" data-demo="voice-mic">
      <Button
        size="icon"
        variant={listening ? "default" : "ghost"}
        aria-label={listening ? "Stop listening" : "Voice command"}
        title="Voice command"
        onClick={() => {
          setPanel(null);
          if (listening) voice.cancel();
          else voice.listen(go);
        }}
        className={cn(listening && "animate-pulse")}
      >
        {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      {(listening || processing || panel || voice.error) && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl border border-border bg-surface p-3 shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant={voice.status === "error" || panel?.deny ? "danger" : "info"}>
              {listening ? "Listening" : processing ? "Processing" : panel?.deny ? "Denied" : "Voice"}
            </Badge>
          </div>
          {(voice.interim || transcript) && (
            <p className="text-xs text-muted-foreground">“{voice.interim || transcript}”</p>
          )}
          {voice.error && <p className="text-xs text-danger">{voice.error}</p>}
          {panel && <p className="mt-1 text-sm">{panel.message}</p>}
          {panel?.didYouMean && (
            <div className="mt-2 flex flex-col gap-1">
              {panel.didYouMean.map((d) => (
                <Button key={d.id} size="sm" variant="outline" onClick={() => pick(d.id)}>
                  {d.name}
                </Button>
              ))}
            </div>
          )}
          {panel?.needsConfirm && panel.pending && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={confirm}>
                {panel.confirmLabel ?? "Confirm"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
                Cancel
              </Button>
            </div>
          )}
          {panel && !panel.needsConfirm && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setPanel(null)}>
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Demo / tour: run a transcript as if spoken. */
export function applyVoiceTranscript(text: string): VoiceExecuteResult {
  const preview = previewVoiceCommand(text);
  if (preview.pending && (preview.ok || preview.needsConfirm) && !preview.didYouMean) {
    const done = commitVoicePending(preview.pending, preview.intent);
    logVoiceResult(text, done);
    return done;
  }
  logVoiceResult(text, preview);
  return preview;
}
