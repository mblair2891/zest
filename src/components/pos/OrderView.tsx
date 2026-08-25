import { useMemo, useState } from "react";
import {
  Pause,
  Printer,
  Send,
  Trash2,
  CreditCard,
  Percent,
  ChevronLeft,
  StickyNote,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import type { MenuItem } from "@/lib/pos/types";
import {
  computeDualTotals,
  computeTotals,
  isHappyHour,
  lineCashCents,
  linePrintedCents,
  printedItemPriceCents,
} from "@/lib/pos/calculations";
import { cashPolicyFromSettings } from "@/lib/pos/cash-discount";
import { cn, formatCurrency } from "@/lib/utils";
import { ModifierDialog } from "./ModifierDialog";
import { PaymentDialog } from "./PaymentDialog";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { QrMark } from "./QrMark";
import { tableGuestUrl } from "@/lib/pos/qr-table";
import { getDemoType } from "@/lib/demo/session";
import { RecipeLookupButton } from "@/components/recipes/RecipeLookup";

export function OrderView() {
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const orders = usePosStore((s) => s.orders);
  const order = orders.find((o) => o.id === activeOrderId) ?? null;
  const categories = usePosStore((s) => s.categories);
  const menuItems = usePosStore((s) => s.menuItems);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const selectedCategoryId = usePosStore((s) => s.selectedCategoryId);
  const setCategory = usePosStore((s) => s.setCategory);
  const selectedLineId = usePosStore((s) => s.selectedLineId);
  const setSelectedLine = usePosStore((s) => s.setSelectedLine);
  const activeSeat = usePosStore((s) => s.activeSeat);
  const setActiveSeat = usePosStore((s) => s.setActiveSeat);
  const voidLine = usePosStore((s) => s.voidLine);
  const compLine = usePosStore((s) => s.compLine);
  const holdLine = usePosStore((s) => s.holdLine);
  const sendOrder = usePosStore((s) => s.sendOrder);
  const printCheck = usePosStore((s) => s.printCheck);
  const applyDiscount = usePosStore((s) => s.applyDiscount);
  const setOrderNote = usePosStore((s) => s.setOrderNote);
  const setView = usePosStore((s) => s.setView);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const addItem = usePosStore((s) => s.addItem);
  const tableAccess = usePosStore((s) => s.tableAccess);

  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [modOpen, setModOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrAction, setMgrAction] = useState<
    null | "void" | "comp" | "discount"
  >(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discPct, setDiscPct] = useState("10");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [payQrOpen, setPayQrOpen] = useState(false);

  const happy = isHappyHour(settings);
  const table = tables.find((t) => t.id === order?.tableId);
  const dual = order ? computeDualTotals(order, settings) : null;
  const totals = dual?.card ?? null;
  const cashPolicy = cashPolicyFromSettings(settings);
  const orderAccess = table ? tableAccess(table.id, "order") : { ok: true };
  const orderLocked = !orderAccess.ok || !!orderAccess.viewOnly;

  const pickVendor = (id: string | null) => {
    setVendorFilter(id);
    setCategory(null);
    setSearch("");
  };

  const items = useMemo(() => {
    let list = menuItems;
    if (vendorFilter) list = list.filter((m) => m.vendorId === vendorFilter);
    if (selectedCategoryId)
      list = list.filter((m) => m.categoryId === selectedCategoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems, selectedCategoryId, search, vendorFilter]);

  const openOrders = orders.filter((o) => o.status === "open");

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">No active order</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Seat a table from the floor plan, open a bar tab, or select an open
          check below.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => setView("floor")}>Floor plan</Button>
          <Button variant="outline" onClick={() => setView("takeout")}>
            Takeout
          </Button>
        </div>
        {openOrders.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Open checks
            </p>
            {openOrders.map((o) => {
              const tot = computeTotals(o, settings);
              const t = tables.find((x) => x.id === o.tableId);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveOrder(o.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-border-strong"
                >
                  <span>
                    #{o.number} {t ? `T${t.label}` : o.tabName ?? o.type}
                  </span>
                  <span className="tabular">
                    {formatCurrency(tot.balanceCents || tot.totalCents)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const guestSeats = Math.max(order.guestCount, 1);
  const unsent = order.lines.some((l) => !l.sent && !l.voided);

  const onMenuClick = (item: MenuItem) => {
    if (!item.available) return;
    if (orderLocked) return;
    const groups = usePosStore
      .getState()
      .modifierGroups.filter((g) => item.modifierGroupIds.includes(g.id));
    const needsMods = groups.some((g) => g.required);
    if (needsMods) {
      setModItem(item);
      setModOpen(true);
      return;
    }
    addItem(item.id);
  };

  const runMgr = () => {
    if (mgrAction === "discount") {
      setDiscountOpen(true);
      setMgrAction(null);
      return;
    }
    if (!selectedLineId) return;
    if (mgrAction === "void") voidLine(selectedLineId, "Manager void");
    if (mgrAction === "comp") compLine(selectedLineId, "Manager comp");
    setMgrAction(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-border bg-surface lg:max-h-none lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-[26rem]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setView("floor")}
            aria-label="Back to floor"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              #{order.number}{" "}
              {table
                ? `Table ${table.label}`
                : order.tabName ?? order.type.replace("_", " ")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {order.serverName} · {order.guestCount} guests
              {happy && (
                <Badge variant="warn" className="ml-2">
                  Happy hour
                </Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
          <Button
            size="sm"
            variant={activeSeat === null ? "default" : "outline"}
            onClick={() => setActiveSeat(null)}
          >
            Shared
          </Button>
          {Array.from({ length: guestSeats }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              size="sm"
              variant={activeSeat === n ? "default" : "outline"}
              onClick={() => setActiveSeat(n)}
              className="tabular"
            >
              S{n}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {order.lines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tap menu items · mix vendors on one check · one payment
            </p>
          )}
          <ul className="space-y-1">
            {order.lines.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => setSelectedLine(line.id)}
                  className={cn(
                    "w-full rounded-xl border px-2.5 py-2 text-left text-sm transition",
                    selectedLineId === line.id
                      ? "border-primary bg-surface-2"
                      : "border-transparent hover:bg-surface-2/60",
                    line.voided && "opacity-40 line-through",
                    line.comped && "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <span className="font-medium">
                        {line.quantity}× {line.name}
                        {line.vendorName && (
                          <span className="ml-1 rounded bg-surface-2 px-1 text-[10px] font-normal text-muted-foreground">
                            {line.vendorName}
                          </span>
                        )}
                      </span>
                      {line.modifiers.length > 0 && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {line.modifiers.map((m) => m.optionName).join(", ")}
                        </span>
                      )}
                      {line.note && (
                        <span className="mt-0.5 block text-[11px] text-warn">
                          {line.note}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {line.sent ? "Sent → vendor" : "On check"}
                        {line.held ? " · fire later" : ""}
                        {line.seat ? ` · seat ${line.seat}` : ""}
                        {line.comped ? " · COMP" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular text-sm">
                      <span className="block">
                        {formatCurrency(linePrintedCents(line))}
                      </span>
                      {cashPolicy && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          Cash {formatCurrency(lineCashCents(line, cashPolicy))}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {totals && (
          <div className="space-y-1 border-t border-border px-3 py-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular">
                {formatCurrency(totals.subtotalCents)}
              </span>
            </div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span className="tabular">
                  −{formatCurrency(totals.discountCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular">{formatCurrency(totals.taxCents)}</span>
            </div>
            {totals.serviceChargeCents > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{settings.serviceChargeLabel}</span>
                <span className="tabular">
                  {formatCurrency(totals.serviceChargeCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>{dual?.enabled ? "Card" : "Total"}</span>
              <span className="tabular">
                {formatCurrency(totals.totalCents)}
              </span>
            </div>
            {dual?.enabled && (
              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Cash</span>
                <span className="tabular">
                  {formatCurrency(dual.cash.totalCents)}
                </span>
              </div>
            )}
            {totals.balanceCents < totals.totalCents && (
              <div className="flex justify-between text-muted-foreground">
                <span>Balance</span>
                <span className="tabular">
                  {formatCurrency(totals.balanceCents)}
                </span>
              </div>
            )}
          </div>
        )}

        {selectedLineId &&
          order.lines.find((l) => l.id === selectedLineId)?.menuItemId && (
            <div className="border-t border-border px-2 pt-2">
              <RecipeLookupButton
                menuItemId={
                  order.lines.find((l) => l.id === selectedLineId)!.menuItemId
                }
                large
              />
            </div>
          )}

        <div className="grid grid-cols-4 gap-1 border-t border-border p-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedLineId}
            onClick={() => {
              setMgrAction("void");
              setMgrOpen(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Void
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedLineId}
            onClick={() => {
              setMgrAction("comp");
              setMgrOpen(true);
            }}
          >
            <Gift className="h-3.5 w-3.5" />
            Comp
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedLineId}
            onClick={() =>
              selectedLineId &&
              holdLine(
                selectedLineId,
                !order.lines.find((l) => l.id === selectedLineId)?.held,
              )
            }
          >
            <Pause className="h-3.5 w-3.5" />
            Hold
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMgrAction("discount");
              setMgrOpen(true);
            }}
          >
            <Percent className="h-3.5 w-3.5" />
            Disc
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 border-t border-border p-2">
          <Button
            variant="outline"
            onClick={() => {
              setNoteDraft(order.note ?? "");
              setNoteOpen(true);
            }}
          >
            <StickyNote className="h-4 w-4" />
            Note
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              printCheck();
              if (table) setPayQrOpen(true);
            }}
          >
            <Printer className="h-4 w-4" />
            Check
          </Button>
          <Button disabled={!unsent} onClick={() => sendOrder()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
          <Button
            className="col-span-3"
            size="lg"
            disabled={
              order.status !== "open" || !totals || totals.itemCount === 0
            }
            onClick={() => setPayOpen(true)}
          >
            <CreditCard className="h-4 w-4" />
            Pay{" "}
            {totals
              ? formatCurrency(totals.balanceCents || totals.totalCents)
              : ""}
            {dual?.enabled
              ? ` · cash ${formatCurrency(dual.cash.balanceCents || dual.cash.totalCents)}`
              : ""}
          </Button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        {orderLocked && table && (
          <div className="border-b border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn-foreground">
            View only — {table.label} is in {table.section}, not your section.
            A manager can grant this table for the shift or this seating.
          </div>
        )}
        <div className="flex flex-col gap-2 border-b border-border p-2">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={vendorFilter === null ? "default" : "outline"}
              onClick={() => pickVendor(null)}
            >
              All operators
            </Button>
            {vendors
              .filter((v) => v.active)
              .map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={vendorFilter === v.id ? "default" : "outline"}
                  onClick={() => pickVendor(v.id)}
                  className="shrink-0"
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ background: v.color }}
                  />
                  {v.shortName}
                </Button>
              ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 sm:max-w-xs"
            />
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              <Button
                size="sm"
                variant={!selectedCategoryId && !search ? "default" : "outline"}
                onClick={() => {
                  setCategory(null);
                  setSearch("");
                }}
              >
                All
              </Button>
              {categories
                .slice()
                .sort((a, b) => a.sort - b.sort)
                .map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={
                      selectedCategoryId === c.id && !search
                        ? "default"
                        : "outline"
                    }
                    onClick={() => {
                      setCategory(c.id);
                      setSearch("");
                    }}
                    className="shrink-0"
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </Button>
                ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {menuItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-5 text-center">
                <p className="text-sm font-semibold">No menu yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open Menu to add categories and items. Nothing was seeded.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setView("menu")}>
                  Go to menu
                </Button>
              </div>
            )}
            {items.map((item) => {
              const vendor = vendors.find((v) => v.id === item.vendorId);
              const printed =
                happy && item.happyHourPriceCents != null
                  ? item.happyHourPriceCents
                  : item.priceCents;
              const dualPrice = printedItemPriceCents(printed, settings);
              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    disabled={!item.available}
                    onClick={() => onMenuClick(item)}
                    className={cn(
                      "flex min-h-[5.5rem] w-full flex-col rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-border-strong active:scale-[0.98]",
                      !item.available && "opacity-40",
                    )}
                  >
                    <span className="text-sm font-medium leading-snug">
                      {item.name}
                    </span>
                    <span className="mt-auto flex items-end justify-between pt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {vendor?.shortName ?? "—"}
                        {!item.available ? " · 86" : ""}
                      </span>
                      <span className="text-right tabular text-sm font-semibold">
                        <span className="block">{formatCurrency(dualPrice.card)}</span>
                        {dualPrice.enabled && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            Cash {formatCurrency(dualPrice.cash)}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="absolute right-1 top-1">
                    <RecipeLookupButton menuItemId={item.id} icon />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ModifierDialog
        open={modOpen}
        onOpenChange={setModOpen}
        item={modItem}
      />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        onVerified={runMgr}
      />
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply discount</DialogTitle>
          </DialogHeader>
          <Input
            value={discPct}
            onChange={(e) => setDiscPct(e.target.value)}
            placeholder="Percent"
            inputMode="decimal"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                applyDiscount({
                  percent: parseFloat(discPct) || 0,
                  reason: "Manager discount",
                });
                setDiscountOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order note</DialogTitle>
          </DialogHeader>
          <Input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Allergy, celebration…"
          />
          <DialogFooter>
            <Button
              onClick={() => {
                setOrderNote(noteDraft);
                setNoteOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={payQrOpen} onOpenChange={setPayQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay QR on the check</DialogTitle>
          </DialogHeader>
          {table ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Guest scans to pay this table with Quantum Payments. Print sits
                with the ticket; the QR is bound to table {table.label}.
              </p>
              <QrMark
                value={tableGuestUrl(table, { pay: true, demoType: getDemoType() })}
                caption={`Table ${table.label} · pay`}
              />
              <a
                className="block text-sm underline"
                href={tableGuestUrl(table, {
                  pay: true,
                  demoType: getDemoType(),
                })}
              >
                Open pay sandbox
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No table on this check — pay at the register.
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setPayQrOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
