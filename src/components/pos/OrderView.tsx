import { useEffect, useMemo, useState } from "react";
import { useStationLayout } from "@/lib/ui/station-layout";
import { FloorView } from "./FloorView";
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
import { OrderClockBanner } from "./OrderClockBanner";
import { TicketStripLines } from "./TicketStrip";
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
import { toast } from "sonner";
import { usePosStore } from "@/lib/pos/store";
import type { MenuItem } from "@/lib/pos/types";
import {
  computeDualTotals,
  computeTotals,
  isHappyHour,
  printedItemPriceCents,
} from "@/lib/pos/calculations";
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
import { needsOpenAmount } from "@/lib/pos/open-items";
import { OpenAmountDialog } from "./OpenAmountDialog";
import { WellSpiritDialog } from "./WellSpiritDialog";
import { cn, formatCurrency } from "@/lib/utils";
import { ModifierDialog } from "./ModifierDialog";
import { PaymentDialog } from "./PaymentDialog";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { QrMark } from "./QrMark";
import { tableGuestUrl, ticketGuestUrl } from "@/lib/pos/qr-table";
import { parseQrPolicy } from "@/lib/pos/qr-policy";
import { getDemoType } from "@/lib/demo/session";
import { RecipeLookupButton } from "@/components/recipes/RecipeLookup";
import { CheckOpsDialog } from "./CheckOpsDialog";
import { Split } from "lucide-react";
import { canEmployee } from "@/lib/access/permissions";

import {
  DISCOUNT_REASONS,
  REOPEN_REASONS,
  TENDER_SWAP_REASONS,
  compReasonsFor,
  discountNeedsManager,
  isLateWindowComp,
  parseLossPrevention,
  voidReasonsFor,
} from "@/lib/pos/loss-prevention";
import {
  canDeleteCheck,
  canRemoveLine,
  canVoidOrCompCheck,
  canVoidOrCompLine,
} from "@/lib/pos/check-actions";
import {
  deviceRoleFromSessionMode,
  parseStationQuery,
} from "@/lib/pos/device-roles";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { stationHomeSurface } from "@/lib/pos/station-home";
import { locationAllowsBarTabs } from "@/lib/pos/bar-tab";
import { stationCan } from "@/lib/pos/station-pin-gate";
import { DriveThroughView } from "./DriveThroughView";
import {
  ADD_RECEIPT_PRINTER,
  currentStationDeviceId,
  stationHasBoundReceiptPrinter,
  stationMayPrintReceipt,
} from "@/lib/print/receipt-printer";
import { NoSaleControl } from "./NoSaleControl";

export function OrderView({
  busyNight = false,
  onSent,
  onNeedFloor,
}: {
  busyNight?: boolean;
  onSent?: () => void;
  onNeedFloor?: () => void;
} = {}) {
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const orders = usePosStore((s) => s.orders);
  const order = orders.find((o) => o.id === activeOrderId) ?? null;
  const categories = usePosStore((s) => s.categories);
  const menuItems = usePosStore((s) => s.menuItems);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const floorSections = usePosStore((s) => s.floorSections);
  const selectedCategoryId = usePosStore((s) => s.selectedCategoryId);
  const setCategory = usePosStore((s) => s.setCategory);
  const selectedLineId = usePosStore((s) => s.selectedLineId);
  const setSelectedLine = usePosStore((s) => s.setSelectedLine);
  const activeSeat = usePosStore((s) => s.activeSeat);
  const setActiveSeat = usePosStore((s) => s.setActiveSeat);
  const voidLine = usePosStore((s) => s.voidLine);
  const compLine = usePosStore((s) => s.compLine);
  const voidCheck = usePosStore((s) => s.voidCheck);
  const compCheck = usePosStore((s) => s.compCheck);
  const removeUnsentLine = usePosStore((s) => s.removeUnsentLine);
  const deleteUnsentCheck = usePosStore((s) => s.deleteUnsentCheck);
  const holdLine = usePosStore((s) => s.holdLine);
  const sendOrder = usePosStore((s) => s.sendOrder);
  const printCheck = usePosStore((s) => s.printCheck);
  const applyDiscount = usePosStore((s) => s.applyDiscount);
  const setOrderNote = usePosStore((s) => s.setOrderNote);
  const setView = usePosStore((s) => s.setView);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const addItem = usePosStore((s) => s.addItem);
  const tableAccess = usePosStore((s) => s.tableAccess);
  const floorIntent = usePosStore((s) => s.floorIntent);

  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [modOpen, setModOpen] = useState(false);
  const [openPriceItem, setOpenPriceItem] = useState<MenuItem | null>(null);
  const [openPriceError, setOpenPriceError] = useState<string | null>(null);
  const [modPriceCents, setModPriceCents] = useState<number | null>(null);
  const [wellSpirit, setWellSpirit] = useState<{ spiritId: string; entityId: string; name: string } | null>(null);
  const [wellBottle, setWellBottle] = useState<WellLevelRow | null>(null);
  const [wellPour, setWellPour] = useState<WellPour | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  useEffect(() => {
    void import("@/lib/pos/station-busy").then((m) => m.setStationPayOpen(payOpen));
    if (!payOpen) {
      void import("@/lib/pos/station-refresh").then((m) => m.tickStationUpdatePrompt());
    }
    return () => {
      void import("@/lib/pos/station-busy").then((m) => m.setStationPayOpen(false));
    };
  }, [payOpen]);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrScope, setMgrScope] = useState<"line" | "check">("line");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mgrAction, setMgrAction] = useState<
    null | "void" | "comp" | "discount" | "reopen" | "tender_swap"
  >(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const reopenCheck = usePosStore((s) => s.reopenCheck);
  const swapTender = usePosStore((s) => s.swapTender);
  const tickets = usePosStore((s) => s.tickets);
  const canAuthorizeGate = usePosStore((s) => s.canAuthorizeGate);
  const requestApproval = usePosStore((s) => s.requestApproval);
  const managerAuthKind = usePosStore((s) => s.managerAuthKind);
  const lineUnit = (lineId: string) => {
    const line = order?.lines.find((l) => l.id === lineId);
    if (!line) return 0;
    return (line.unitPriceCents + line.modifiers.reduce((s, m) => s + m.priceCents, 0)) * line.quantity;
  };
  const [discPct, setDiscPct] = useState("10");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [search, setSearch] = useState("");
  const demoScope = usePosStore((s) =>
    s.settings.isDemo || s.settings.demoIsolated ? s.demoOperatingEntityId : null,
  );
  const [vendorFilter, setVendorFilter] = useState<string | null>(demoScope);
  useEffect(() => {
    if (demoScope) setVendorFilter(demoScope);
  }, [demoScope]);
  useEffect(() => {
    if (!busyNight || selectedCategoryId) return;
    const first = orderPadCategories(categories, menuItems, vendorFilter)[0];
    if (first) setCategory(first.id);
  }, [busyNight, selectedCategoryId, categories, menuItems, vendorFilter, setCategory]);
  const [payQrOpen, setPayQrOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const layout = useStationLayout();
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const locationDevices = usePosStore((s) => s.locationDevices);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const stationId = activeDeviceId || currentStationDeviceId();
  const happy = isHappyHour(settings);
  const table = tables.find((t) => t.id === order?.tableId);
  const receiptCheck = {
    table,
    tables,
    tableId: order?.tableId,
    sections: floorSections,
    orderType: order?.type,
  };
  const hasBoundReceipt = stationHasBoundReceiptPrinter(locationDevices, stationId, receiptCheck);
  const mayPrintReceipt = stationMayPrintReceipt(locationDevices, stationId, receiptCheck);
  const mayPrintCheck = hasBoundReceipt && mayPrintReceipt;
  const dual = order ? computeDualTotals(order, settings) : null;
  const totals = dual?.card ?? null;
  const orderAccess = table ? tableAccess(table.id, "order") : { ok: true };
  const orderLocked = !orderAccess.ok || !!orderAccess.viewOnly;

  const pickVendor = (id: string | null) => {
    setVendorFilter(id);
    setCategory(null);
    setSearch("");
  };

  const tiles = useMemo(
    () =>
      orderPadTiles({
        items: menuItems,
        vendors,
        vendorFilter,
        categoryId: selectedCategoryId,
        search,
      }),
    [menuItems, vendors, vendorFilter, selectedCategoryId, search],
  );
  const wellBook = wellSpirit
    ? vendors.find((vendor) => vendor.id === wellSpirit.entityId)?.wellBook
    : undefined;
  const wellMixers = wellBook ? visibleWellMixers(wellBook) : [];
  const wellLevels = wellSpirit && wellBook ? spiritLevelRows(wellBook, wellSpirit.spiritId) : [];
  const closeWell = () => {
    setWellSpirit(null);
    setWellBottle(null);
    setWellPour(null);
  };
  const openWellSpirit = (spirit: { spiritId: string; entityId: string; name: string }) => {
    setWellSpirit(spirit);
    setWellBottle(null);
    setWellPour(null);
  };
  const chooseWellMixer = (mixerId: string) => {
    if (!wellSpirit || !wellPour || !wellBottle) return;
    const drink = findWellDrink(menuItems, {
      entityId: wellSpirit.entityId,
      spiritId: wellSpirit.spiritId,
      mixerId,
      pour: wellPour,
    });
    if (drink) {
      addItem(drink.id, {
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
    }
    closeWell();
  };
  const wellPopup = (
    <WellSpiritDialog
      spiritName={wellSpirit?.name ?? null}
      spiritId={wellSpirit?.spiritId ?? null}
      levels={wellLevels}
      bottle={wellBottle}
      pour={wellPour}
      mixers={wellMixers}
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
      onClose={closeWell}
    />
  );

  const openOrders = orders.filter((o) => o.status === "open");

  if (busyNight && !order) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-busy-menu>
        <OrderClockBanner />
        <div className="grid flex-1 place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-lg font-semibold">No check yet</p>
          <p className="text-sm text-muted-foreground">Seat a table on the floor, then add the first item.</p>
          <Button className="station-touch h-16 px-8 text-lg" onClick={() => onNeedFloor?.()}>
            Floor
          </Button>
        </div>
        </div>
      </div>
    );
  }

  if (!order && floorIntent === "bar_tab") {
    return <FloorView />;
  }

  const stationRole = (() => {
    try {
      const q = parseStationQuery(new URLSearchParams(window.location.search).get("station"));
      if (q) return q;
      return deviceRoleFromSessionMode(useStationSessionStore.getState().assignment.kind);
    } catch {
      return null;
    }
  })();
  const homeSurface = stationHomeSurface({
    deviceRole: stationRole ?? "order",
    employeeRole: emp?.role,
    serviceStyle: settings.serviceStyle,
    operatingModel: settings.operatingModel,
    hasFloor: tables.length > 0 || floorSections.length > 0,
    settings,
  });

  const stationJob = (() => {
    try {
      return useStationSessionStore.getState().stationJob;
    } catch {
      return null;
    }
  })();
  if (!order && !stationJob && (homeSurface === "floor" || homeSurface === "host")) {
    return <FloorView />;
  }

  if (!order && homeSurface === "drive_through") {
    return <DriveThroughView pane={stationRole === "host" ? "window" : "lane"} />;
  }

  if (!order) {
    const barOk =
      locationAllowsBarTabs(tables) &&
      stationCan(
        { deviceRole: stationRole ?? "order", employeeRole: emp?.role, settings },
        "bar_tab",
      );
    const togoOk = stationCan(
      { deviceRole: stationRole ?? "order", employeeRole: emp?.role, settings },
      "togo",
    );
    const ticketOk = stationCan(
      { deviceRole: stationRole ?? "order", employeeRole: emp?.role, settings },
      "order_entry",
    );
    const jobOnlyTicket = stationJob === "new_ticket";
    return (
      <div className="flex h-full min-h-0 flex-col" data-demo="station-home-queue">
      <OrderClockBanner />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Ticket queue</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Open a ticket or to-go check. This house has no dining floor.
        </p>
        <div className="grid w-full max-w-sm grid-cols-1 gap-3 sm:grid-cols-2">
          {ticketOk && (
          <Button
            size="lg"
            className="station-touch h-14 text-base"
            onClick={() => usePosStore.getState().openTakeout("Ticket")}
          >
            New ticket
          </Button>
          )}
          {!jobOnlyTicket && togoOk && (
          <Button
            size="lg"
            className="station-touch h-14 text-base"
            variant="outline"
            onClick={() => usePosStore.getState().openTakeout("To-go")}
          >
            To-go
          </Button>
          )}
          {!jobOnlyTicket && barOk && (
            <Button
              size="lg"
              className="station-touch h-14 text-base sm:col-span-2"
              variant="outline"
              onClick={() => usePosStore.getState().beginBarTabPick()}
            >
              Bar tab
            </Button>
          )}
          <div className="sm:col-span-2">
            <NoSaleControl className="h-14 w-full text-base" />
          </div>
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
                  className="station-touch flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-border-strong"
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
      </div>
    );
  }

  const guestSeats = Math.max(order.guestCount, 1);
  const unsent = order.lines.some((l) => !l.sent && !l.voided);

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

  const openAmountDialog = (
    <OpenAmountDialog
      item={openPriceItem}
      error={openPriceError}
      onClose={() => {
        setOpenPriceItem(null);
        setOpenPriceError(null);
      }}
      onAdd={submitOpenAmount}
    />
  );

  const onMenuClick = (item: MenuItem) => {
    if (!item.available) return;
    if (orderLocked) return;
    if (order.status !== "open") return;
    if (needsOpenAmount(item)) {
      setOpenPriceItem(item);
      setOpenPriceError(null);
      return;
    }
    const groups = usePosStore
      .getState()
      .modifierGroups.filter((g) => item.modifierGroupIds.includes(g.id));
    const needsMods = groups.some((g) => g.required);
    if (needsMods) {
      setModPriceCents(null);
      setModItem(item);
      setModOpen(true);
      return;
    }
    addItem(item.id);
  };

  const lp = parseLossPrevention(settings.lossPrevention);
  const voidReasons = voidReasonsFor(lp);
  const compReasons = compReasonsFor(lp);
  const frozen = order.status !== "open";
  const odsNoPay = stationRole === "ods";
  const checkActionCents = order.lines
    .filter((l) => !l.voided && !l.comped)
    .reduce(
      (sum, line) =>
        sum + (line.unitPriceCents + line.modifiers.reduce((s, m) => s + m.priceCents, 0)) * line.quantity,
      0,
    );
  const compAmt =
    mgrAction === "comp"
      ? mgrScope === "check"
        ? checkActionCents
        : lineUnit(selectedLineId ?? "")
      : 0;
  const lateCompDual =
    mgrAction === "comp" &&
    lp.lateCompDualControl &&
    isLateWindowComp(order, compAmt, lp) &&
    managerAuthKind !== "shift_lead";

  const runMgr = (ctx?: { reason: string; path?: "manager" | "shift_lead" | "break_glass" }) => {
    const reason = ctx?.reason?.trim() || "";
    const path = ctx?.path;
    setGateError(null);
    if (mgrAction === "reopen") {
      const res = reopenCheck(order.id, reason || "Manager approved", { path });
      if (!res.ok) setGateError(res.error ?? "Could not reopen");
      setMgrAction(null);
      return;
    }
    if (mgrAction === "tender_swap") {
      const pay = order.payments[order.payments.length - 1];
      if (pay) {
        const next = pay.method === "card" ? "cash" : "card";
        const res = swapTender({
          orderId: order.id,
          paymentId: pay.id,
          method: next,
          reason: reason || "Wrong tender",
          path,
        });
        if (!res.ok) setGateError(res.error ?? "Could not change tender");
      }
      setMgrAction(null);
      return;
    }
    if (mgrAction === "discount") {
      setDiscountOpen(true);
      setMgrAction(null);
      return;
    }
    if (mgrScope === "check") {
      if (mgrAction === "void") {
        const res = voidCheck(reason, { path, orderId: order.id });
        if (res && res.ok === false) {
          const message = res.error ?? "Void failed";
          setGateError(message);
          toast.error(message);
        }
      }
      if (mgrAction === "comp") {
        const res = compCheck(reason, { path, orderId: order.id });
        if (res && res.ok === false) setGateError(res.error ?? "Comp failed");
      }
      setMgrAction(null);
      return;
    }
    if (!selectedLineId) return;
    if (mgrAction === "void") {
      const res = voidLine(selectedLineId, reason, { path });
      if (res && res.ok === false) {
        const message = res.error ?? "Void failed";
        setGateError(message);
        toast.error(message);
      }
    }
    if (mgrAction === "comp") {
      const res = compLine(selectedLineId, reason, { path });
      if (res && res.ok === false) setGateError(res.error ?? "Comp failed");
    }
    setMgrAction(null);
  };

  const submitPending = (reason: string) => {
    if (!mgrAction) return;
    const line = selectedLineId ? order.lines.find((l) => l.id === selectedLineId) : undefined;
    const amt =
      mgrScope === "check" && (mgrAction === "void" || mgrAction === "comp")
        ? checkActionCents
        : mgrAction === "void" || mgrAction === "comp"
          ? lineUnit(selectedLineId ?? "")
          : mgrAction === "discount"
          ? Math.round(((order.lines.filter((l) => !l.voided && !l.comped).reduce((s, l) => s + l.unitPriceCents * l.quantity, 0) * (parseFloat(discPct) || 0)) / 100))
          : 0;
    const fired = line
      ? tickets.some((t) => t.items.some((i) => i.lineId === line.id) && t.status !== "voided")
      : false;
    const res = requestApproval({
      kind: mgrAction === "tender_swap" ? "tender_swap" : mgrAction === "reopen" ? "reopen" : mgrAction,
      reason: reason || "Manager approved",
      amountCents: amt,
      orderId: order.id,
      orderNumber: order.number,
      lineId: mgrScope === "check" ? undefined : line?.id,
      ticketId: line ? tickets.find((t) => t.items.some((i) => i.lineId === line.id))?.id : undefined,
      lineWasSent: mgrScope === "check" ? true : line?.sent,
      ticketFired: fired,
      payload: {
        scope: mgrScope,
        lineId: mgrScope === "check" ? undefined : line?.id,
        percent: mgrAction === "discount" ? parseFloat(discPct) || 0 : undefined,
        paymentId: mgrAction === "tender_swap" ? order.payments[order.payments.length - 1]?.id : undefined,
        method: mgrAction === "tender_swap"
          ? (order.payments[order.payments.length - 1]?.method === "card" ? "cash" : "card")
          : undefined,
      },
    });
    setGateError(res.ok ? "Held for manager / shift-lead approval." : res.error ?? "Could not queue");
    setMgrAction(null);
  };

  const askLineVoid = (lineId: string) => {
    setSelectedLine(lineId);
    setMgrScope("line");
    setMgrAction("void");
    setMgrOpen(true);
  };
  const askLineComp = (lineId: string) => {
    setSelectedLine(lineId);
    setMgrScope("line");
    setMgrAction("comp");
    setMgrOpen(true);
  };
  const askCheckVoid = () => {
    setMgrScope("check");
    setMgrAction("void");
    setMgrOpen(true);
  };
  const askCheckComp = () => {
    setMgrScope("check");
    setMgrAction("comp");
    setMgrOpen(true);
  };
  const removeLine = (lineId: string) => {
    setGateError(null);
    const res = removeUnsentLine(lineId, { orderId: order.id });
    if (res && res.ok === false) {
      const message = res.error ?? "Could not remove";
      setGateError(message);
      toast.error(message);
    }
  };
  const confirmDeleteCheck = () => {
    setDeleteOpen(false);
    const res = deleteUnsentCheck(order.id);
    if (res && res.ok === false) {
      const message = res.error ?? "Could not delete";
      setGateError(message);
      toast.error(message);
    }
  };
  const lineActionButtons = (line: (typeof order.lines)[number]) => {
    if (frozen) return null;
    if (canRemoveLine(line)) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="station-touch h-8 px-2 text-xs"
          data-remove-line
          onClick={(e) => {
            e.stopPropagation();
            removeLine(line.id);
          }}
        >
          Remove
        </Button>
      );
    }
    if (canVoidOrCompLine(line)) {
      return (
        <span className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="outline"
            className="station-touch h-8 px-2 text-xs"
            data-void-line
            onClick={(e) => {
              e.stopPropagation();
              askLineVoid(line.id);
            }}
          >
            Void
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="station-touch h-8 px-2 text-xs"
            data-comp-line
            onClick={(e) => {
              e.stopPropagation();
              askLineComp(line.id);
            }}
          >
            Comp
          </Button>
        </span>
      );
    }
    return null;
  };

  /** Tablet order screen, portrait or landscape: check on the left third, menu on the right two-thirds. A phone keeps the check over the menu. */
  const orderSplit = layout.width >= 640;
  const checkOverlay = !orderSplit;

  const runPrintCheck = () => {
    if (!mayPrintCheck) {
      setPrintMsg(ADD_RECEIPT_PRINTER);
      return;
    }
    setPrintMsg(null);
    printCheck();
    void import("@/lib/print/from-store")
      .then((m) => m.printGuestCheck(order.id))
      .then((r) => {
        if (!r.ok && r.error === ADD_RECEIPT_PRINTER && hasBoundReceipt) return;
        setPrintMsg(
          r.ok
            ? `Sending to ${r.sentTo || "receipt printer"}`
            : r.error || ADD_RECEIPT_PRINTER,
        );
      })
      .catch(() => setPrintMsg("Print failed"));
  };

  const liveLines = order.lines;
  const checkLevelActions = !frozen && (canDeleteCheck(order) || canVoidOrCompCheck(order)) ? (
    <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
      {canDeleteCheck(order) && (
        <Button
          variant="outline"
          className="station-touch col-span-full"
          data-delete-check
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete check
        </Button>
      )}
      {canVoidOrCompCheck(order) && (
        <>
          <Button variant="outline" className="station-touch" data-void-check onClick={askCheckVoid}>
            Void check
          </Button>
          <Button variant="outline" className="station-touch" data-comp-check onClick={askCheckComp}>
            Comp check
          </Button>
        </>
      )}
    </div>
  ) : null;
  const liveCheckList = (
    <TicketStripLines
      lines={liveLines}
      vendors={vendors}
      settings={settings}
      selectedLineId={selectedLineId}
      onSelect={setSelectedLine}
      renderActions={lineActionButtons}
      empty="Tap the menu — lines land here"
    />
  );

  const checkActionDialogs = (
    <>
      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        onVerified={runMgr}
        title={
          mgrScope === "check" && mgrAction === "void"
            ? "Void check"
            : mgrScope === "check" && mgrAction === "comp"
              ? "Comp check"
              : mgrAction === "reopen"
                ? "Reopen paid check"
                : mgrAction === "tender_swap"
                  ? "Change tender"
                  : mgrAction === "void"
                    ? "Void"
                    : mgrAction === "comp"
                      ? "Comp"
                      : "Manager authorization"
        }
        description={
          lateCompDual
            ? "This check has been open a long time. A shift lead or pending/remote approval is required — the stand manager PIN is not enough."
            : "Manager or shift-lead PIN, or request approval if no one is on the floor. Logged."
        }
        skipIfAuthed={!lateCompDual}
        gate={
          mgrAction === "tender_swap"
            ? "tender_swap"
            : mgrAction === "reopen"
              ? "reopen"
              : mgrAction === "discount"
                ? "discount"
                : mgrAction === "comp"
                  ? "comp"
                  : mgrAction === "void"
                    ? "void"
                    : undefined
        }
        amountCents={
          mgrAction === "void" || mgrAction === "comp"
            ? mgrScope === "check"
              ? checkActionCents
              : lineUnit(selectedLineId ?? "")
            : 0
        }
        onRequestPending={submitPending}
        reasons={
          mgrAction === "void"
            ? voidReasons
            : mgrAction === "comp"
              ? compReasons
              : mgrAction === "discount"
                ? DISCOUNT_REASONS
                : mgrAction === "reopen"
                  ? REOPEN_REASONS
                  : mgrAction === "tender_swap"
                    ? TENDER_SWAP_REASONS
                    : undefined
        }
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete check</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Items that have not been sent are removed. This check is deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDeleteCheck}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (busyNight) {
    const cats = orderPadCategories(categories, menuItems, vendorFilter);
    const fireSend = () => {
      const res = sendOrder();
      if (res?.ok) onSent?.();
    };
    const busyCheck = (
      <div
        className={cn(
          "flex min-h-0 flex-col bg-surface",
          orderSplit
            ? "h-full w-1/3 shrink-0 overflow-hidden border-r border-border"
            : "max-h-[40%] shrink-0 border-t border-border",
        )}
        data-live-pad
        data-ticket-strip
        data-order-check
      >
        <div
          className={cn("min-h-0 overflow-y-auto", orderSplit ? "flex-1" : "max-h-40")}
          data-order-check-scroll
        >
          {liveCheckList}
        </div>
        {dual && (
          <div className="flex items-end justify-between px-3 py-1" data-ticket-totals>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Cash</p>
              <p className="text-lg font-semibold tabular leading-none">
                {formatCurrency(dual.cash.totalCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Card</p>
              <p className="text-lg font-semibold tabular leading-none">
                Card · {formatCurrency(dual.card.totalCents)}
              </p>
            </div>
          </div>
        )}
        {checkLevelActions}
        <div className="p-2">
          <Button
            className="station-touch h-16 w-full text-xl font-semibold"
            disabled={!unsent}
            onClick={fireSend}
            data-send
          >
            <Send className="h-5 w-5" />
            Send
          </Button>
        </div>
      </div>
    );
    return (
      <div
        className="flex h-full min-h-0 flex-col bg-bg"
        data-busy-menu
        data-order-layout={orderSplit ? "thirds" : "stack"}
      >
        <OrderClockBanner />
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 overflow-hidden",
            orderSplit ? "flex-row" : "flex-col",
          )}
        >
          {orderSplit ? busyCheck : null}
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              orderSplit ? "h-full w-2/3" : "flex-1",
            )}
            data-order-menu
          >
        <div className="flex gap-2 overflow-x-auto p-2" data-menu-categories>
          {cats.map((c) => (
            <Button
              key={c.id}
              className="station-touch h-16 min-w-[7.5rem] shrink-0 text-lg font-semibold"
              variant={selectedCategoryId === c.id ? "default" : "outline"}
              onClick={() => {
                setCategory(c.id);
                setSearch("");
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-2 min-[1100px]:grid-cols-3">
            {tiles.map((tile) => {
              if (tile.kind === "spirit") {
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={orderLocked}
                    data-well-spirit={tile.spiritId}
                    onClick={() =>
                      openWellSpirit({ spiritId: tile.spiritId, entityId: tile.entityId, name: tile.name })
                    }
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
                happy && item.happyHourPriceCents != null
                  ? item.happyHourPriceCents
                  : item.priceCents;
              const dualPrice = printedItemPriceCents(printed, settings, item.vendorId);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.available || orderLocked}
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
          </section>
          {orderSplit ? null : busyCheck}
        </div>
        <ModifierDialog
          open={modOpen}
          onOpenChange={setModOpen}
          item={modItem}
          unitPriceCents={modPriceCents}
        />
        {openAmountDialog}
        {wellPopup}
        {checkActionDialogs}
      </div>
    );
  }

  const checkPane = (
      <aside
        data-ticket-strip
        data-order-check
        className={cn(
          "flex min-h-0 flex-col overflow-hidden bg-surface",
          checkOverlay
            ? "h-full w-full"
            : "h-full w-1/3 min-w-0 shrink-0 basis-1/3 border-r border-border",
        )}
      >
        {!mayPrintCheck && (
          <div
            className="border-b border-border bg-surface-2 px-3 py-1.5 text-center text-[11px] text-muted-foreground"
            role="status"
            data-receipt-printer-banner
            data-add-receipt-printer
          >
            {ADD_RECEIPT_PRINTER}
          </div>
        )}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            className="station-touch"
            onClick={() => {
              if (checkOverlay) {
                setCheckOpen(false);
                return;
              }
              setActiveOrder(null);
              setView("order");
            }}
            aria-label={checkOverlay ? "Hide check" : "Close check"}
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
            className="station-touch"
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
              className="station-touch tabular"
            >
              S{n}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" data-order-check-scroll>
          <TicketStripLines
            lines={order.lines}
            vendors={vendors}
            settings={settings}
            selectedLineId={selectedLineId}
            onSelect={setSelectedLine}
            renderActions={lineActionButtons}
            empty="Tap the menu — lines land here"
          />
        </div>

        <div className="max-h-[38%] min-h-0 shrink overflow-y-auto">
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

        {order.status === "voided" && (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            This check is voided. Voided items stay on the check with the reason and are left out of
            the total.
          </div>
        )}
        {frozen && order.status !== "voided" && (
          <div className="border-t border-warn/40 bg-warn/10 px-3 py-2 text-xs">
            Paid check is frozen. Reopen or swap a tender only with a manager PIN and a listed
            reason. Before/after is stored.
            <div className="mt-2 flex gap-1">
              <Button
                size="sm"
                onClick={() => {
                  setMgrAction("reopen");
                  setMgrOpen(true);
                }}
              >
                Reopen
              </Button>
              {order.payments.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMgrAction("tender_swap");
                    setMgrOpen(true);
                  }}
                >
                  Swap last tender
                </Button>
              )}
            </div>
          </div>
        )}
        {gateError && (
          <p className="px-3 py-1 text-xs text-danger">{gateError}</p>
        )}
        {checkLevelActions}
        <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
          {(() => {
            const selected = selectedLineId
              ? order.lines.find((l) => l.id === selectedLineId)
              : undefined;
            if (selected && canRemoveLine(selected) && !frozen) {
              return (
                <Button
                  size="sm"
                  variant="outline"
                  className="station-touch"
                  data-remove-line
                  onClick={() => removeLine(selected.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              );
            }
            return (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="station-touch"
                  data-void-line
                  disabled={!selected || !canVoidOrCompLine(selected) || frozen}
                  onClick={() => selected && askLineVoid(selected.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Void
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="station-touch"
                  data-comp-line
                  disabled={!selected || !canVoidOrCompLine(selected) || frozen}
                  onClick={() => selected && askLineComp(selected.id)}
                >
                  <Gift className="h-3.5 w-3.5" />
                  Comp
                </Button>
              </>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            className="station-touch"
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
            className="station-touch"
            disabled={frozen}
            onClick={() => {
              if (discountNeedsManager(order, lp) && !canAuthorizeGate("discount", 0)) {
                setMgrAction("discount");
                setMgrOpen(true);
                return;
              }
              setDiscountOpen(true);
            }}
          >
            <Percent className="h-3.5 w-3.5" />
            Disc
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="station-touch"
            onClick={() => {
              setNoteDraft(order.note ?? "");
              setNoteOpen(true);
            }}
          >
            <StickyNote className="h-3.5 w-3.5" />
            Note
          </Button>
          {canEmployee(emp, "checks:mutate") && (
            <Button size="sm" variant="outline" className="station-touch" onClick={() => setOpsOpen(true)}>
              <Split className="h-3.5 w-3.5" />
              Split / move
            </Button>
          )}
        </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface">
        {dual && (
          <div className="px-3 py-2" data-ticket-totals>
            {dual.card.discountCents > 0 && (
              <p className="flex justify-between text-[11px] text-success">
                <span>Discount</span>
                <span className="tabular">−{formatCurrency(dual.card.discountCents)}</span>
              </p>
            )}
            {(dual.card.taxCents > 0 || dual.cash.taxCents > 0) && (
              <p className="flex justify-between text-[11px] text-muted-foreground">
                <span>Tax</span>
                <span className="tabular">
                  {formatCurrency(dual.cash.taxCents)} cash · {formatCurrency(dual.card.taxCents)} card
                </span>
              </p>
            )}
            {dual.card.serviceChargeCents > 0 && (
              <p className="flex justify-between text-[11px] text-muted-foreground">
                <span>{settings.serviceChargeLabel}</span>
                <span className="tabular">{formatCurrency(dual.card.serviceChargeCents)}</span>
              </p>
            )}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cash
                </p>
                <p className="text-xl font-semibold tabular leading-none">
                  {formatCurrency(dual.cash.balanceCents || dual.cash.totalCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Card
                </p>
                <p className="text-xl font-semibold tabular leading-none">
                  Card · {formatCurrency(dual.card.balanceCents || dual.card.totalCents)}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 p-2">
          {mayPrintCheck && (
          <Button
            variant="outline"
            className="station-touch min-h-12"
            onClick={() => runPrintCheck()}
          >
            <Printer className="h-4 w-4" />
            Print check
          </Button>
          )}
          <Button className="station-touch min-h-12" disabled={!unsent} onClick={() => sendOrder()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
          {canEmployee(emp, "payments:take") && !odsNoPay && (
          <Button
            className="station-touch col-span-full min-h-12"
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
          </Button>
          )}
          {mayPrintReceipt &&
            (order.receiptPendingAt ||
              order.status === "closed" ||
              ((totals?.balanceCents ?? 1) <= 0 && order.payments.length > 0)) && (
            <Button
              variant="outline"
              className="station-touch col-span-full"
              onClick={() => {
                void import("@/lib/print/from-store").then(async (m) => {
                  const r = await m.printGuestReceipt(order.id);
                  if (r.ok) usePosStore.getState().clearReceiptPending(order.id);
                  setPrintMsg(r.ok ? "Printed" : r.error || "Print failed");
                });
              }}
            >
              <Printer className="h-4 w-4" />
              Print receipt
            </Button>
          )}
          {!mayPrintCheck && !odsNoPay && (
            <p className="col-span-full px-1 text-center text-sm font-medium" data-add-receipt-printer>
              {ADD_RECEIPT_PRINTER}
            </p>
          )}
        </div>
        {printMsg && (
          <p className="px-3 pb-2 text-[11px] text-muted-foreground" role="status">
            {printMsg}
          </p>
        )}
        </div>
      </aside>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden flex-col">
      <OrderClockBanner />
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 overflow-hidden",
          checkOverlay ? "flex-col" : "flex-row",
        )}
        data-order-layout={checkOverlay ? "overlay" : "thirds"}
      >
      {!checkOverlay ? checkPane : null}

      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-col bg-bg",
          checkOverlay ? "flex-1" : "h-full w-2/3 min-w-0 basis-2/3",
        )}
        data-order-menu
      >
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
              {orderPadCategories(categories, menuItems, vendorFilter).map((c) => (
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
          <div
            className={cn(
              "grid gap-2",
              checkOverlay
                ? "grid-cols-2"
                : "grid-cols-2 min-[1100px]:grid-cols-3 min-[1500px]:grid-cols-4",
            )}
          >
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
            {tiles.map((tile) => {
              if (tile.kind === "spirit") {
                const dualPrice = printedItemPriceCents(tile.priceCents, settings, tile.entityId);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={orderLocked}
                    data-well-spirit={tile.spiritId}
                    onClick={() =>
                      openWellSpirit({ spiritId: tile.spiritId, entityId: tile.entityId, name: tile.name })
                    }
                    className="flex min-h-[5.5rem] w-full flex-col rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-border-strong active:scale-[0.98]"
                  >
                    <span className="text-sm font-medium leading-snug">{tile.name}</span>
                    <span className="mt-auto pt-2 text-right tabular text-sm font-semibold">
                      <span className="block">{formatCurrency(dualPrice.card)}</span>
                    </span>
                  </button>
                );
              }
              const item = tile.item;
              const openEntry = needsOpenAmount(item);
              const vendor = vendors.find((v) => v.id === item.vendorId);
              const printed =
                happy && item.happyHourPriceCents != null
                  ? item.happyHourPriceCents
                  : item.priceCents;
              const dualPrice = printedItemPriceCents(printed, settings, item.vendorId);
              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    disabled={!item.available}
                    data-open-item={openEntry ? item.openKind ?? "price" : undefined}
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
                        {openEntry ? (
                          <span className="block text-xs font-medium">Enter amount</span>
                        ) : (
                          <span className="block">{formatCurrency(dualPrice.card)}</span>
                        )}
                      </span>
                    </span>
                  </button>
                  {openEntry ? null : (
                    <div className="absolute right-1 top-1">
                      <RecipeLookupButton menuItemId={item.id} icon />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {checkOverlay && (
        <>
          {!mayPrintCheck && (
            <div
              className="border-t border-border bg-surface-2 px-3 py-1.5 text-center text-[11px] text-muted-foreground"
              role="status"
              data-receipt-printer-banner
              data-add-receipt-printer
            >
              {ADD_RECEIPT_PRINTER}
            </div>
          )}
          <div
            className="max-h-[32%] min-h-[4.5rem] overflow-y-auto border-t border-border bg-surface px-2 py-1"
            data-live-check-strip
          >
            {liveCheckList}
          </div>
          {dual && liveLines.length > 0 && (
            <div
              className="flex shrink-0 items-end justify-between border-t border-border bg-surface px-3 py-1.5"
              data-ticket-totals
            >
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Cash</p>
                <p className="text-lg font-semibold tabular leading-none">
                  {formatCurrency(dual.cash.totalCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Card</p>
                <p className="text-lg font-semibold tabular leading-none">
                  Card · {formatCurrency(dual.card.totalCents)}
                </p>
              </div>
            </div>
          )}
          {printMsg && (
            <p className="shrink-0 bg-surface px-3 pb-1 text-[11px] text-muted-foreground">{printMsg}</p>
          )}
          <div className="grid grid-cols-2 gap-2 border-t border-border bg-surface p-2 safe-bottom">
            {mayPrintCheck && (
            <Button
              size="lg"
              className="station-touch min-h-12"
              onClick={() => runPrintCheck()}
            >
              <Printer className="h-4 w-4" />
              Print check
            </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="station-touch min-h-12"
              onClick={() => setCheckOpen(true)}
            >
              Check
              {liveLines.length > 0 ? ` · ${liveLines.length}` : ""}
            </Button>
            <Button
              size="lg"
              className="station-touch min-h-12"
              disabled={!unsent}
              onClick={() => sendOrder()}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
            {canEmployee(emp, "payments:take") && !odsNoPay ? (
              <Button
                size="lg"
                className="station-touch min-h-12"
                disabled={order.status !== "open" || !totals || totals.itemCount === 0}
                onClick={() => setPayOpen(true)}
              >
                <CreditCard className="h-4 w-4" />
                Pay
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="station-touch min-h-12"
                onClick={() => {
                  setActiveOrder(null);
                  setView("order");
                }}
              >
                Close
              </Button>
            )}
          </div>
        </>
      )}
      {checkOverlay && checkOpen && (
        <div className="absolute inset-0 z-20 flex flex-col bg-surface">{checkPane}</div>
      )}

      <ModifierDialog
        open={modOpen}
        onOpenChange={setModOpen}
        item={modItem}
        unitPriceCents={modPriceCents}
      />
      {openAmountDialog}
      {wellPopup}
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
      {checkActionDialogs}
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
          <label className="block text-xs text-muted-foreground">
            Reason
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-foreground"
              defaultValue={DISCOUNT_REASONS[0]}
              id="disc-reason"
            >
              {DISCOUNT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const sel = document.getElementById("disc-reason") as HTMLSelectElement | null;
                const res = applyDiscount({
                  percent: parseFloat(discPct) || 0,
                  reason: sel?.value || DISCOUNT_REASONS[0],
                });
                if (res && res.ok === false) {
                  setGateError(res.error ?? "Discount not applied");
                  return;
                }
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
          {order ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Guest scans to pay this check with Quantum Payments. The code is
                signed to check #{order.number} and expires; reprint to refresh.
              </p>
              <QrMark
                value={
                  ticketGuestUrl(
                    order.id,
                    usePosStore.getState().tenantLocationId || "loc",
                    parseQrPolicy(settings.qrPolicy, settings.qrMode).ticketQrTtlSec,
                  ).url
                }
                caption={`Check #${order.number} · pay`}
              />
              {table ? (
                <a
                  className="block text-sm underline"
                  href={tableGuestUrl(table, {
                    pay: true,
                    demoType: getDemoType(),
                  })}
                >
                  Table tent · {table.label}
                </a>
              ) : null}
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
      {order && (
        <CheckOpsDialog open={opsOpen} onOpenChange={setOpsOpen} orderId={order.id} />
      )}
      </div>
    </div>
  );
}
