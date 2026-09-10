import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  TILL_DENOMS,
  dollarsToCents,
  sumDenominations,
  type TillDenomQty,
  type TillEntryMode,
} from "@/lib/pos/till-closeout";

function appendDigit(current: string, d: string, maxLen = 10): string {
  if (d === ".") {
    if (current.includes(".")) return current;
    return current ? `${current}.` : "0.";
  }
  if (current.includes(".")) {
    const [w, f = ""] = current.split(".");
    if (f.length >= 2) return current;
    return `${w}.${f}${d}`;
  }
  if (current === "0") return d;
  if (current.replace(/^-/, "").length >= maxLen) return current;
  return `${current}${d}`;
}

export function TillCountPad({
  entryMode,
  totalStr,
  onTotalStr,
  qty,
  onQty,
}: {
  entryMode: TillEntryMode;
  totalStr: string;
  onTotalStr: (v: string) => void;
  qty: TillDenomQty;
  onQty: (next: TillDenomQty) => void;
}) {
  const denomSum = sumDenominations(qty);
  const single = dollarsToCents(totalStr);
  const official = entryMode === "denomination" ? denomSum : denomSum > 0 ? denomSum : single ?? 0;
  const usingDenoms = entryMode === "denomination" || denomSum > 0;

  const press = (key: string) => {
    if (entryMode === "denomination") return;
    if (key === "del") {
      onTotalStr(totalStr.slice(0, -1));
      return;
    }
    if (key === "clr") {
      onTotalStr("");
      return;
    }
    onTotalStr(appendDigit(totalStr, key));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Counted total
        </p>
        <p className="mb-4 font-display text-5xl tabular leading-none sm:text-6xl" data-till="counted-total">
          {formatCurrency(official)}
        </p>
        {usingDenoms && entryMode === "single_total" && (
          <p className="mb-3 text-sm text-muted-foreground">
            Denominations were entered — that sum is the official counted amount.
          </p>
        )}
        {entryMode === "denomination" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TILL_DENOMS.map((d) => {
              const n = qty[d.id] ?? 0;
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-[11px] tabular text-muted-foreground">
                      {formatCurrency(n * d.cents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 text-lg"
                      onClick={() => onQty({ ...qty, [d.id]: Math.max(0, n - 1) })}
                      aria-label={`Fewer ${d.label}`}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-base tabular">{n}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 text-lg"
                      onClick={() => onQty({ ...qty, [d.id]: n + 1 })}
                      aria-label={`More ${d.label}`}
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {entryMode === "single_total" && (
          <p className="text-sm text-muted-foreground">
            Enter the total you counted. Do not use reports. Fields are not filled from expected cash.
          </p>
        )}
      </div>
      {entryMode === "single_total" && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <div className={cn("mb-3 rounded-xl bg-surface-2 px-3 py-4 text-right font-display text-4xl tabular")}>
            {totalStr || "0.00"}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((key) =>
              key === "del" ? (
                <Button
                  key="del"
                  type="button"
                  variant="ghost"
                  className="h-16 text-lg"
                  onClick={() => press("del")}
                >
                  <Delete className="h-6 w-6" />
                </Button>
              ) : (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  className="h-16 text-2xl font-semibold tabular"
                  onClick={() => press(key)}
                >
                  {key}
                </Button>
              ),
            )}
            <Button
              type="button"
              variant="outline"
              className="col-span-3 h-12"
              onClick={() => press("clr")}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
