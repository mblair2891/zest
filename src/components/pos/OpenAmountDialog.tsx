import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { appendOpenAmountKey, parseOpenAmountCents } from "@/lib/pos/open-items";
import type { MenuItem } from "@/lib/pos/types";
import { useEffect, useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/** Amount keypad for Open Food, Open Liquor, and any open-price item. */
export function OpenAmountDialog({
  item,
  error,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  error: string | null;
  onClose: () => void;
  onAdd: (cents: number) => void;
}) {
  const [buffer, setBuffer] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    setBuffer("");
    setLocalError(null);
  }, [item?.id]);
  const shown = buffer || "0.00";
  const cents = parseOpenAmountCents(buffer);
  const message = localError || error;

  return (
    <Dialog
      open={item != null}
      onOpenChange={(open) => {
        if (!open) {
          setBuffer("");
          setLocalError(null);
          onClose();
        }
      }}
    >
      <DialogContent data-open-price="" className="w-[min(100vw-1.5rem,24rem)]">
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
        </DialogHeader>
        <p
          className="text-center text-4xl font-semibold tabular"
          data-open-amount=""
        >
          ${shown}
        </p>
        <div className="grid grid-cols-3 gap-2" data-open-keypad="">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              data-open-key={key}
              className="station-touch min-h-14 rounded-xl border border-border bg-surface text-xl font-semibold"
              aria-label={key === "back" ? "Backspace" : key === "." ? "Decimal" : key}
              onClick={() => {
                setLocalError(null);
                setBuffer((prev) => appendOpenAmountKey(prev, key));
              }}
            >
              {key === "back" ? "⌫" : key}
            </button>
          ))}
        </div>
        {message ? (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {item?.openKind === "liquor"
              ? "This amount is the line price. It prints on the bar order printer."
              : item?.openKind === "food"
                ? "This amount is the line price. It prints on the food order printer."
                : "This amount is the line price."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="station-touch min-h-12"
            onClick={() => {
              setBuffer("");
              setLocalError(null);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            data-open-add=""
            className="station-touch min-h-12"
            disabled={cents == null}
            onClick={() => {
              if (cents == null) {
                setLocalError("Enter an amount");
                return;
              }
              onAdd(cents);
            }}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
