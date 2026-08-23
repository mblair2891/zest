import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { isProspectDemo } from "@/lib/demo/session";
import { cancelSpeech, estimateSpeechMs, speak } from "@/lib/demo/speech";
import { runDemoStepAction } from "@/lib/demo/run-step";
import { getTourNarrationFn } from "@/lib/demo/tour-narration";
import { navigateTourRoute } from "@/lib/demo/tour-navigate";
import type { TourStep } from "@/lib/demo/tour-scripts";
import { useTourStore } from "@/lib/demo/tour-store";
import { usePosStore } from "@/lib/pos/store";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

function padRect(r: Rect, pad = 8): Rect {
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function findTarget(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function applyStepSideEffects(step: TourStep) {
  if (step.view) {
    try {
      usePosStore.getState().setView(step.view);
    } catch {
      /* POS not mounted */
    }
  }
  if (!step.action || step.action === "none") return;
  if (!isProspectDemo()) return;
  runDemoStepAction(step.action);
}

export function DemoTourHost() {
  const navigate = useNavigate();
  const tour = useTourStore((s) => s.tour);
  const stepIndex = useTourStore((s) => s.index);
  const playing = useTourStore((s) => s.playing);
  const scripts = useTourStore((s) => s.scripts);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const pause = useTourStore((s) => s.pause);
  const play = useTourStore((s) => s.play);
  const exit = useTourStore((s) => s.exit);
  const applyScripts = useTourStore((s) => s.applyScripts);

  const leaveTour = useCallback(() => {
    exit();
    void navigate({ to: "/demo" });
  }, [exit, navigate]);

  const running = Boolean(tour);
  const step = tour?.steps[stepIndex];
  const total = tour?.steps.length ?? 0;
  const script = step ? (scripts[step.id] ?? step.script) : "";

  const [rect, setRect] = useState<Rect | null>(null);
  const [speechOn, setSpeechOn] = useState(true);
  const stepKey = `${tour?.id ?? ""}:${stepIndex}`;
  const spokenFor = useRef<string>("");

  useEffect(() => {
    if (!running || !tour) return;
    let cancelled = false;
    void getTourNarrationFn({
      data: {
        tourId: tour.id,
        steps: tour.steps.map((s) => ({
          id: s.id,
          title: s.title,
          outline: s.script,
        })),
      },
    })
      .then((res) => {
        if (cancelled || !res.scripts || Object.keys(res.scripts).length === 0) return;
        applyScripts(res.scripts);
      })
      .catch(() => {
        /* handwritten fallback already in step.script */
      });
    return () => {
      cancelled = true;
    };
  }, [running, tour?.id, applyScripts]);

  useEffect(() => {
    if (!running || !step) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let acted = false;
    const run = async () => {
      if (step.route) {
        try {
          await navigateTourRoute((opts) => navigate(opts), step.route);
        } catch {
          toast.error("Tour could not open that screen. Continuing.");
        }
      }
      if (cancelled) return;
      const applyOnce = () => {
        if (acted || cancelled) return;
        acted = true;
        applyStepSideEffects(step);
      };
      window.setTimeout(() => {
        if (cancelled) return;
        if (step.view) applyOnce();
        const tryFind = (attempt: number) => {
          if (cancelled) return;
          const el = findTarget(step.selector);
          if (el) {
            el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
            setRect(padRect(el.getBoundingClientRect()));
            applyOnce();
            return;
          }
          setRect(null);
          if (attempt >= 6) applyOnce();
          if (attempt < 10) window.setTimeout(() => tryFind(attempt + 1), 240);
        };
        tryFind(0);
      }, 280);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [running, stepKey, navigate, step]);

  useLayoutEffect(() => {
    if (!running || !step?.selector) return;
    const update = () => {
      const el = findTarget(step.selector);
      setRect(el ? padRect(el.getBoundingClientRect()) : null);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const id = window.setInterval(update, 400);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(id);
    };
  }, [running, stepKey, step?.selector]);

  useEffect(() => {
    if (!running || !step) {
      cancelSpeech();
      spokenFor.current = "";
      return;
    }
    if (spokenFor.current === stepKey) return;
    spokenFor.current = stepKey;
    cancelSpeech();
    if (!speechOn) return;
    void speak(script);
  }, [running, stepKey, script, speechOn, step]);

  useEffect(() => {
    if (!running || !playing || !step) return;
    const wait = Math.max(step.waitMs ?? 700, estimateSpeechMs(script) + 600);
    const t = window.setTimeout(() => {
      if (stepIndex >= total - 1) leaveTour();
      else next();
    }, wait);
    return () => window.clearTimeout(t);
  }, [running, playing, stepKey, script, next, step, stepIndex, total, leaveTour]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        leaveTour();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, leaveTour]);

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  if (!running || !tour || !step) return <Toaster position="top-center" richColors />;

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
        {rect ? (
          <div
            className="absolute rounded-xl ring-2 ring-amber-300/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.62)] transition-all duration-300"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-slate-950/45" />
        )}
      </div>

      <aside
        className="pointer-events-auto fixed bottom-4 left-1/2 z-[80] w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur"
        role="dialog"
        aria-label="Guided demo narrator"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              {tour.title} · {stepIndex + 1} / {total}
            </p>
            <h2 className="mt-1 font-serif text-lg text-white">{step.title}</h2>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={leaveTour}
          >
            Exit
          </Button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{script}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-amber-300 transition-all"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={stepIndex === 0} onClick={back}>
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-amber-300 text-slate-950 hover:bg-amber-200"
            onClick={() => {
              if (stepIndex >= total - 1) leaveTour();
              else next();
            }}
          >
            {stepIndex >= total - 1 ? "Finish" : "Next"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              if (playing) {
                pause();
                return;
              }
              play();
              if (speechOn) void speak(script);
            }}
          >
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn("text-white/70 hover:bg-white/10 hover:text-white", !speechOn && "line-through")}
            onClick={() => {
              setSpeechOn((v) => {
                const nextOn = !v;
                if (!nextOn) cancelSpeech();
                else void speak(script);
                return nextOn;
              });
            }}
          >
            Voice {speechOn ? "on" : "off"}
          </Button>
        </div>
      </aside>
    </>
  );
}
