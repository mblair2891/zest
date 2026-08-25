import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { Employee, EmployeeRole, KitchenTicket } from "./types";

export type PosNoticeKind =
  | "ticket_bumped"
  | "ticket_recalled"
  | "guest_checked_in"
  | "waitlist_update"
  | "sla_alert"
  | "ticket_ready"
  | "ticket_started"
  | "ticket_sent"
  | "table_needs_bus";

export interface PosNotice {
  id: string;
  kind: PosNoticeKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  ticketId?: string;
  orderId?: string;
  tableLabel?: string;
  station?: KitchenTicket["station"];
  serverName?: string;
  serverId?: string;
  itemSummary?: string;
}

interface NotifyState {
  notices: PosNotice[];
  soundEnabled: boolean;
  desktopEnabled: boolean;
  /** table label → bumpedAt ms (for floor pulse) */
  foodUpUntil: Record<string, number>;

  pushFromTicket: (ticket: KitchenTicket, kind: PosNoticeKind) => PosNotice;
  pushNotice: (input: {
    kind: PosNoticeKind;
    title: string;
    body: string;
    tableLabel?: string;
  }) => PosNotice;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotice: (id: string) => void;
  clearAll: () => void;
  setSoundEnabled: (v: boolean) => void;
  setDesktopEnabled: (v: boolean) => void;
  unreadFor: (emp: Employee | null) => PosNotice[];
  visibleFor: (emp: Employee | null) => PosNotice[];
  isFoodUp: (tableLabel: string) => boolean;
}

const MAX_NOTICES = 40;
const FOOD_UP_MS = 90_000;

function normalizeTableKey(label: string): string {
  return label.replace(/^T/i, "").trim().toLowerCase();
}

export function noticeVisibleTo(
  n: PosNotice,
  emp: Employee | null,
): boolean {
  if (!emp) return false;
  const role: EmployeeRole = emp.role;
  if (role === "owner" || role === "manager" || role === "host" || role === "accountant") return true;
  if (n.kind === "sla_alert" || n.kind === "table_needs_bus") {
    return role === "server" || role === "busser" || role === "cashier";
  }
  if (n.serverId && emp.id === n.serverId) return true;
  if (n.serverName && emp.name === n.serverName) return true;
  if (n.kind === "ticket_ready" || n.kind === "ticket_started" || n.kind === "ticket_sent") {
    return role === "server" || role === "busser" || role === "cashier";
  }
  if (n.kind === "guest_checked_in" || n.kind === "waitlist_update") {
    return role === "server" || role === "cashier";
  }
  if (role === "server" || role === "cashier") return true;
  if (role === "bartender" || role === "vendor_operator") {
    return n.station === "bar" || n.kind === "ticket_bumped";
  }
  if (role === "kitchen") return n.station === "kitchen";
  if (role === "busser") return n.kind === "ticket_bumped";
  return n.serverName === emp.name;
}

function summarizeItems(t: KitchenTicket): string {
  return t.items
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(", ");
}

function noticeFromTicket(ticket: KitchenTicket, kind: PosNoticeKind): PosNotice {
  const itemSummary = summarizeItems(ticket);
  const stationLabel = ticket.station === "bar" ? "Bar ODS" : "Kitchen ODS";
  const base = {
    createdAt: Date.now(),
    read: false as const,
    ticketId: ticket.id,
    orderId: ticket.orderId,
    tableLabel: ticket.tableLabel,
    station: ticket.station,
    serverName: ticket.serverName,
    serverId: ticket.serverId,
    itemSummary,
  };
  if (kind === "ticket_sent") {
    return {
      id: uid("nt"),
      kind,
      title: `Sent · ${ticket.tableLabel}`,
      body: `${stationLabel} received #${ticket.orderNumber}${itemSummary ? ` — ${itemSummary}` : ""}`,
      ...base,
    };
  }
  if (kind === "ticket_started") {
    return {
      id: uid("nt"),
      kind,
      title: `Preparing · ${ticket.tableLabel}`,
      body: `${stationLabel} started #${ticket.orderNumber}${itemSummary ? ` — ${itemSummary}` : ""}`,
      ...base,
    };
  }
  if (kind === "ticket_ready") {
    return {
      id: uid("nt"),
      kind,
      title: `Ready · ${ticket.tableLabel}`,
      body: `${stationLabel} bumped #${ticket.orderNumber} — ready for expo / floor${
        itemSummary ? ` — ${itemSummary}` : ""
      }`,
      ...base,
    };
  }
  if (kind === "ticket_bumped") {
    return {
      id: uid("nt"),
      kind,
      title: `Delivered · ${ticket.tableLabel}`,
      body: `#${ticket.orderNumber} marked delivered${
        ticket.serverName ? ` for ${ticket.serverName}` : ""
      }${itemSummary ? ` — ${itemSummary}` : ""}`,
      ...base,
    };
  }
  return {
    id: uid("nt"),
    kind,
    title: `Recalled · ${ticket.tableLabel}`,
    body: `${stationLabel} recalled #${ticket.orderNumber} back to the rail.`,
    ...base,
  };
}

export const useNotifyStore = create<NotifyState>()(
  persist(
    (set, get) => ({
      notices: [],
      soundEnabled: true,
      desktopEnabled: false,
      foodUpUntil: {},

      pushNotice: (input) => {
        const notice: PosNotice = {
          id: uid("nt"),
          kind: input.kind,
          title: input.title,
          body: input.body,
          createdAt: Date.now(),
          read: false,
          tableLabel: input.tableLabel,
        };
        set({
          notices: [notice, ...get().notices].slice(0, MAX_NOTICES),
        });
        return notice;
      },

      pushFromTicket: (ticket, kind) => {
        const notice = noticeFromTicket(ticket, kind);
        const key = normalizeTableKey(ticket.tableLabel);
        const foodUpUntil = { ...get().foodUpUntil };
        if (kind === "ticket_bumped" || kind === "ticket_ready") {
          foodUpUntil[key] = Date.now() + FOOD_UP_MS;
        } else if (kind === "ticket_recalled") {
          delete foodUpUntil[key];
        }

        set({
          notices: [notice, ...get().notices].slice(0, MAX_NOTICES),
          foodUpUntil,
        });
        return notice;
      },

      markRead: (id) =>
        set({
          notices: get().notices.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }),

      markAllRead: () =>
        set({
          notices: get().notices.map((n) => ({ ...n, read: true })),
        }),

      clearNotice: (id) =>
        set({ notices: get().notices.filter((n) => n.id !== id) }),

      clearAll: () => set({ notices: [] }),

      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setDesktopEnabled: (v) => set({ desktopEnabled: v }),

      visibleFor: (emp) =>
        get().notices.filter((n) => noticeVisibleTo(n, emp)),

      unreadFor: (emp) =>
        get()
          .notices.filter((n) => noticeVisibleTo(n, emp) && !n.read),

      isFoodUp: (tableLabel) => {
        const until = get().foodUpUntil[normalizeTableKey(tableLabel)];
        return !!until && until > Date.now();
      },
    }),
    {
      name: "summex-notify-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        notices: s.notices,
        soundEnabled: s.soundEnabled,
        desktopEnabled: s.desktopEnabled,
        foodUpUntil: s.foodUpUntil,
      }),
    },
  ),
);

export function hapticNotify(): void {
  try {
    navigator.vibrate?.([80, 40, 120]);
  } catch {
    /* not supported */
  }
}

export function playBumpChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number, gain = 0.08) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.02);
    };
    beep(880, 0, 0.12);
    beep(1174, 0.14, 0.16);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* ignore */
  }
}
