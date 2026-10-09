import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCostStore } from "@/lib/costs/store";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import { usePosStore } from "@/lib/pos/store";
import type { Vendor } from "@/lib/pos/types";
import {
  defaultWellBook,
  syncWellCatalog,
  type WellBookConfig,
} from "@/lib/pos/well-book";

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function cents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function applyWellBook(entityId: string, config: WellBookConfig) {
  const pos = usePosStore.getState();
  const next = syncWellCatalog({
    entityId,
    config,
    items: pos.menuItems,
    categories: pos.categories,
    modifiers: pos.modifierGroups,
  });
  usePosStore.setState({
    vendors: pos.vendors.map((vendor) =>
      vendor.id === entityId ? { ...vendor, wellBook: config } : vendor,
    ),
    menuItems: next.items,
    categories: next.categories,
    modifierGroups: next.modifiers,
  });
  const cost = useCostStore.getState();
  for (const recipe of next.recipes) {
    const existing = cost.recipes.find(
      (row) => row.menuItemId === recipe.menuItemId && row.entityId === entityId,
    );
    cost.upsertRecipe({
      id: existing?.id,
      menuItemId: recipe.menuItemId,
      name: recipe.name,
      entityId,
      station: "bar",
      lines: recipe.lines,
      yieldQty: 1,
      yieldUnit: "portion",
    });
  }
  persistLocationCatalog("menu");
}

export function WellBookCard({ vendor }: { vendor: Vendor }) {
  const stored = vendor.wellBook ?? defaultWellBook();
  const [draft, setDraft] = useState<WellBookConfig>(stored);
  const [seen, setSeen] = useState(vendor.id + String(stored.enabled));
  const syncKey = vendor.id + String(stored.enabled) + stored.spirits.map((s) => s.name).join("|");
  if (seen !== syncKey) {
    setSeen(syncKey);
    setDraft(stored);
  }

  const setEnabled = (enabled: boolean) => {
    const next = { ...(vendor.wellBook ?? defaultWellBook()), enabled };
    setDraft(next);
    applyWellBook(vendor.id, next);
  };

  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-3" data-well-book={vendor.id}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Well book</h3>
        <Button
          type="button"
          size="sm"
          variant={!draft.enabled ? "default" : "outline"}
          data-well-book-off=""
          onClick={() => setEnabled(false)}
        >
          Off
        </Button>
        <Button
          type="button"
          size="sm"
          variant={draft.enabled ? "default" : "outline"}
          data-well-book-on=""
          onClick={() => setEnabled(true)}
        >
          On
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        On inserts a draft Wells group for this entity: well spirits, mixers, and highball, double, rocks, shot, and
        tall. Rum and Coke is 1.5 oz rum and cola. A double is 3 oz rum and cola. You can still edit the pour.
        Specialty upload sits beside these rows.
      </p>
      {draft.enabled ? (
        <div className="mt-3 grid gap-3">
          <div>
            <p className="mb-1 text-xs font-medium">Well spirits</p>
            <div className="grid gap-1 sm:grid-cols-3">
              {draft.spirits.map((spirit) => (
                <Input
                  key={spirit.id}
                  value={spirit.name}
                  data-well-spirit={spirit.id}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      spirits: draft.spirits.map((row) =>
                        row.id === spirit.id ? { ...row, name: event.target.value } : row,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Mixers</p>
            <ul className="space-y-1">
              {draft.mixers.map((mixer) => (
                <li key={mixer.id} className="flex items-center gap-2">
                  <Input
                    value={mixer.name}
                    data-well-mixer={mixer.id}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        mixers: draft.mixers.map((row) =>
                          row.id === mixer.id ? { ...row, name: event.target.value } : row,
                        ),
                      })
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      data-well-mixer-hide={mixer.id}
                      checked={Boolean(mixer.hidden)}
                      onChange={(event) => {
                        const next = {
                          ...draft,
                          mixers: draft.mixers.map((row) =>
                            row.id === mixer.id ? { ...row, hidden: event.target.checked } : row,
                          ),
                        };
                        setDraft(next);
                        applyWellBook(vendor.id, next);
                      }}
                    />
                    Hide
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              Standard pour (oz)
              <Input
                className="mt-1"
                inputMode="decimal"
                data-well-pour=""
                value={String(draft.pourOz ?? 1.5)}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  setDraft({ ...draft, pourOz: Number.isFinite(n) ? n : draft.pourOz });
                }}
              />
            </label>
            <label className="text-xs">
              Double pour (oz)
              <Input
                className="mt-1"
                inputMode="decimal"
                data-well-double-pour=""
                value={String(draft.doublePourOz ?? 3)}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  setDraft({ ...draft, doublePourOz: Number.isFinite(n) ? n : draft.doublePourOz });
                }}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Well price
              <Input
                className="mt-1"
                inputMode="decimal"
                data-well-price="well"
                value={dollars(draft.wellCents)}
                onChange={(event) => setDraft({ ...draft, wellCents: cents(event.target.value) })}
              />
            </label>
            <label className="text-xs">
              Call upcharge
              <Input
                className="mt-1"
                inputMode="decimal"
                data-well-price="call"
                value={dollars(draft.callUpchargeCents)}
                onChange={(event) =>
                  setDraft({ ...draft, callUpchargeCents: cents(event.target.value) })
                }
              />
            </label>
            <label className="text-xs">
              Premium upcharge
              <Input
                className="mt-1"
                inputMode="decimal"
                data-well-price="premium"
                value={dollars(draft.premiumUpchargeCents)}
                onChange={(event) =>
                  setDraft({ ...draft, premiumUpchargeCents: cents(event.target.value) })
                }
              />
            </label>
          </div>
          <Button type="button" size="sm" data-well-book-apply="" onClick={() => applyWellBook(vendor.id, draft)}>
            Update well book
          </Button>
        </div>
      ) : null}
    </section>
  );
}
