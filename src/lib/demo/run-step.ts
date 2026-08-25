import { usePosStore } from "@/lib/pos/store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { isProspectDemo } from "./session";
import type { DemoStep } from "./scripts";
import { applyVoiceTranscript } from "@/components/pos/VoiceCommandButton";
import { buildShiftRecommendations } from "@/lib/ops-ai/engine";
import { recordDecision } from "@/lib/ops-ai/learn-store";

function pickItem(station: "kitchen" | "bar"): string | null {
  const items = usePosStore.getState().menuItems.filter(
    (m) => m.available !== false && m.station === station,
  );
  return items[0]?.id ?? usePosStore.getState().menuItems[0]?.id ?? null;
}

function ensureOpenCheck(): void {
  const s = usePosStore.getState();
  if (s.getActiveOrder?.()) return;
  const table =
    s.tables.find((t) => t.status === "available" || t.status === "empty") ?? s.tables[0];
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
  if (!action || action === "none") return;
  if (!isProspectDemo()) return;
  const s = usePosStore.getState();
  switch (action) {
    case "seat": {
      const table =
        s.tables.find((t) => t.status === "available" || t.status === "empty") ??
        s.tables[0];
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
    case "offline_cash": {
      useNetworkStore.getState().setSimulateWanDown(true);
      ensureOpenCheck();
      {
        const id = pickItem("kitchen");
        if (id) usePosStore.getState().addItem(id);
      }
      usePosStore.getState().sendOrder();
      const order = usePosStore.getState().getActiveOrder?.();
      const cents = Math.max(
        100,
        (order?.lines ?? []).reduce((sum, l) => sum + Number(l.quantity ?? 1) * Number(l.unitPriceCents ?? 0), 0) || 1800,
      );
      usePosStore.getState().takePayment({
        method: "cash",
        amountCents: cents,
        tipCents: 0,
        tenderedCents: cents,
      });
      break;
    }
    case "pay": {
      useNetworkStore.getState().setSimulateWanDown(false);
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
        .tickets.find(
          (x) =>
            x.station === "kitchen" &&
            (x.status === "new" || x.status === "in_progress"),
        );
      if (t) usePosStore.getState().readyTicket(t.id);
      break;
    }
    case "bump_bar": {
      const t = usePosStore
        .getState()
        .tickets.find(
          (x) =>
            x.station === "bar" &&
            (x.status === "new" || x.status === "in_progress"),
        );
      if (t) usePosStore.getState().readyTicket(t.id);
      break;
    }
    case "settle_preview":
      usePosStore.getState().setView("settlement");
      break;
    case "waitlist_join": {
      const s = usePosStore.getState();
      s.updateSettings?.({ waitlistEnabled: true, kioskMode: "combined" });
      s.addWaitlist({
        name: "Jordan Guest",
        partySize: 2,
        phone: "5550101",
        quotedMinutes: 25,
        status: "waiting",
      });
      s.setView("waitlist");
      break;
    }
    case "waitlist_ready": {
      const w = usePosStore
        .getState()
        .waitlist.find((x) => x.status === "waiting");
      if (w) usePosStore.getState().updateWaitlistStatus(w.id, "notified");
      usePosStore.getState().setView("waitlist");
      break;
    }
    case "reservation_seed": {
      usePosStore.getState().addReservation({
        name: "Blair",
        partySize: 2,
        phone: "5550100",
        at: Date.now() + 3600000,
        time: Date.now() + 3600000,
        checkInCode: "K7M2",
        status: "booked",
        tableSuggestion: "12",
      });
      usePosStore.getState().setView("waitlist");
      break;
    }
    case "voice_86": {
      const item =
        usePosStore.getState().menuItems.find((m) => m.available && m.station === "kitchen") ??
        usePosStore.getState().menuItems.find((m) => m.available);
      if (item) applyVoiceTranscript(`86 ${item.name}`);
      usePosStore.getState().setView("menu");
      break;
    }
    case "accept_labor_rec":
    case "dismiss_labor_rec": {
      const pack = buildShiftRecommendations({});
      const labor = pack.recs.find((r) => r.type === "labor_high") ?? pack.recs[0];
      if (labor) {
        recordDecision({
          locationId: usePosStore.getState().tenantLocationId || "demo",
          recId: labor.id,
          recType: labor.type,
          action: action === "accept_labor_rec" ? "accept" : "dismiss",
          features: pack.features,
          userId: usePosStore.getState().currentEmployeeId || "demo",
        });
      }
      usePosStore.getState().setView("hq");
      break;
    }
    default:
      break;
  }
}
