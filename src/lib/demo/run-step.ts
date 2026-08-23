import { usePosStore } from "@/lib/pos/store";
import type { DemoStep } from "./scripts";

function pickItem(station: "kitchen" | "bar"): string | null {
  const items = usePosStore.getState().menuItems.filter(
    (m) => m.available !== false && m.station === station,
  );
  return items[0]?.id ?? usePosStore.getState().menuItems[0]?.id ?? null;
}

function ensureOpenCheck(): void {
  const s = usePosStore.getState();
  if (s.getActiveOrder?.()) return;
  const table = s.tables.find((t) => t.status === "available") ?? s.tables[0];
  if (table) {
    const seated = s.seatTable(table.id, 2);
    if (seated && "ok" in seated && seated.ok === false) {
      s.openTakeout?.("Demo guest");
    }
    return;
  }
  if (typeof s.openBarTab === "function") {
    s.openBarTab("Demo tab", 1);
    return;
  }
  s.openTakeout?.("Demo guest");
}

export function runDemoStepAction(action: DemoStep["action"]): void {
  const s = usePosStore.getState();
  switch (action) {
    case "seat": {
      const table = s.tables.find((t) => t.status === "available") ?? s.tables[0];
      if (table) s.seatTable(table.id, 2);
      break;
    }
    case "open_tab":
      s.openBarTab("Lounge tab", 2);
      break;
    case "counter_open":
      s.openTakeout("Counter");
      break;
    case "add_food": {
      ensureOpenCheck();
      const id = pickItem("kitchen");
      if (id) usePosStore.getState().addItem(id);
      break;
    }
    case "add_drink": {
      ensureOpenCheck();
      const id = pickItem("bar") ?? pickItem("kitchen");
      if (id) usePosStore.getState().addItem(id);
      break;
    }
    case "send":
      ensureOpenCheck();
      usePosStore.getState().sendOrder();
      break;
    case "pay": {
      ensureOpenCheck();
      const order = usePosStore.getState().getActiveOrder?.();
      const lines = order?.lines ?? [];
      const cents = Math.max(
        100,
        lines.reduce((sum, l) => {
          const qty = Number(l.quantity ?? 1);
          const unit = Number(l.unitPriceCents ?? 0);
          return sum + qty * unit;
        }, 0) || 2500,
      );
      usePosStore.getState().takePayment({
        method: "card",
        amountCents: cents,
        tipCents: 0,
        last4: "4242",
      });
      break;
    }
    case "bump_kitchen": {
      const t = usePosStore
        .getState()
        .tickets.find((x) => x.station === "kitchen" && x.status !== "bumped");
      if (t) usePosStore.getState().bumpTicket(t.id);
      break;
    }
    case "bump_bar": {
      const t = usePosStore
        .getState()
        .tickets.find((x) => x.station === "bar" && x.status !== "bumped");
      if (t) usePosStore.getState().bumpTicket(t.id);
      break;
    }
    case "settle_preview":
      usePosStore.getState().setView("settlement");
      break;
    default:
      break;
  }
}
