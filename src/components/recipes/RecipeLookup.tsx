import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import { useCostStore } from "@/lib/costs/store";
import { recipeForMenuItem, lineName, normalizeRecipe } from "@/lib/recipes/normalize";
import { recipeCostCents } from "@/lib/costs/theoretical";
import { canSeeEntity } from "@/lib/costs/permissions";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

function isPrepRole(role?: string): boolean {
  return (
    role === "bartender" ||
    role === "kitchen" ||
    role === "owner" ||
    role === "manager" ||
    role === "vendor_operator"
  );
}

export function RecipeLookupButton({
  menuItemId,
  large,
  icon,
}: {
  menuItemId: string;
  large?: boolean;
  icon?: boolean;
}) {
  const recipes = useCostStore((s) => s.recipes);
  const rec = recipeForMenuItem(recipes, menuItemId);
  if (!rec) return null;
  return (
    <RecipeLookupTrigger menuItemId={menuItemId} large={large} icon={icon} />
  );
}

function RecipeLookupTrigger({
  menuItemId,
  large,
  icon,
}: {
  menuItemId: string;
  large?: boolean;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={icon ? "icon" : "sm"}
        variant="outline"
        className={
          icon
            ? "h-8 w-8 bg-surface/90"
            : large
              ? "h-11 text-base"
              : "h-8 text-xs"
        }
        aria-label="Recipe / ingredients"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <BookOpen className={large ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {!icon && "Recipe / ingredients"}
      </Button>
      <RecipeLookupDialog
        menuItemId={menuItemId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function RecipeLookupDialog({
  menuItemId,
  open,
  onOpenChange,
}: {
  menuItemId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const recipes = useCostStore((s) => s.recipes);
  const skus = useCostStore((s) => s.skus);
  const menuItems = usePosStore((s) => s.menuItems);
  const raw = recipeForMenuItem(recipes, menuItemId);
  if (!raw) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Recipe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">No recipe on this item yet.</p>
        </DialogContent>
      </Dialog>
    );
  }
  const rec = normalizeRecipe(raw);
  if (!canSeeEntity(emp, rec.entityId)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Recipe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Not available for this operator.</p>
        </DialogContent>
      </Dialog>
    );
  }
  const prep = isPrepRole(emp?.role);
  const item = menuItems.find((m) => m.id === menuItemId);
  const cost = recipeCostCents(rec, skus);
  const pct =
    item && item.priceCents > 0 && cost > 0
      ? Math.round((cost / item.priceCents) * 1000) / 10
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1rem,28rem)]" showClose>
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight">{rec.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Yield {rec.yieldQty} {rec.yieldUnit}
          {rec.glassware ? ` · ${rec.glassware}` : ""}
          {rec.garnish ? ` · ${rec.garnish}` : ""}
        </p>
        {(rec.allergens.length > 0 || rec.dietary.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {rec.allergens.map((a) => (
              <Badge key={a} variant="warn" className="text-sm">
                {a}
              </Badge>
            ))}
            {rec.dietary.map((a) => (
              <Badge key={a} variant="secondary" className="text-sm">
                {a}
              </Badge>
            ))}
          </div>
        )}
        <ul className="space-y-1">
          {rec.lines.map((l, i) => (
            <li
              key={`${lineName(l)}-${i}`}
              className={cn("rounded-xl bg-bg px-3 py-2", prep ? "text-lg" : "text-base")}
            >
              {prep ? (
                <>
                  <span className="font-semibold tabular">{l.qty}</span> {l.unit}{" "}
                  {lineName(l)}
                </>
              ) : (
                lineName(l)
              )}
            </li>
          ))}
        </ul>
        {prep && rec.steps.length > 0 && (
          <ol className="list-decimal space-y-2 pl-5 text-lg leading-snug">
            {rec.steps.map((s, i) => (
              <li key={i}>
                {s.text}
                {s.seconds ? (
                  <span className="ml-1 text-sm text-muted-foreground">{s.seconds}s</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {rec.notes && (
          <p className="text-base text-muted-foreground">{rec.notes}</p>
        )}
        {prep && cost > 0 && (
          <p className="text-xs text-muted-foreground">
            Theoretical {formatCurrency(cost)}
            {pct != null ? ` · ${pct}% of ${formatCurrency(item?.priceCents ?? 0)}` : ""}
          </p>
        )}
        {!prep && (
          <p className="text-xs text-muted-foreground">
            Allergens and ingredients only. Prep lives on bar/kitchen.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
