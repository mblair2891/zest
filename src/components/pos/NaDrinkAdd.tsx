import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCostStore } from "@/lib/costs/store";
import {
  addNaModifier,
  NA_DRINKS,
  sellNaDrink,
} from "@/lib/menu/na-drinks";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import { usePosStore } from "@/lib/pos/store";

/**
 * Non-alcoholic drinks on the menu.
 * Sell alone stores the drink as the recipe. Modifier adds the name with no alcohol line.
 */
export function NaDrinkAdd({ entityId }: { entityId: string }) {
  const [price, setPrice] = useState("3.00");
  const [note, setNote] = useState("");

  const sell = (drink: string) => {
    const cents = Math.round(Number(price) * 100);
    const pos = usePosStore.getState();
    const next = sellNaDrink({
      entityId,
      drink,
      priceCents: Number.isFinite(cents) && cents > 0 ? cents : 0,
      categories: pos.categories,
      items: pos.menuItems,
    });
    if (!next) return;
    usePosStore.setState({ categories: next.categories, menuItems: next.items });
    const cost = useCostStore.getState();
    const existing = cost.recipes.find(
      (row) => row.menuItemId === next.itemId && (row.entityId || "") === (entityId || ""),
    );
    cost.upsertRecipe({
      id: existing?.id,
      menuItemId: next.itemId,
      name: next.recipe.name,
      entityId,
      station: "bar",
      lines: next.recipe.lines,
      yieldQty: 1,
      yieldUnit: "portion",
    });
    persistLocationCatalog("menu");
    setNote(`${next.recipe.name} is on the menu. The recipe is the drink. No alcohol line.`);
  };

  const modify = (drink: string) => {
    const pos = usePosStore.getState();
    const next = addNaModifier({ drink, groups: pos.modifierGroups });
    if (!next) return;
    usePosStore.setState({ modifierGroups: next.groups });
    persistLocationCatalog("menu");
    setNote(`${drink} is a modifier on a cocktail. No alcohol line.`);
  };

  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-3" data-na-drinks={entityId || "house"}>
      <h3 className="text-sm font-semibold">Non-alcoholic</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cola, diet cola, lemon-lime, orange soda, root beer, orange juice, cranberry, pineapple, lemonade, iced tea,
        coffee, soda water, and still water. There is no alcohol line. The recipe is the drink itself. Sell it alone
        or add it as a modifier on a cocktail.
      </p>
      <label className="mt-2 block max-w-xs text-xs">
        Cash price when sold alone
        <Input
          className="mt-1"
          inputMode="decimal"
          data-na-price=""
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </label>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {NA_DRINKS.map((drink) => (
          <li key={drink} className="flex items-center justify-between gap-2 text-sm" data-na-drink={drink}>
            <span>{drink}</span>
            <span className="flex gap-1">
              <Button type="button" size="sm" variant="outline" data-na-sell={drink} onClick={() => sell(drink)}>
                Sell alone
              </Button>
              <Button type="button" size="sm" variant="outline" data-na-modifier={drink} onClick={() => modify(drink)}>
                Modifier
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {note ? (
        <p className="mt-2 text-xs text-primary" data-na-note>
          {note}
        </p>
      ) : null}
    </section>
  );
}
