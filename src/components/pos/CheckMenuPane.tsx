import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import type { MenuItem } from "@/lib/pos/types";
import { isHappyHour, printedItemPriceCents } from "@/lib/pos/calculations";
import { needsOpenAmount } from "@/lib/pos/open-items";
import {
  findWellDrink,
  orderPadCategories,
  orderPadTiles,
  spiritLevelRows,
  visibleWellMixers,
  wellLevelModifierName,
  type WellLevelRow,
  type WellPour,
} from "@/lib/pos/well-book";
import { categoryButtonPaint, usePrefersDark } from "@/lib/pos/service-colors";
import { useStationLayout } from "@/lib/ui/station-layout";
import { cn, formatCurrency } from "@/lib/utils";
import { ModifierDialog } from "./ModifierDialog";
import { OpenAmountDialog } from "./OpenAmountDialog";
import { WellSpiritDialog } from "./WellSpiritDialog";

/** Menu for the open-check screen. A tap adds to the active check and stays on this screen. */
export function CheckMenuPane() {
  const layout = useStationLayout();
  const menuScheme = usePrefersDark() ? "dark" : "light";
  const categories = usePosStore((s) => s.categories);
  const menuItems = usePosStore((s) => s.menuItems);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((row) => row.id === s.activeOrderId) ?? null);
  const addItem = usePosStore((s) => s.addItem);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [modOpen, setModOpen] = useState(false);
  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [modPriceCents, setModPriceCents] = useState<number | null>(null);
  const [openPriceItem, setOpenPriceItem] = useState<MenuItem | null>(null);
  const [openPriceError, setOpenPriceError] = useState<string | null>(null);
  const [wellSpirit, setWellSpirit] = useState<{ spiritId: string; entityId: string; name: string } | null>(null);
  const [wellBottle, setWellBottle] = useState<WellLevelRow | null>(null);
  const [wellPour, setWellPour] = useState<WellPour | null>(null);
  const happy = isHappyHour(settings);
  const cats = orderPadCategories(categories, menuItems, null);
  const tiles = useMemo(
    () =>
      orderPadTiles({
        items: menuItems,
        vendors,
        vendorFilter: null,
        categoryId,
        search,
      }),
    [menuItems, vendors, categoryId, search],
  );
  const ready = Boolean(order && order.status === "open" && order.id === activeOrderId);

  const onMenuClick = (item: MenuItem) => {
    if (!ready || !item.available) return;
    if (needsOpenAmount(item)) {
      setOpenPriceItem(item);
      setOpenPriceError(null);
      return;
    }
    const groups = usePosStore.getState().modifierGroups.filter((g) => item.modifierGroupIds.includes(g.id));
    if (groups.some((g) => g.required)) {
      setModPriceCents(null);
      setModItem(item);
      setModOpen(true);
      return;
    }
    const res = addItem(item.id);
    if (!res.ok) toast.error(res.error ?? "Could not add");
  };

  const submitOpenAmount = (cents: number) => {
    if (!openPriceItem) return;
    const groups = usePosStore
      .getState()
      .modifierGroups.filter((g) => openPriceItem.modifierGroupIds.includes(g.id));
    if (groups.some((g) => g.required)) {
      setModPriceCents(cents);
      setModItem(openPriceItem);
      setModOpen(true);
      setOpenPriceItem(null);
      setOpenPriceError(null);
      return;
    }
    const res = addItem(openPriceItem.id, { unitPriceCents: cents });
    if (!res.ok) {
      setOpenPriceError(res.error ?? "Could not add");
      return;
    }
    setOpenPriceItem(null);
    setOpenPriceError(null);
  };

  const wellBook = wellSpirit
    ? vendors.find((vendor) => vendor.id === wellSpirit.entityId)?.wellBook
    : undefined;
  const chooseWellMixer = (mixerId: string) => {
    if (!wellSpirit || !wellPour || !wellBottle) return;
    const drink = findWellDrink(menuItems, {
      entityId: wellSpirit.entityId,
      spiritId: wellSpirit.spiritId,
      mixerId,
      pour: wellPour,
    });
    if (drink) {
      const res = addItem(drink.id, {
        modifiers: [
          {
            groupId: `well-bottle-${wellSpirit.entityId}`,
            groupName: "Bottle",
            optionId: wellBottle.bottleId,
            optionName: wellLevelModifierName(wellBottle),
            priceCents: wellBottle.chargeCents,
          },
        ],
      });
      if (!res.ok) toast.error(res.error ?? "Could not add");
    }
    setWellSpirit(null);
    setWellBottle(null);
    setWellPour(null);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg" data-order-menu>
      <div className="flex gap-2 overflow-x-auto border-b border-border p-2" data-menu-categories>
        {cats.map((c) => {
          const paint = categoryButtonPaint(c.color, menuScheme);
          const selected = categoryId === c.id;
          return (
            <Button
              key={c.id}
              className="station-touch h-12 min-w-[6.5rem] shrink-0 border-transparent text-base font-semibold"
              variant="outline"
              data-menu-swatch={paint.id}
              style={{
                background: paint.bg,
                color: paint.ink,
                boxShadow: selected ? `inset 0 0 0 3px ${paint.ink}` : undefined,
              }}
              onClick={() => {
                setCategoryId(c.id);
                setSearch("");
              }}
            >
              {c.name}
            </Button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!ready && (
          <p className="px-2 py-6 text-center text-base text-muted-foreground">
            Seat or open the check, then tap an item.
          </p>
        )}
        <div
          className={cn("grid gap-2", layout.smallForm ? "grid-cols-1" : "grid-cols-2 min-[1100px]:grid-cols-3")}
          data-menu-cols={layout.smallForm ? "1" : undefined}
        >
          {tiles.map((tile) => {
            if (tile.kind === "spirit") {
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={!ready}
                  data-well-spirit={tile.spiritId}
                  onClick={() => {
                    setWellSpirit({ spiritId: tile.spiritId, entityId: tile.entityId, name: tile.name });
                    setWellBottle(null);
                    setWellPour(null);
                  }}
                  className="flex min-h-16 flex-col rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.98]"
                >
                  <span className="text-base font-semibold leading-snug">{tile.name}</span>
                  <span className="mt-auto pt-2 text-sm font-semibold tabular">
                    {formatCurrency(printedItemPriceCents(tile.priceCents, settings, tile.entityId).card)}
                  </span>
                </button>
              );
            }
            const item = tile.item;
            const openEntry = needsOpenAmount(item);
            const printed =
              happy && item.happyHourPriceCents != null ? item.happyHourPriceCents : item.priceCents;
            const dualPrice = printedItemPriceCents(printed, settings, item.vendorId);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!ready || !item.available}
                data-open-item={openEntry ? item.openKind ?? "price" : undefined}
                onClick={() => onMenuClick(item)}
                className={cn(
                  "flex min-h-16 flex-col rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.98]",
                  !item.available && "opacity-40",
                )}
              >
                <span className="text-base font-semibold leading-snug">{item.name}</span>
                <span className="mt-auto pt-2 text-sm font-semibold tabular">
                  {openEntry ? "Enter amount" : formatCurrency(dualPrice.card)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <ModifierDialog open={modOpen} onOpenChange={setModOpen} item={modItem} unitPriceCents={modPriceCents} />
      <OpenAmountDialog
        item={openPriceItem}
        error={openPriceError}
        onClose={() => {
          setOpenPriceItem(null);
          setOpenPriceError(null);
        }}
        onAdd={submitOpenAmount}
      />
      <WellSpiritDialog
        spiritName={wellSpirit?.name ?? null}
        spiritId={wellSpirit?.spiritId ?? null}
        levels={wellSpirit && wellBook ? spiritLevelRows(wellBook, wellSpirit.spiritId) : []}
        bottle={wellBottle}
        pour={wellPour}
        mixers={wellBook ? visibleWellMixers(wellBook) : []}
        onBottle={(row) => {
          setWellBottle(row);
          setWellPour(null);
        }}
        onChangeBottle={() => {
          setWellBottle(null);
          setWellPour(null);
        }}
        onPour={setWellPour}
        onMixer={chooseWellMixer}
        onClose={() => {
          setWellSpirit(null);
          setWellBottle(null);
          setWellPour(null);
        }}
      />
    </section>
  );
}
