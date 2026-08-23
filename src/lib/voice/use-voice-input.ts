import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  voiceInputSupported,
  voiceUnavailableReason,
  type SpeechRecognitionLike,
  type VoiceStatus,
} from "./speech";

export type UseVoiceInputResult = {
  status: VoiceStatus;
  supported: boolean;
  unavailableReason: string | null;
  /** Live (uncommitted) words while listening. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

/**
 * Microphone → text via SpeechRecognition / webkitSpeechRecognition.
 * Callers insert `onFinal` chunks; this hook never wipes the field.
 */
export function useVoiceInput(opts?: {
  lang?: string;
  onFinal?: (transcript: string) => void;
}): UseVoiceInputResult {
  const supported = voiceInputSupported();
  const unavailableReason = voiceUnavailableReason();
  const [status, setStatus] = useState<VoiceStatus>(
    supported ? "idle" : "unsupported",
  );
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const interimRef = useRef("");
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;
  const lang = opts?.lang ?? "en-US";
  const transcribeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushInterim = useCallback(() => {
    const leftover = interimRef.current.replace(/\s+/g, " ").trim();
    interimRef.current = "";
    setInterim("");
    if (leftover) onFinalRef.current?.(leftover);
  }, []);

  const teardown = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(
    () => () => {
      if (transcribeTimer.current) clearTimeout(transcribeTimer.current);
      teardown();
    },
    [teardown],
  );

  const start = useCallback(() => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    setError(null);
    interimRef.current = "";
    setInterim("");
    teardown();
    const rec = createSpeechRecognition();
    if (!rec) {
      setStatus("unsupported");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    wantRef.current = true;
    recRef.current = rec;

    rec.onstart = () => {
      if (wantRef.current) setStatus("listening");
    };
    rec.onresult = (ev) => {
      let finalChunk = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        const t = row[0]?.transcript ?? "";
        if (row.isFinal) finalChunk += t;
        else live += t;
      }
      interimRef.current = live;
      setInterim(live);
      const spoken = finalChunk.replace(/\s+/g, " ").trim();
      if (spoken) onFinalRef.current?.(spoken);
    };
    rec.onerror = (ev) => {
      const code = ev.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        wantRef.current = false;
        setStatus("denied");
        setError("Voice input not available in this browser");
        return;
      }
      if (code === "no-speech" || code === "aborted") return;
      setError("Could not hear that — try again, or keep typing.");
    };
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* already running */
        }
      }
      flushInterim();
      setStatus("idle");
    };

    try {
      rec.start();
      setStatus("listening");
    } catch {
      setStatus("idle");
      setError("Could not start the microphone.");
    }
  }, [flushInterim, lang, supported, teardown]);

  const stop = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current;
    setStatus("transcribing");
    if (rec) {
      try {
        rec.stop();
      } catch {
        flushInterim();
        setStatus("idle");
      }
    } else {
      flushInterim();
      setStatus("idle");
    }
    if (transcribeTimer.current) clearTimeout(transcribeTimer.current);
    transcribeTimer.current = setTimeout(() => {
      setStatus((s) => (s === "transcribing" ? "idle" : s));
    }, 280);
  }, [flushInterim]);

  const toggle = useCallback(() => {
    if (status === "listening" || status === "transcribing") stop();
    else start();
  }, [status, start, stop]);

  return {
    status: supported ? status : "unsupported",
    supported,
    unavailableReason,
    interim,
    error,
    start,
    stop,
    toggle,
  };
}
