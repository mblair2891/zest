import { useState } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PinKeypad({
  title,
  hint,
  error,
  onComplete,
  onClearError,
}: {
  title?: string;
  hint?: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  onClearError?: () => void;
}) {
  const [pin, setPin] = useState("");

  const press = (d: string) => {
    onClearError?.();
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      onComplete(next);
      setTimeout(() => setPin(""), 180);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm" data-demo="pin-keypad">
      {title && <p className="mb-1 text-center text-sm font-semibold">{title}</p>}
      {hint && <p className="mb-4 text-center text-xs text-muted-foreground">{hint}</p>}
      <div className="mb-5 flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-colors",
              i < pin.length ? "border-primary bg-primary" : "border-border-strong bg-transparent",
            )}
          />
        ))}
      </div>
      {error && (
        <p className="mb-3 text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          if (key === "del") {
            return (
              <Button
                key="del"
                type="button"
                variant="ghost"
                className="h-20 text-lg"
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
              className="h-20 text-2xl font-semibold tabular"
              onClick={() => press(key)}
            >
              {key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
