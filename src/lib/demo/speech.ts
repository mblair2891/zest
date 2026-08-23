/** Browser voiceover. Pause/Exit must call cancelSpeech. */

export function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3500, Math.min(18000, Math.round((words / 2.4) * 1000)));
}

export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  return (
    voices.find((v) => /en-US/i.test(v.lang) && /natural|premium|samantha|google|enhanced/i.test(v.name)) ||
    voices.find((v) => /en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang))
  );
}

function waitForVoices(synth: SpeechSynthesis): Promise<void> {
  if (synth.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve();
    };
    synth.addEventListener("voiceschanged", done);
    window.setTimeout(done, 600);
  });
}

export function speak(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const synth = window.speechSynthesis;
  const body = text.trim();
  if (!synth || !body) {
    return new Promise((r) => window.setTimeout(r, estimateSpeechMs(text)));
  }
  cancelSpeech();
  return new Promise((resolve) => {
    void waitForVoices(synth).then(() => {
      const u = new SpeechSynthesisUtterance(body);
      u.rate = 1.02;
      u.pitch = 1;
      u.lang = "en-US";
      const preferred = pickVoice(synth);
      if (preferred) u.voice = preferred;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      try {
        synth.speak(u);
      } catch {
        done();
        return;
      }
      window.setTimeout(done, estimateSpeechMs(body) + 2000);
    });
  });
}
