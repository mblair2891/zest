import { useEffect, useMemo, useState } from "react";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCostStore } from "@/lib/costs/store";
import { canSeeEntity, costEntityScope } from "@/lib/costs/permissions";
import {
  accountBalance,
  actualQty,
  addLog,
  applyBankImport,
  approveAp,
  codeApLine,
  dailyPnl,
  draftSchedule,
  ingestEdiCsv,
  intradayLabor,
  markApPaid,
  menuEngineering,
  postApInvoice,
  postCount,
  postDeposit,
  emptyBook,
  postOccupancy,
  prepBatch,
  receivePurchaseOrder,
  rollupPnl,
  saveApInvoice,
  saveDraftSchedule,
  savePurchaseOrder,
  submitAp,
  theoreticalOunces,
  threeWayMatch,
  toggleTask,
  transferSku,
  upsertSku,
  upsertVendor,
  withAvtAlerts,
} from "@/lib/finance/engine";
import { postBooksForBusinessDate, businessDateNow } from "@/lib/finance/from-pos";
import { useFinanceStore } from "@/lib/finance/store";
import type { EntityBook, FinCategory } from "@/lib/finance/types";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";

type Screen =
  | "pnl"
  | "ledger"
  | "bank"
  | "ap"
  | "purchasing"
  | "inventory"
  | "avt"
  | "menu"
  | "labor"
  | "cash"
  | "logbook";

const SCREENS: Array<[Screen, string, string]> = [
  ["pnl", "Daily P&L", "ops-finance-pnl"],
  ["ledger", "Ledger", "ops-finance-ledger"],
  ["bank", "Bank rec", "ops-finance-bank"],
  ["ap", "AP", "ops-finance-ap"],
  ["purchasing", "Purchasing", "ops-finance-purchasing"],
  ["inventory", "Inventory", "ops-finance-inventory"],
  ["avt", "AvT", "ops-finance-avt"],
  ["menu", "Menu engineering", "ops-finance-menu"],
  ["labor", "Labor", "ops-finance-labor"],
  ["cash", "Cash drops", "ops-finance-cash"],
  ["logbook", "Logbook", "ops-finance-logbook"],
];

function cents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function glFor(category: FinCategory): string {
  if (category === "bev") return "1210";
  if (category === "food") return "1200";
  return "1220";
}

export function OpsFinancePanel() {
  const pos = usePosStore();
  const emp = pos.employees.find((row) => row.id === pos.currentEmployeeId) ?? null;
  const scope = costEntityScope(emp);
  const books = useFinanceStore((s) => s.byEntity);
  const live = useFinanceStore((s) => s.live) || pos.settings.lifecycleStatus === "live";
  const ensure = useFinanceStore((s) => s.ensure);
  const commit = useFinanceStore((s) => s.commit);
  const vendors = useMemo(
    () => pos.vendors.filter((vendor) => canSeeEntity(emp, vendor.id)),
    [pos.vendors, emp],
  );
  const [entityId, setEntityId] = useState(scope || vendors[0]?.id || "");
  const [rollup, setRollup] = useState(false);
  const [screen, setScreen] = useState<Screen>("pnl");
  const [note, setNote] = useState<string | null>(null);
  const date = businessDateNow();
  const actor = rollup ? null : entityId || null;
  const book = entityId ? books[entityId] ?? null : null;

  useEffect(() => {
    if (entityId || !vendors[0]) return;
    const next = scope || vendors[0].id;
    if (!next || next === entityId) return;
    setEntityId(next);
  }, [entityId, scope, vendors]);

  useEffect(() => {
    if (entityId) ensure(entityId, pos.tenantLocationId || "");
  }, [entityId, ensure, pos.tenantLocationId]);

  const visibleBooks = useMemo(() => {
    const ids = new Set<string>([...vendors.map((vendor) => vendor.id), ...Object.keys(books)]);
    return [...ids]
      .filter((id) => canSeeEntity(emp, id))
      .map((id) => books[id] ?? emptyBook(id, pos.tenantLocationId || ""))
      .filter((row) => (scope ? row.entityId === scope : true));
  }, [books, emp, pos.tenantLocationId, scope, vendors]);

  function save(next: EntityBook) {
    const result = commit(next.entityId, actor, next);
    setNote(result.ok ? "Saved on this entity’s books." : result.error || "Not saved.");
    if (result.ok) mirrorCost(next);
    return result.ok;
  }

  function run(fn: (current: EntityBook) => EntityBook) {
    if (!entityId || !actor) {
      setNote("Pick one selling entity. The rollup is view only.");
      return;
    }
    try {
      const current = books[entityId] ?? ensure(entityId, pos.tenantLocationId || "");
      save(fn(current));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not post.");
    }
  }

  const topic = SCREENS.find((row) => row[0] === screen)?.[2] ?? "ops-finance";
  const pnlRows = rollupPnl(visibleBooks, date, !live);

  return (
    <div className="space-y-3" data-ops-finance data-finance-screen={screen} data-finance-rollup={rollup ? "yes" : "no"}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Operations finance</h3>
        <GuideLearnLink topicId={topic} compact>
          Learn
        </GuideLearnLink>
        {!live && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-950" data-finance-sandbox>
            Training — journals stay in the sandbox until go-live
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Each selling entity keeps its own chart, inventory, vendors, and journals. A location rollup is view only.
        Summex does not run payroll. Hours and tips still export.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">
          Entity
          <select
            className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
            data-finance-entity
            value={entityId}
            onChange={(event) => {
              setEntityId(event.target.value);
              setRollup(false);
            }}
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.shortName || vendor.name}
              </option>
            ))}
            {!vendors.length && <option value="">No selling entity yet</option>}
          </select>
        </label>
        <Button type="button" size="sm" variant={rollup ? "default" : "outline"} onClick={() => setRollup((on) => !on)}>
          {rollup ? "Viewing rollup" : "Location rollup"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            try {
              postBooksForBusinessDate(date);
              setNote("Close journal posted for each entity on this location.");
            } catch (err) {
              setNote(err instanceof Error ? err.message : "Close did not post.");
            }
          }}
        >
          Post close
        </Button>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      {note && <p className="text-xs">{note}</p>}
      <div className="flex gap-1 overflow-x-auto">
        {SCREENS.map(([id, label]) => (
          <Button key={id} type="button" size="sm" variant={screen === id ? "default" : "outline"} className="shrink-0" onClick={() => setScreen(id)}>
            {label}
          </Button>
        ))}
      </div>
      {screen === "pnl" && (
        <PnlTable
          rows={rollup ? pnlRows.rows : book ? [dailyPnl(book, date, !live)] : []}
          total={rollup ? pnlRows.total : null}
        />
      )}
      {screen === "ledger" && book && <LedgerScreen book={book} />}
      {screen === "bank" && book && <BankScreen book={book} locked={!actor} onRun={run} />}
      {screen === "ap" && book && <ApScreen book={book} live={live} locked={!actor} onRun={run} />}
      {screen === "purchasing" && book && <PoScreen book={book} live={live} locked={!actor} onRun={run} />}
      {screen === "inventory" && book && <InventoryScreen book={book} live={live} locked={!actor} onRun={run} />}
      {screen === "avt" && book && <AvtScreen book={book} date={date} locked={!actor} onRun={run} />}
      {screen === "menu" && book && <MenuScreen book={book} date={date} />}
      {screen === "labor" && book && <LaborScreen book={book} date={date} locked={!actor} onRun={run} />}
      {screen === "cash" && book && <CashScreen book={book} live={live} locked={!actor} onRun={run} />}
      {screen === "logbook" && book && <LogScreen book={book} date={date} live={live} locked={!actor} onRun={run} />}
      {!book && screen !== "pnl" && <p className="text-sm text-muted-foreground">Choose a selling entity to open its books.</p>}
    </div>
  );
}

function mirrorCost(book: EntityBook) {
  const cost = useCostStore.getState();
  for (const sku of book.skus) {
    const category = sku.category === "bev" ? "liquor" : sku.category === "supplies" ? "supplies" : sku.category === "food" ? "food" : "other";
    cost.upsertSku({
      id: sku.id,
      name: sku.name,
      entityId: sku.entityId,
      unit: sku.unit,
      onHand: sku.onHand,
      costCents: sku.costCents,
      category,
    });
  }
}

function PnlTable({
  rows,
  total,
}: {
  rows: ReturnType<typeof dailyPnl>[];
  total: ReturnType<typeof dailyPnl> | null;
}) {
  const list = total ? [...rows, total] : rows;
  return (
    <div className="overflow-x-auto" data-finance-pnl>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th>Entity</th>
            <th>Food sales</th>
            <th>Food COGS</th>
            <th>Labor</th>
            <th>Prime</th>
            <th>Controllable</th>
            <th>Break-even</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.entityId} className="border-t border-border">
              <td className="py-1">{row.entityId === "rollup" ? "Rollup" : "Entity"}</td>
              <td>{formatCurrency(row.foodSalesCents)}</td>
              <td>{formatCurrency(row.foodCogsCents)}</td>
              <td>{formatCurrency(row.laborCents)}</td>
              <td>{row.primePct == null ? "—" : `${Math.round(row.primePct * 100)}%`}</td>
              <td>{formatCurrency(row.controllableProfitCents)}</td>
              <td>{row.breakEvenSalesCents == null ? "—" : formatCurrency(row.breakEvenSalesCents)}</td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td colSpan={7} className="py-2 text-muted-foreground">
                No journal for this day yet. Post close after service.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LedgerScreen({ book }: { book: EntityBook }) {
  return (
    <div className="space-y-2" data-finance-ledger>
      <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
        {book.accounts.map((account) => (
          <li key={account.code}>
            {account.code} {account.name}
          </li>
        ))}
      </ul>
      <ul className="space-y-1 text-xs">
        {book.journals.slice(0, 12).map((journal) => (
          <li key={journal.id} className="rounded-md border border-border px-2 py-1">
            {journal.businessDate} · {journal.memo}
            {journal.sandbox ? " · sandbox" : ""} · {journal.lines.length} lines
          </li>
        ))}
        {!book.journals.length && <li className="text-muted-foreground">No journals yet.</li>}
      </ul>
    </div>
  );
}

function BankScreen({
  book,
  locked,
  onRun,
}: {
  book: EntityBook;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [csv, setCsv] = useState("Date,Description,Amount\n");
  return (
    <div className="space-y-2" data-finance-bank>
      <textarea className="min-h-24 w-full rounded-md border border-border p-2 text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} />
      <Button type="button" size="sm" disabled={locked} onClick={() => onRun((current) => applyBankImport(current, csv))}>
        Import CSV
      </Button>
      <ul className="text-xs">
        {book.bankLines.map((line) => (
          <li key={line.id}>
            {line.date} {line.description} {formatCurrency(line.amountCents)} {line.matchedId ? "matched" : "open"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApScreen({
  book,
  live,
  locked,
  onRun,
}: {
  book: EntityBook;
  live: boolean;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [vendor, setVendor] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState<FinCategory>("food");
  const [number, setNumber] = useState("");
  return (
    <div className="space-y-2" data-finance-ap>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
        <Input placeholder="Invoice #" value={number} onChange={(event) => setNumber(event.target.value)} />
        <Input placeholder="Item" value={sku} onChange={(event) => setSku(event.target.value)} />
        <Input placeholder="Qty" value={qty} onChange={(event) => setQty(event.target.value)} className="w-20" />
        <Input placeholder="Unit cost" value={cost} onChange={(event) => setCost(event.target.value)} className="w-28" />
        <select className="rounded-md border border-border px-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value as FinCategory)}>
          <option value="food">Food</option>
          <option value="bev">Beverage</option>
          <option value="supplies">Supplies</option>
        </select>
        <Button
          type="button"
          size="sm"
          disabled={locked}
          onClick={() =>
            onRun((current) => {
              const withVendor = upsertVendor(current, vendor || "Vendor");
              const vendorId = withVendor.vendors[withVendor.vendors.length - 1]?.id;
              const skuId = sku.trim().toLowerCase().replace(/\s+/g, "_") || "item";
              const withSku = upsertSku(withVendor, {
                id: skuId,
                entityId: current.entityId,
                name: sku || "Item",
                unit: "oz",
                onHand: withVendor.skus.find((row) => row.id === skuId)?.onHand ?? 0,
                costCents: withVendor.skus.find((row) => row.id === skuId)?.costCents ?? cents(cost),
                category,
              });
              return saveApInvoice(withSku, {
                vendorId,
                number: number || `INV ${businessDateNow()}`,
                businessDate: businessDateNow(),
                lines: [{ skuId, qty: Number(qty) || 0, unitCostCents: cents(cost), category, glAccount: glFor(category) }],
              });
            })
          }
        >
          Save draft
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {book.invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-md border border-border px-2 py-1">
            <span>
              {invoice.number} · {invoice.status}
              {invoice.creditMemo ? " · credit memo" : ""} {invoice.priceAlerts.join(" ")}
            </span>
            <span className="ml-2 inline-flex gap-1">
              {invoice.status === "draft" || invoice.status === "coded" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() =>
                    onRun((current) => {
                      let next = current;
                      const row = next.invoices.find((item) => item.id === invoice.id);
                      if (!row) return next;
                      for (const line of row.lines) next = codeApLine(next, row.id, line.id, line.glAccount || glFor(line.category));
                      return submitAp(next, row.id);
                    })
                  }
                >
                  Submit
                </Button>
              ) : null}
              {invoice.status === "pending" && (
                <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => onRun((current) => approveAp(current, invoice.id))}>
                  Approve
                </Button>
              )}
              {invoice.status === "approved" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={locked}
                  onClick={() => onRun((current) => postApInvoice(current, invoice.id, { at: Date.now(), live }))}
                >
                  Post
                </Button>
              )}
              {invoice.status === "posted" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() => onRun((current) => markApPaid(current, invoice.id, { at: Date.now(), live, from: "bank" }))}
                >
                  Mark paid
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">AP {formatCurrency(accountBalance(book, "2000", { includeSandbox: !live }))}</p>
    </div>
  );
}

function PoScreen({
  book,
  live,
  locked,
  onRun,
}: {
  book: EntityBook;
  live: boolean;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [edi, setEdi] = useState("sku,qty,unit_cost\n");
  return (
    <div className="space-y-2" data-finance-purchasing>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="SKU id" value={sku} onChange={(event) => setSku(event.target.value)} />
        <Input placeholder="Qty" value={qty} onChange={(event) => setQty(event.target.value)} className="w-20" />
        <Input placeholder="Unit cost" value={cost} onChange={(event) => setCost(event.target.value)} className="w-28" />
        <Button
          type="button"
          size="sm"
          disabled={locked}
          onClick={() =>
            onRun((current) => {
              const vendorId = current.vendors[0]?.id;
              if (!vendorId) throw new Error("Add a vendor on AP first");
              return savePurchaseOrder(current, {
                vendorId,
                businessDate: businessDateNow(),
                lines: [{ skuId: sku, qty: Number(qty) || 0, unitCostCents: cents(cost) }],
              });
            })
          }
        >
          Save PO
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {book.purchaseOrders.map((po) => {
          const receipt = book.receipts.find((row) => row.poId === po.id);
          const invoice = book.invoices.find((row) => row.poId === po.id);
          const match = threeWayMatch(po, receipt, invoice);
          return (
            <li key={po.id} className="rounded-md border border-border px-2 py-1">
              {po.id} · {po.status} · {match.status}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-2"
                disabled={locked}
                onClick={() =>
                  onRun((current) =>
                    receivePurchaseOrder(
                      current,
                      po.id,
                      po.lines.map((line) => ({ skuId: line.skuId, qty: line.qty })),
                      businessDateNow(),
                      { at: Date.now(), live },
                    ),
                  )
                }
              >
                Receive
              </Button>
            </li>
          );
        })}
      </ul>
      <textarea className="min-h-16 w-full rounded-md border border-border p-2 text-xs" value={edi} onChange={(event) => setEdi(event.target.value)} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={locked}
        onClick={() =>
          onRun((current) => {
            const vendorId = current.vendors[0]?.id;
            if (!vendorId) throw new Error("Add a vendor on AP first");
            return ingestEdiCsv(current, vendorId, businessDateNow(), edi);
          })
        }
      >
        Read EDI CSV
      </Button>
    </div>
  );
}

function InventoryScreen({
  book,
  live,
  locked,
  onRun,
}: {
  book: EntityBook;
  live: boolean;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [yieldQty, setYieldQty] = useState("1");
  return (
    <div className="space-y-2" data-finance-inventory>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="SKU id" value={sku} onChange={(event) => setSku(event.target.value)} />
        <Input placeholder="Qty" value={qty} onChange={(event) => setQty(event.target.value)} className="w-24" />
        <Button type="button" size="sm" disabled={locked} onClick={() => onRun((current) => postCount(current, { skuId: sku, qty: Number(qty) || 0, businessDate: businessDateNow(), at: Date.now(), live }))}>
          Post count
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked}
          onClick={() =>
            onRun((current) =>
              prepBatch(current, {
                components: [{ skuId: sku, qty: Number(qty) || 0 }],
                finishedSkuId: sku,
                yieldQty: Number(yieldQty) || 1,
                businessDate: businessDateNow(),
              }),
            )
          }
        >
          Prep batch
        </Button>
        <Input placeholder="Yield" value={yieldQty} onChange={(event) => setYieldQty(event.target.value)} className="w-20" />
      </div>
      <ul className="text-xs">
        {book.skus.map((row) => (
          <li key={row.id}>
            {row.name} · on hand {row.onHand} {row.unit} · {formatCurrency(row.costCents)}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-2"
              disabled={locked}
              onClick={() => onRun((current) => transferSku(current, { skuId: row.id, qty: 1, counterpartyId: "peer", businessDate: businessDateNow() }))}
            >
              Transfer 1 out
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvtScreen({
  book,
  date,
  locked,
  onRun,
}: {
  book: EntityBook;
  date: string;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const theo = theoreticalOunces(book, date);
  return (
    <div className="space-y-2" data-finance-avt>
      <Button type="button" size="sm" disabled={locked} onClick={() => onRun((current) => withAvtAlerts(current, date))}>
        Refresh AvT
      </Button>
      <ul className="text-xs">
        {book.skus.map((sku) => (
          <li key={sku.id}>
            {sku.name}: theoretical {(theo[sku.id] ?? 0).toFixed(2)} · actual {actualQty(book, sku.id, date).toFixed(2)}
          </li>
        ))}
        {book.alerts.map((alert) => (
          <li key={alert.id}>{alert.summary}</li>
        ))}
      </ul>
    </div>
  );
}

function MenuScreen({ book, date }: { book: EntityBook; date: string }) {
  const rows = menuEngineering(book, date);
  return (
    <ul className="text-xs" data-finance-menu>
      {rows.map((row) => (
        <li key={row.menuItemId}>
          {row.name} · {row.class} · cash margin {formatCurrency(row.cashMarginCents)} · card margin {formatCurrency(row.cardMarginCents)} · popularity {Math.round(row.popularity * 100)}%
        </li>
      ))}
      {!rows.length && <li className="text-muted-foreground">Sell items that have a recipe. Margin uses recipe cost against the cash and card price.</li>}
    </ul>
  );
}

function LaborScreen({
  book,
  date,
  locked,
  onRun,
}: {
  book: EntityBook;
  date: string;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [wage, setWage] = useState(book.accrualWageCents ? (book.accrualWageCents / 100).toFixed(2) : "");
  const [sales, setSales] = useState("");
  const drafts = draftSchedule({ ...book, history: sales ? [...book.history, { businessDate: date, salesCents: cents(sales) }] : book.history }, date);
  const pulse = intradayLabor({
    salesCents: cents(sales) || 0,
    laborCents: accountBalance(book, "6000", { businessDate: date, includeSandbox: true }),
    targetPct: 0.25,
  });
  return (
    <div className="space-y-2 text-xs" data-finance-labor>
      <p>Approved punches export to ADP, Intuit, or a generic CSV (Gusto uses that file). This screen only accrues wages. It does not pay anyone.</p>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Accrual $/hour" value={wage} onChange={(event) => setWage(event.target.value)} className="w-32" />
        <Button type="button" size="sm" disabled={locked} onClick={() => onRun((current) => ({ ...current, accrualWageCents: cents(wage) }))}>
          Save rate
        </Button>
        <Input placeholder="Today’s sales $" value={sales} onChange={(event) => setSales(event.target.value)} className="w-32" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked}
          onClick={() =>
            onRun((current) => {
              const history = sales
                ? [...current.history.filter((row) => row.businessDate !== date), { businessDate: date, salesCents: cents(sales) }]
                : current.history;
              return saveDraftSchedule({ ...current, history }, date);
            })
          }
        >
          Draft schedule
        </Button>
      </div>
      <p>
        Intraday labor {pulse.laborPct == null ? "—" : `${Math.round(pulse.laborPct * 100)}%`} · {pulse.rec.replaceAll("_", " ")}
      </p>
      <ul>
        {(book.drafts.length ? book.drafts : drafts).map((row) => (
          <li key={`${row.role}-${row.businessDate}`}>
            {row.role} · {row.heads} · {row.start}–{row.end} · draft
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">Early, late, and overtime rules stay on Labor. Cut and add recs on the floor stay as they are. The labor matrix on this book turns a sales band into heads by role.</p>
    </div>
  );
}

function CashScreen({
  book,
  live,
  locked,
  onRun,
}: {
  book: EntityBook;
  live: boolean;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [amount, setAmount] = useState("");
  return (
    <div className="space-y-2" data-finance-cash>
      <p className="text-xs">Cash on hand {formatCurrency(accountBalance(book, "1000", { includeSandbox: !live }))}</p>
      <div className="flex gap-2">
        <Input placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-28" />
        <Button type="button" size="sm" disabled={locked} onClick={() => onRun((current) => postDeposit(current, { kind: "safe_drop", cents: cents(amount), businessDate: businessDateNow(), at: Date.now(), live }))}>
          Safe drop
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => onRun((current) => postDeposit(current, { kind: "bank_deposit", cents: cents(amount), businessDate: businessDateNow(), at: Date.now(), live }))}>
          Bank deposit
        </Button>
      </div>
      <ul className="text-xs">
        {book.deposits.map((row) => (
          <li key={row.id}>
            {row.businessDate} · {row.kind} · {formatCurrency(row.cents)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogScreen({
  book,
  date,
  live,
  locked,
  onRun,
}: {
  book: EntityBook;
  date: string;
  live: boolean;
  locked: boolean;
  onRun: (fn: (book: EntityBook) => EntityBook) => void;
}) {
  const [text, setText] = useState("");
  const [rent, setRent] = useState("");
  return (
    <div className="space-y-2" data-finance-logbook>
      <ul className="text-xs">
        {book.tasks.map((task) => (
          <li key={task.id}>
            <label>
              <input
                type="checkbox"
                className="mr-2"
                checked={task.done}
                disabled={locked}
                onChange={(event) => onRun((current) => toggleTask(current, task.id, event.target.checked))}
              />
              {task.phase === "open" ? "Open" : "Close"} · {task.label}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Manager note" value={text} onChange={(event) => setText(event.target.value)} />
        <Button type="button" size="sm" disabled={locked || !text.trim()} onClick={() => onRun((current) => addLog(current, text, date))}>
          Add note
        </Button>
      </div>
      <ul className="text-xs">
        {book.logbook.map((row) => (
          <li key={row.id}>
            {row.businessDate}: {row.text}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Occupancy $" value={rent} onChange={(event) => setRent(event.target.value)} className="w-32" />
        <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => onRun((current) => postOccupancy(current, { cents: cents(rent), businessDate: date, at: Date.now(), live }))}>
          Accrue occupancy
        </Button>
      </div>
    </div>
  );
}
