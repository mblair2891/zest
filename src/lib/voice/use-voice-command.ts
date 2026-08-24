import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  voiceInputSupported,
  voiceUnavailableReason,
  type SpeechRecognitionLike,
} from "./speech";

export type VoiceCommandStatus = "idle" | "listening" | "processing" | "error" | "unsupported" | "denied";

export function useVoiceCommand() {
  const supported = voiceInputSupported();
  const unavailableReason = voiceUnavailableReason();
  const [status, setStatus] = useState<VoiceCommandStatus>(supported ? "idle" : "unsupported");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onDoneRef = useRef<((t: string) => void) | null>(null);

  const stopRec = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  useEffect(() => () => stopRec(), [stopRec]);

  const listen = useCallback(
    (onDone: (transcript: string) => void) => {
      if (!supported) {
        setStatus("unsupported");
        return;
      }
      setError(null);
      setInterim("");
      interimRef.current = "";
      finalRef.current = "";
      onDoneRef.current = onDone;
      stopRec();
      const rec = createSpeechRecognition();
      if (!rec) {
        setStatus("unsupported");
        return;
      }
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      recRef.current = rec;
      rec.onstart = () => setStatus("listening");
      rec.onresult = (ev) => {
        let live = "";
        let fin = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const row = ev.results[i];
          const t = row[0]?.transcript ?? "";
          if (row.isFinal) fin += t;
          else live += t;
        }
        if (live) {
          interimRef.current = live;
          setInterim(live);
        }
        if (fin) finalRef.current = (finalRef.current + " " + fin).replace(/\s+/g, " ").trim();
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          setStatus("denied");
          setError("Microphone permission denied");
          return;
        }
        if (ev.error === "no-speech" || ev.error === "aborted") return;
        setError("Could not hear that");
        setStatus("error");
      };
      rec.onend = () => {
        const text = (finalRef.current || interimRef.current).replace(/\s+/g, " ").trim();
        setInterim("");
        setStatus("processing");
        recRef.current = null;
        if (text) onDoneRef.current?.(text);
        else {
          setStatus("idle");
          setError("No speech heard");
        }
      };
      try {
        rec.start();
        setStatus("listening");
      } catch {
        setStatus("error");
        setError("Could not start the microphone");
      }
    },
    [stopRec, supported],
  );

  const cancel = useCallback(() => {
    stopRec();
    setStatus("idle");
    setInterim("");
  }, [stopRec]);

  const reset = useCallback(() => {
    setStatus(supported ? "idle" : "unsupported");
    setError(null);
    setInterim("");
  }, [supported]);

  return { status, supported, unavailableReason, interim, error, listen, cancel, reset, setStatus };
}
