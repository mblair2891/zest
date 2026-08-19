import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import type { MenuItem, SelectedModifier } from "@/lib/pos/types";
import { cn, formatCurrency } from "@/lib/utils";
import { isHappyHour } from "@/lib/pos/calculations";

interface Props {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ModifierDialog({ item, open, onOpenChange }: Props) {
  const groups = usePosStore((s) => s.modifierGroups);
  const settings = usePosStore((s) => s.settings);
  const addItem = usePosStore((s) => s.addItem);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  const itemGroups = useMemo(() => {
    if (!item) return [];
    return groups.filter((g) => item.modifierGroupIds.includes(g.id));
  }, [item, groups]);

  useEffect(() => {
    if (!item) return;
    const init: Record<string, string[]> = {};
    for (const g of groups.filter((x) => item.modifierGroupIds.includes(x.id))) {
      const defaults = g.options.filter((o) => o.default).map((o) => o.id);
      init[g.id] = defaults.slice(0, g.max || 1);
    }
    setSelected(init);
    setNote("");
    setQty(1);
  }, [item, groups]);

  if (!item) return null;

  const happy = isHappyHour(settings);
  const base =
    happy && item.happyHourPriceCents != null
      ? item.happyHourPriceCents
      : item.priceCents;

  const toggle = (groupId: string, optionId: string, max: number) => {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.includes(optionId)) {
        return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
      }
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  const valid = itemGroups.every((g) => {
    const n = (selected[g.id] ?? []).length;
    return n >= g.min && n <= g.max;
  });

  const mods: SelectedModifier[] = [];
  let modTotal = 0;
  for (const g of itemGroups) {
    for (const optId of selected[g.id] ?? []) {
      const opt = g.options.find((o) => o.id === optId);
      if (!opt) continue;
      mods.push({
        groupId: g.id,
        groupName: g.name,
        optionId: opt.id,
        optionName: opt.name,
        priceCents: opt.priceCents,
      });
      modTotal += opt.priceCents;
    }
  }

  const lineTotal = (base + modTotal) * qty;

  const confirm = () => {
    if (!valid) return;
    addItem(item.id, {
      modifiers: mods,
      note: note.trim() || undefined,
      quantity: qty,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(base)}
            {happy && item.happyHourPriceCents != null && (
              <span className="ml-2 text-success">Happy hour</span>
            )}
          </p>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
          {itemGroups.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-medium">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.required ? "Required" : "Optional"}
                  {g.max > 1 ? ` · pick up to ${g.max}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = (selected[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g.id, o.id, g.max)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface-2 text-foreground hover:border-border-strong",
                      )}
                    >
                      {o.name}
                      {o.priceCents > 0 && (
                        <span className="ml-1 opacity-80">
                          +{formatCurrency(o.priceCents)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Special instructions
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. allergy, dressing on side"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Qty</span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              −
            </Button>
            <span className="w-8 text-center text-lg font-medium tabular">
              {qty}
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setQty((q) => q + 1)}
            >
              +
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={confirm}>
            Add · {formatCurrency(lineTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
