/** Browser speech-to-text via the Web Speech API. No cloud key required. */

export type VoiceStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "unsupported"
  | "denied";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return ctor() !== null;
}

export function voiceUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Voice input not available in this browser";
  if (!window.isSecureContext) {
    return "Voice input needs a secure connection (https)";
  }
  if (!ctor()) return "Voice input not available in this browser";
  return null;
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const Ctor = ctor();
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** Join spoken chunks onto existing text without clobbering it. */
export function insertSpokenText(
  value: string,
  spoken: string,
  start: number,
  end: number,
): { next: string; caret: number } {
  const chunk = spoken.replace(/\s+/g, " ").trim();
  if (!chunk) return { next: value, caret: start };
  const before = value.slice(0, start);
  const after = value.slice(end);
  const spaceBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const spaceAfter = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const inserted = spaceBefore + chunk + spaceAfter;
  return {
    next: before + inserted + after,
    caret: before.length + inserted.length - spaceAfter.length,
  };
}
