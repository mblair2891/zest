import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertSpokenText } from "@/lib/voice/speech";
import { useVoiceInput } from "@/lib/voice/use-voice-input";

const HINT = "Speak your answer — we’ll turn it into text";
const UNAVAILABLE = "Voice input not available in this browser";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  /** Set false to hide the spoken-answer hint. */
  hint?: string | false;
};

export function VoiceTextarea({
  value,
  onChange,
  hint = HINT,
  className,
  disabled,
  rows = 5,
  id,
  ...rest
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const caretRef = useRef<{ start: number; end: number }>({
    start: value.length,
    end: value.length,
  });
  const replaceNext = useRef(false);
  const [replaceArmed, setReplaceArmed] = useState(false);
  const reactId = useId();
  const fieldId = id ?? reactId;

  const rememberCaret = () => {
    const el = textareaRef.current;
    if (!el) return;
    caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const applySpoken = useCallback(
    (spoken: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? caretRef.current.start;
      const end = el?.selectionEnd ?? caretRef.current.end;
      if (replaceNext.current) {
        replaceNext.current = false;
        setReplaceArmed(false);
        const next = spoken.trim();
        valueRef.current = next;
        onChange(next);
        requestAnimationFrame(() => {
          const node = textareaRef.current;
          if (!node) return;
          const pos = next.length;
          node.focus();
          node.setSelectionRange(pos, pos);
          caretRef.current = { start: pos, end: pos };
        });
        return;
      }
      const { next, caret } = insertSpokenText(valueRef.current, spoken, start, end);
      valueRef.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(caret, caret);
        caretRef.current = { start: caret, end: caret };
      });
    },
    [onChange],
  );

  const voice = useVoiceInput({ onFinal: applySpoken });
  useEffect(() => {
    if (voice.status !== "idle") return;
    const t = window.setTimeout(() => {
      replaceNext.current = false;
      setReplaceArmed(false);
    }, 320);
    return () => window.clearTimeout(t);
  }, [voice.status]);
  const listening = voice.status === "listening";
  const transcribing = voice.status === "transcribing";
  const blocked = voice.status === "unsupported" || voice.status === "denied";
  const tooltip = blocked
    ? (voice.unavailableReason ?? UNAVAILABLE)
    : listening
      ? "Stop listening"
      : transcribing
        ? "Turning speech into text"
        : "Speak your answer";

  const showMic = true;
  const hasText = value.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          {...rest}
          id={fieldId}
          ref={textareaRef}
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            caretRef.current = {
              start: e.target.selectionStart,
              end: e.target.selectionEnd,
            };
          }}
          onSelect={rememberCaret}
          onKeyUp={rememberCaret}
          onClick={rememberCaret}
          className={cn(
            "min-h-28 w-full rounded-lg border border-border bg-surface px-3 py-2 pr-16 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
            className,
          )}
        />
        {showMic && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {listening && hasText && (
              <button
                type="button"
                className="h-12 min-w-12 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground hover:bg-surface-2"
                onClick={() => {
                  replaceNext.current = true;
                  setReplaceArmed(true);
                }}
                aria-pressed={replaceArmed}
                aria-label="Replace existing text with what you say"
                title="Replace existing text"
              >
                Replace
              </button>
            )}
            <button
              type="button"
              disabled={disabled || blocked}
              onClick={() => {
                rememberCaret();
                voice.toggle();
              }}
              title={tooltip}
              aria-label={
                blocked
                  ? UNAVAILABLE
                  : listening
                    ? "Stop voice input"
                    : "Start voice input"
              }
              aria-pressed={listening}
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-lg border transition",
                listening
                  ? "border-danger/40 bg-danger text-danger-foreground"
                  : blocked
                    ? "border-border bg-surface-2 text-muted-foreground"
                    : "border-border bg-surface text-foreground hover:bg-surface-2",
              )}
            >
              {listening ? (
                <Square className="h-5 w-5" fill="currentColor" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          </div>
        )}
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {listening && (
          <span className="inline-flex items-center gap-1.5 font-medium text-danger" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            Listening — tap Stop when you’re done
          </span>
        )}
        {transcribing && (
          <span aria-live="polite">Turning speech into text…</span>
        )}
        {replaceArmed && listening && (
          <span>Next words will replace the field.</span>
        )}
        {!listening && !transcribing && hint !== false && (
          <span>{hint}</span>
        )}
        {voice.interim && listening && (
          <span className="italic text-foreground/80">“{voice.interim}”</span>
        )}
        {voice.error && (
          <span className="text-danger" role="status">
            {voice.error}
          </span>
        )}
      </div>
    </div>
  );
}

export { useVoiceInput } from "@/lib/voice/use-voice-input";
