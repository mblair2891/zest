import { usePosStore } from "@/lib/pos/store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useCostStore } from "@/lib/costs/store";
import type { KeepEraseMap } from "./types";

/** Always keep menus, recipes, floorplan, staff, devices, SKU defs, suppliers, settings. */
export function erasePracticeData(choices: KeepEraseMap): string[] {
  const done: string[] = [];
  const pos = usePosStore.getState();

  if (choices.orders === "erase") {
    const tables = pos.tables.map((t) => ({
      ...t,
      status: "empty" as const,
      orderId: undefined,
      serverId: undefined,
    }));
    usePosStore.setState({
      orders: [],
      tickets: [],
      activeOrderId: null,
      selectedLineId: null,
      tables,
    });
    done.push("orders");
  }

  if (choices.payments === "erase") {
    const orders =
      choices.orders === "erase"
        ? []
        : usePosStore.getState().orders.map((o) => ({ ...o, payments: [] }));
    usePosStore.setState({
      orders,
      settlementPeriods: [],
      ledgerEntries: [],
      chargebacks: [],
      shift: {
        ...usePosStore.getState().shift,
        cashSalesCents: 0,
        cardSalesCents: 0,
        giftSalesCents: 0,
        compsCents: 0,
        tipsCashCents: 0,
        tipsCardCents: 0,
      },
    });
    done.push("payments");
  }

  if (choices.waitlist === "erase") {
    usePosStore.setState({ waitlist: [], reservations: [] });
    done.push("waitlist");
  }

  if (choices.gift_balances === "erase") {
    usePosStore.setState({
      giftCards: usePosStore.getState().giftCards.map((g) => ({
        ...g,
        balanceCents: 0,
        status: g.status === "void" ? g.status : "zeroed",
      })),
      giftTransfers: [],
    });
    done.push("gift_balances");
  }

  if (choices.punches === "erase") {
    try {
      useOpsStore.setState({ punches: [], alerts: [], payPeriods: [] });
      done.push("punches");
    } catch {
      /* optional */
    }
  }

  if (choices.inventory_usage === "erase") {
    try {
      const cost = useCostStore.getState();
      useCostStore.setState({
        invoices: [],
        ledger: [],
        counts: [],
        waste: [],
        exceptions: [],
        skus: cost.skus.map((s) => ({
          ...s,
          onHand: 0,
          lastReceivedAt: undefined,
          lastReceivedQty: undefined,
        })),
      });
      done.push("inventory_usage");
    } catch {
      /* optional */
    }
    usePosStore.setState({
      inventory: usePosStore.getState().inventory.map((i) => ({
        ...i,
        onHand: 0,
        lowStock: true,
      })),
    });
  }

  return done;
}
