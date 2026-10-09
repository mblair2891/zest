import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkOlccHouseStockFn, refreshOlccPricesFn } from "@/lib/costs/api";
import {
  addOlccRowToOrder,
  buildSpiritOrderList,
  isOregonState,
  olccRefreshPlan,
  oregonStoreSearchUrl,
  searchOlccPrices,
  spiritOrderWithAdditions,
  zipFromAddress,
  type OlccBook,
  type OlccPrice,
  type SpiritOrderLine,
} from "@/lib/costs/olcc";
import {
  dropOlccOffer,
  keepOlccOffer,
  olccPickListHtml,
  reviewOlccOrder,
  type OlccKeptLine,
  type OlccStockOffer,
} from "@/lib/costs/olcc-stock";
import { useCostStore } from "@/lib/costs/store";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import { parseJurisdiction } from "@/lib/pos/jurisdiction";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";

const NO_PRICES: OlccPrice[] = [];

function saveBook(book: OlccBook) {
  useCostStore.setState({ olcc: book });
  persistLocationCatalog("costs");
}

/**
 * Oregon spirits buy list on the house store.
 * The catalog is the full monthly price list. The short pick list sits under it.
 * The links open Oregon Liquor Search. Nothing here sends an order to the OLCC.
 */
export function OlccSpiritsPanel() {
  const state = usePosStore((s) => parseJurisdiction(s.settings.jurisdiction).state);
  const address = usePosStore((s) => s.settings.address);
  const olcc = useCostStore((s) => s.olcc);
  const skus = useCostStore((s) => s.skus);
  const recipes = useCostStore((s) => s.recipes);
  const houseSupplier = useCostStore((s) => s.suppliers.find((supplier) => supplier.houseStore));
  const house = usePosStore((s) => s.settings.name);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<SpiritOrderLine[]>([]);
  const [checked, setChecked] = useState(false);
  const [staying, setStaying] = useState<OlccKeptLine[]>([]);
  const [offers, setOffers] = useState<OlccStockOffer[]>([]);
  const oregon = isOregonState(state);

  useEffect(() => {
    if (!oregon) return;
    const plan = olccRefreshPlan(new Date(), olcc);
    if (!plan.due) return;
    let cancel = false;
    void refreshOlccPricesFn({ data: { asOf: plan.asOf } })
      .then((res) => {
        if (cancel || !res.prices.length) return;
        saveBook({
          forMonth: plan.asOf,
          kind: plan.kind,
          fetchedAt: new Date().toISOString(),
          shownAsOf: res.prices[0]?.asOf || plan.asOf,
          prices: res.prices,
        });
      })
      .catch(() => {
        if (!cancel) setNote("The OLCC price list did not load. Try Refresh.");
      });
    return () => {
      cancel = true;
    };
  }, [oregon, olcc]);

  const zip = zipFromAddress(address);
  const prices = olcc?.prices ?? NO_PRICES;
  const catalog = useMemo(() => searchOlccPrices(prices, query), [prices, query]);
  const lines = buildSpiritOrderList({
    state,
    zip,
    prices,
    skus,
    recipes,
  });
  const order = spiritOrderWithAdditions(lines, added);

  if (!oregon) return null;

  const refresh = () => {
    const plan = olccRefreshPlan(new Date(), null);
    if (!plan.due) return;
    setNote("Reading the OLCC price list…");
    void refreshOlccPricesFn({ data: { asOf: plan.asOf } })
      .then((res) => {
        if (!res.prices.length) {
          setNote("The OLCC price list is empty for that month.");
          return;
        }
        saveBook({
          forMonth: plan.asOf,
          kind: plan.kind,
          fetchedAt: new Date().toISOString(),
          shownAsOf: res.prices[0]?.asOf || plan.asOf,
          prices: res.prices,
        });
        setNote("");
      })
      .catch(() => setNote("The OLCC price list did not load."));
  };

  const clearCheck = () => {
    setChecked(false);
    setStaying([]);
    setOffers([]);
  };

  const addRow = (row: OlccPrice) => {
    setAdded((prev) => addOlccRowToOrder(lines, prev, row, zip));
    clearCheck();
  };

  const houseStore = {
    storeNumber: houseSupplier?.olccStoreNumber ?? "",
    name: houseSupplier?.name || "House store",
    city: cityFromAddress(houseSupplier?.address ?? ""),
    address: houseSupplier?.address ?? "",
    phone: houseSupplier?.phone ?? "",
  };

  const finishOrder = () => {
    if (!houseStore.storeNumber) {
      setNote("Pick the house store first.");
      return;
    }
    if (!order.length) return;
    setNote("Checking the house store…");
    void checkOlccHouseStockFn({
      data: {
        houseStoreNumber: houseStore.storeNumber,
        lines: order.filter((line) => line.itemCode).map((line) => ({ itemCode: line.itemCode })),
      },
    })
      .then((res) => {
        const review = reviewOlccOrder({
          lines: order.map((line) => ({
            itemCode: line.itemCode,
            name: line.name,
            size: line.size,
            qty: line.qty,
            bottlePriceCents: line.bottlePriceCents,
            casePriceCents: line.casePriceCents,
          })),
          house: houseStore,
          byItem: res.byItem,
          directory: res.directory,
        });
        setStaying(review.staying);
        setOffers(review.offers);
        setChecked(true);
        setNote("");
      })
      .catch(() => setNote("The house store stock check did not load."));
  };

  const chooseStore = (itemCode: string) => {
    const offer = offers.find((row) => row.itemCode === itemCode);
    if (!offer) return;
    setStaying((prev) => keepOlccOffer(prev, offer));
    setOffers((prev) => dropOlccOffer(prev, itemCode));
  };

  const removeOffer = (itemCode: string) => {
    setOffers((prev) => dropOlccOffer(prev, itemCode));
  };

  const printList = () => {
    const html = olccPickListHtml(house, staying);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const month = olcc?.shownAsOf || olcc?.forMonth || "";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" data-olcc-spirits="">
      <h3 className="text-sm font-semibold">Oregon spirits</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Distilled spirits only. Beer and wine stay on the distributor path. No order is sent to the OLCC. The price
        list is the full current month. When the order is done, the house store is checked. Print the lines you
        kept, upload the store receipt, and confirm the lines that arrived.
      </p>
      {prices.length ? (
        <>
          <p className="mt-2 text-sm" data-olcc-book-count={prices.length}>
            {prices.length.toLocaleString()} items{month ? ` · ${month}` : ""}
          </p>
          <Input
            className="mt-2"
            value={query}
            placeholder="Name, item code, or size"
            data-olcc-search=""
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && !catalog.length ? (
            <p className="mt-2 text-xs text-muted-foreground">No items match that search.</p>
          ) : null}
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto" data-olcc-catalog="">
            {catalog.map((row) => (
              <li
                key={row.itemCode}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-2 py-2 text-sm"
                data-olcc-row={row.itemCode}
              >
                <span className="font-medium" data-olcc-name={row.name}>
                  {row.name}
                </span>
                <span data-olcc-size={row.size}>{row.size}</span>
                <span data-olcc-bottle={row.bottlePriceCents}>{formatCurrency(row.bottlePriceCents)} bottle</span>
                <span data-olcc-case={row.casePriceCents}>{formatCurrency(row.casePriceCents)} case</span>
                <Button type="button" size="sm" variant="outline" data-olcc-add={row.itemCode} onClick={() => addRow(row)}>
                  Add
                </Button>
                <a
                  className="text-xs underline"
                  href={oregonStoreSearchUrl(row, zip)}
                  target="_blank"
                  rel="noreferrer"
                  data-olcc-store-search={row.itemCode}
                >
                  Store search
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground" data-olcc-catalog-empty="">
          The monthly price list has not loaded.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" data-olcc-refresh="" onClick={refresh}>
          Refresh price list
        </Button>
        <Button type="button" size="sm" variant="outline" data-olcc-done="" onClick={finishOrder} disabled={!order.length}>
          Done
        </Button>
        <Button type="button" size="sm" variant="outline" data-olcc-print="" onClick={printList} disabled={!staying.length}>
          Print list
        </Button>
      </div>
      {note ? (
        <p className="mt-2 text-xs text-primary" data-olcc-note="">
          {note}
        </p>
      ) : null}
      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pick list</h4>
      {order.length ? (
        <ul className="mt-2 space-y-2 text-sm" data-olcc-order-list="">
          {order.map((line) => (
            <li
              key={`${line.source}-${line.itemCode}-${line.name}`}
              className="flex flex-wrap items-center gap-2"
              data-olcc-line={line.itemCode || line.name}
            >
              <span>
                {line.qty} × {line.name}
                {line.size ? ` · ${line.size}` : ""}
                {line.bottlePriceCents ? ` · ${formatCurrency(line.bottlePriceCents)} bottle` : ""}
              </span>
              <a
                className="text-xs underline"
                href={line.storeSearchUrl}
                target="_blank"
                rel="noreferrer"
                data-olcc-store-search={line.itemCode || line.name}
              >
                Store search
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No spirits are below par.</p>
      )}
      {checked ? (
        <div className="mt-3" data-olcc-stock="">
          {staying.length ? (
            <ul className="space-y-2 text-sm">
              {staying.map((line) => (
                <li key={`kept-${line.itemCode}`} data-olcc-kept={line.itemCode} data-olcc-kept-store={line.storeNumber}>
                  {line.qty} × {line.name}
                  {line.size ? ` · ${line.size}` : ""} · {line.storeName}
                  {line.storeCity ? `, ${line.storeCity}` : ""} has it
                </li>
              ))}
            </ul>
          ) : null}
          {offers.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {offers.map((offer) => (
                <li key={`offer-${offer.itemCode}`} className="rounded-xl border border-border px-2 py-2" data-olcc-offer={offer.itemCode}>
                  <span>
                    {offer.qty} × {offer.name}
                    {offer.size ? ` · ${offer.size}` : ""}
                  </span>
                  {offer.nearest ? (
                    <span className="mt-1 block text-xs" data-olcc-nearest={offer.nearest.storeNumber}>
                      {offer.nearest.name}
                      {offer.nearest.city ? `, ${offer.nearest.city}` : ""}
                      {offer.nearest.address ? ` · ${offer.nearest.address}` : ""}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-muted-foreground">No nearby store has this.</span>
                  )}
                  <span className="mt-1 flex flex-wrap gap-2">
                    {offer.nearest ? (
                      <Button type="button" size="sm" variant="outline" data-olcc-use-store={offer.itemCode} onClick={() => chooseStore(offer.itemCode)}>
                        Use this store
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" data-olcc-remove={offer.itemCode} onClick={() => removeOffer(offer.itemCode)}>
                      Remove
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function cityFromAddress(address: string): string {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : "";
}
