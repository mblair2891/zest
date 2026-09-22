import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PinKeypad({
  title,
  hint,
  error,
  shakeToken = 0,
  onComplete,
  onClearError,
  station,
}: {
  title?: string;
  hint?: string;
  error?: string | null;
  /** Bump to replay the invalid-PIN shake and clear the dots. */
  shakeToken?: number;
  onComplete: (pin: string) => void;
  onClearError?: () => void;
  /**
   * Station pad: 1–9, Enter, 0, Clock in. Enter opens the session.
   * Clock in punches and stays on the pad. No clock-out key.
   */
  station?: {
    onEnter: (pin: string) => void;
    onClockIn: (pin: string) => void;
  };
}) {
  const [pin, setPin] = useState("");
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!shakeToken) return;
    setPin("");
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 480);
    return () => window.clearTimeout(t);
  }, [shakeToken]);

  const press = (d: string) => {
    onClearError?.();
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (!station && next.length >= 4) {
      onComplete(next);
      setTimeout(() => setPin(""), 180);
    }
  };

  const runStation = (kind: "enter" | "clock_in") => {
    const current = pin;
    setPin("");
    if (kind === "enter") station?.onEnter(current);
    else station?.onClockIn(current);
  };

  return (
    <div
      className={cn("mx-auto w-full max-w-sm", shaking && "pin-shake")}
      data-demo="pin-keypad"
      data-pin-pad={station ? "station" : "confirm"}
    >
      {title && <p className="mb-1 text-center text-sm font-semibold">{title}</p>}
      {hint && <p className="mb-4 text-center text-xs text-muted-foreground">{hint}</p>}
      <button
        type="button"
        className="mb-5 flex w-full justify-center gap-3"
        aria-label="Clear PIN"
        onClick={() => {
          onClearError?.();
          setPin("");
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-colors",
              i < pin.length ? "border-primary bg-primary" : "border-border-strong bg-transparent",
            )}
          />
        ))}
      </button>
      {error && (
        <p className="mb-3 text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {station ? (
        <div className="grid grid-cols-3 gap-3" data-pin-keys="12">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
            <Button
              key={key}
              type="button"
              variant="secondary"
              className="h-20 min-h-20 text-2xl font-semibold tabular"
              data-pin-key={key}
              onClick={() => press(key)}
            >
              {key}
            </Button>
          ))}
          <Button
            type="button"
            variant="default"
            className="h-20 min-h-20 px-1 text-base font-semibold leading-tight"
            data-pin-key="enter"
            onClick={() => runStation("enter")}
          >
            Enter
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-20 min-h-20 text-2xl font-semibold tabular"
            data-pin-key="0"
            onClick={() => press("0")}
          >
            0
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-20 min-h-20 px-1 text-base font-semibold leading-tight"
            data-pin-key="clock-in"
            onClick={() => runStation("clock_in")}
          >
            Clock in
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
            if (key === "") return <div key="empty" />;
            if (key === "del") {
              return (
                <Button
                  key="del"
                  type="button"
                  variant="ghost"
                  className="h-20 min-h-20 text-lg"
                  onClick={() => {
                    onClearError?.();
                    setPin((p) => p.slice(0, -1));
                  }}
                >
                  <Delete className="h-6 w-6" />
                </Button>
              );
            }
            return (
              <Button
                key={key}
                type="button"
                variant="secondary"
                className="h-20 min-h-20 text-2xl font-semibold tabular"
                onClick={() => press(key)}
              >
                {key}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
