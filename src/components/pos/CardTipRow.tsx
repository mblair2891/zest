import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CARD_TIP_PERCENTS,
  appendTipKey,
  cardChargeCents,
  centsFromMoneyDigits,
  percentFromDigits,
  tipFromKeypad,
  type CardTipChoice,
  type CardTipPercent,
  type TipKeyMode,
} from "@/lib/pos/card-tip";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export function CardTipRow({
  baseCents,
  tipCents,
  choice,
  onChoice,
  onApply,
}: {
  baseCents: number;
  tipCents: number;
  choice: CardTipChoice;
  onChoice: (choice: CardTipChoice) => void;
  /** When the card is already authorized, a choice captures that tip and closes. */
  onApply?: (choice: CardTipChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TipKeyMode>("amount");
  const [buffer, setBuffer] = useState("");
  const keypadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    keypadRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const commit = (next: CardTipChoice) => {
    setOpen(false);
    if (next.kind === "none") setBuffer("");
    onChoice(next);
    onApply?.(next);
  };

  const pickPercent = (percent: CardTipPercent) => {
    commit({ kind: "percent", percent });
  };

  const pickNone = () => {
    commit({ kind: "none" });
  };

  const apply = () => {
    const cents = tipFromKeypad(buffer, mode, baseCents);
    if (cents == null) return;
    if (cents <= 0) {
      pickNone();
      return;
    }
    if (mode === "amount") {
      commit({ kind: "custom-amount", cents });
      return;
    }
    const percent = percentFromDigits(buffer);
    if (percent == null) return;
    commit({ kind: "custom-percent", percent });
  };

  const pending = tipFromKeypad(buffer, mode, baseCents);

  return (
    <div data-card-tip-row="">
      <p className="mb-1.5 text-xs text-muted-foreground">Tip</p>
      <div className="flex flex-nowrap gap-1.5">
        {CARD_TIP_PERCENTS.map((percent) => {
          const selected = choice.kind === "percent" && choice.percent === percent;
          return (
            <Button
              key={percent}
              type="button"
              size="xl"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              className="station-touch h-14 min-h-14 min-w-0 flex-1 basis-0 px-1 text-base font-semibold"
              onClick={() => pickPercent(percent)}
            >
              {percent}%
            </Button>
          );
        })}
        <Button
          type="button"
          size="xl"
          data-card-tip-custom=""
          variant={
            choice.kind === "custom-amount" || choice.kind === "custom-percent"
              ? "default"
              : "outline"
          }
          aria-pressed={choice.kind === "custom-amount" || choice.kind === "custom-percent"}
          aria-expanded={open}
          className="station-touch h-14 min-h-14 min-w-0 flex-1 basis-0 px-1 text-base font-semibold"
          onClick={() => {
            setBuffer("");
            setOpen(true);
          }}
        >
          Custom
        </Button>
      </div>
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          data-card-tip-none=""
          aria-pressed={choice.kind === "none"}
          className={cn(
            "min-h-10 rounded-lg px-3 text-sm font-medium",
            choice.kind === "none" ? "bg-surface-2 text-foreground" : "text-muted-foreground",
          )}
          onClick={pickNone}
        >
          No tip
        </button>
      </div>
      <p className="text-sm font-medium tabular" data-card-tip-total="">
        Tip {formatCurrency(tipCents)} · Total {formatCurrency(cardChargeCents(baseCents, tipCents))}
      </p>
      {open ? (
        <div
          ref={keypadRef}
          className="mt-2 space-y-2 rounded-xl border border-border bg-bg p-3"
          data-card-tip-keypad=""
        >
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              className="station-touch min-h-12 flex-1"
              variant={mode === "amount" ? "default" : "outline"}
              onClick={() => {
                setMode("amount");
                setBuffer("");
              }}
            >
              Amount
            </Button>
            <Button
              type="button"
              size="lg"
              className="station-touch min-h-12 flex-1"
              variant={mode === "percent" ? "default" : "outline"}
              onClick={() => {
                setMode("percent");
                setBuffer("");
              }}
            >
              Percent
            </Button>
          </div>
          <p className="text-center text-2xl font-semibold tabular" data-card-tip-entry="">
            {mode === "amount"
              ? formatCurrency(centsFromMoneyDigits(buffer))
              : `${buffer || "0"}%`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                data-tip-key={key}
                className="station-touch min-h-14 rounded-xl border border-border bg-surface text-lg font-semibold"
                aria-label={key === "clear" ? "Clear" : key === "back" ? "Backspace" : key}
                onClick={() => setBuffer((prev) => appendTipKey(prev, key, mode))}
              >
                {key === "clear" ? "C" : key === "back" ? "⌫" : key}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-card-tip-none=""
            className="station-touch min-h-12 w-full rounded-xl border border-border text-base font-medium"
            onClick={pickNone}
          >
            No tip
          </button>
          <Button
            type="button"
            size="lg"
            data-card-tip-apply=""
            className="station-touch min-h-12 w-full"
            disabled={pending == null}
            onClick={apply}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
