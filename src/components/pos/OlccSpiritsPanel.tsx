import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { refreshOlccPricesFn } from "@/lib/costs/api";
import {
  buildSpiritOrderList,
  isOregonState,
  matchOlccSpirit,
  olccRefreshPlan,
  zipFromAddress,
  type OlccBook,
} from "@/lib/costs/olcc";
import { useCostStore } from "@/lib/costs/store";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import { parseJurisdiction } from "@/lib/pos/jurisdiction";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";

function saveBook(book: OlccBook) {
  useCostStore.setState({ olcc: book });
  persistLocationCatalog("costs");
}

/**
 * Oregon spirits buy list. The links open Oregon Liquor Search.
 * Nothing here checks out or sends an order to the OLCC.
 */
export function OlccSpiritsPanel() {
  const state = usePosStore((s) => parseJurisdiction(s.settings.jurisdiction).state);
  const address = usePosStore((s) => s.settings.address);
  const olcc = useCostStore((s) => s.olcc);
  const skus = useCostStore((s) => s.skus);
  const recipes = useCostStore((s) => s.recipes);
  const house = usePosStore((s) => s.settings.name);
  const [note, setNote] = useState("");
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

  if (!oregon) return null;

  const zip = zipFromAddress(address);
  const prices = olcc?.prices ?? [];
  const titos = matchOlccSpirit("Tito's 750", prices);
  const lines = buildSpiritOrderList({
    state,
    zip,
    prices,
    skus,
    recipes,
  });

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

  const printList = () => {
    const rows = lines
      .map(
        (line) =>
          `<tr><td>${line.qty}</td><td>${line.name}</td><td>${line.size}</td><td>${line.itemCode}</td><td>${(line.bottlePriceCents / 100).toFixed(2)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><title>${house} spirits</title><body><h1>${house} spirits</h1><p>Buy these at the store. This list does not place an order.</p><table><tr><th>Qty</th><th>Item</th><th>Size</th><th>Code</th><th>Bottle</th></tr>${rows}</table></body>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" data-olcc-spirits="">
      <h3 className="text-sm font-semibold">Oregon spirits</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Distilled spirits only. Beer and wine stay on the distributor path. No order is sent to the OLCC. Print the
        pick list, upload the store receipt, and confirm the lines that arrived.
      </p>
      {titos ? (
        <p className="mt-2 text-sm" data-olcc-bottle={titos.itemCode}>
          Tito&apos;s 750 · {formatCurrency(titos.bottlePriceCents)} bottle · item {titos.itemCode}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Bottle prices appear after the monthly list loads.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" data-olcc-refresh="" onClick={refresh}>
          Refresh price list
        </Button>
        <Button type="button" size="sm" variant="outline" data-olcc-print="" onClick={printList} disabled={!lines.length}>
          Print list
        </Button>
      </div>
      {note ? <p className="mt-2 text-xs text-primary">{note}</p> : null}
      {lines.length ? (
        <ul className="mt-3 space-y-2 text-sm" data-olcc-order-list="">
          {lines.map((line) => (
            <li key={`${line.itemCode}-${line.name}`} className="flex flex-wrap items-center gap-2" data-olcc-line={line.itemCode || line.name}>
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
    </section>
  );
}
