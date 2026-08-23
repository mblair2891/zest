import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { cn } from "@/lib/utils";
import { runDemoStepAction } from "@/lib/demo/run-step";
import type { DemoScript } from "@/lib/demo/scripts";

export function DemoPlayer({
  script,
  autoPlay = false,
  onExit,
}: {
  script: DemoScript;
  autoPlay?: boolean;
  onExit?: () => void;
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);
  const step = script.steps[i]!;
  const last = i >= script.steps.length - 1;

  useEffect(() => {
    if (step.view) usePosStore.getState().setView(step.view);
    runDemoStepAction(step.action);
  }, [step.id]);

  useEffect(() => {
    if (!step.target) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(`[data-demo="${step.target}"]`);
    if (el instanceof HTMLElement) {
      setSpotlight(el.getBoundingClientRect());
    } else {
      setSpotlight(null);
    }
  }, [step.target, i]);

  useEffect(() => {
    if (!playing || last) return;
    const ms = step.autoMs ?? 5000;
    const t = window.setTimeout(() => setI((n) => Math.min(n + 1, script.steps.length - 1)), ms);
    return () => window.clearTimeout(t);
  }, [playing, i, last, step.autoMs, script.steps.length]);

  return (
    <>
      {spotlight && (
        <div
          className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-champagne"
          style={{
            top: spotlight.top - 4,
            left: spotlight.left - 4,
            width: spotlight.width + 8,
            height: spotlight.height + 8,
          }}
          aria-hidden
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[min(100%-2rem,24rem)] sm:p-0">
        <div className="rounded-2xl border border-border bg-surface/95 p-4 shadow-lg backdrop-blur">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {script.title} · {i + 1}/{script.steps.length}
          </p>
          <h2 className="mt-1 font-display text-lg font-medium text-foreground">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={i === 0}
              onClick={() => {
                setPlaying(false);
                setI((n) => Math.max(0, n - 1));
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (last) {
                  onExit?.();
                  return;
                }
                setPlaying(false);
                setI((n) => n + 1);
              }}
            >
              {last ? "Done" : "Next"}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={playing ? "Pause" : "Auto-play"}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Skip"
              onClick={() => onExit?.()}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="ml-auto inline-flex h-9 w-9 items-center justify-center text-muted-foreground"
              aria-label="Exit tour"
              onClick={() => onExit?.()}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {last && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link to="/demo" className="underline-offset-2 hover:underline">
                All demos
              </Link>
              {" · "}
              <Link to="/get-pricing" className="underline-offset-2 hover:underline">
                Get pricing
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export function DemoBanner({
  label,
  onStartTour,
}: {
  label: string;
  onStartTour?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-3 py-2",
        "text-xs text-muted-foreground",
      )}
    >
      <span className="font-semibold tracking-widest text-foreground uppercase">
        Prospect demo
      </span>
      <span>{label} · not a live tenant · excluded from statistics</span>
      <span className="ml-auto flex gap-2">
        {onStartTour && (
          <Button type="button" size="sm" onClick={onStartTour}>
            Start guided demo
          </Button>
        )}
        <Link
          to="/demo"
          className="inline-flex h-9 items-center px-2 underline-offset-2 hover:underline"
        >
          Exit
        </Link>
      </span>
    </div>
  );
}
