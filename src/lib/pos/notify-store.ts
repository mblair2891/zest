import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { Employee, EmployeeRole, KitchenTicket } from "./types";

export type PosNoticeKind = "ticket_bumped" | "ticket_recalled";

export interface PosNotice {
  id: string;
  kind: PosNoticeKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  ticketId: string;
  orderId: string;
  tableLabel: string;
  station: KitchenTicket["station"];
  serverName: string;
  itemSummary: string;
}

interface NotifyState {
  notices: PosNotice[];
  soundEnabled: boolean;
  desktopEnabled: boolean;
  /** table label → bumpedAt ms (for floor pulse) */
  foodUpUntil: Record<string, number>;

  pushFromTicket: (ticket: KitchenTicket, kind: PosNoticeKind) => PosNotice;
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
  if (role === "owner" || role === "manager" || role === "host") return true;
  if (role === "server") return true;
  if (role === "bartender") return n.station === "bar" || n.kind === "ticket_bumped";
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

export const useNotifyStore = create<NotifyState>()(
  persist(
    (set, get) => ({
      notices: [],
      soundEnabled: true,
      desktopEnabled: false,
      foodUpUntil: {},

      pushFromTicket: (ticket, kind) => {
        const itemSummary = summarizeItems(ticket);
        const stationLabel = ticket.station === "bar" ? "Bar" : "Kitchen";
        const notice: PosNotice =
          kind === "ticket_bumped"
            ? {
                id: uid("nt"),
                kind,
                title: `Food up · ${ticket.tableLabel}`,
                body: `${stationLabel} bumped #${ticket.orderNumber}${
                  ticket.serverName ? ` for ${ticket.serverName}` : ""
                }${itemSummary ? ` — ${itemSummary}` : ""}`,
                createdAt: Date.now(),
                read: false,
                ticketId: ticket.id,
                orderId: ticket.orderId,
                tableLabel: ticket.tableLabel,
                station: ticket.station,
                serverName: ticket.serverName,
                itemSummary,
              }
            : {
                id: uid("nt"),
                kind,
                title: `Recalled · ${ticket.tableLabel}`,
                body: `${stationLabel} recalled #${ticket.orderNumber} back to the rail.`,
                createdAt: Date.now(),
                read: false,
                ticketId: ticket.id,
                orderId: ticket.orderId,
                tableLabel: ticket.tableLabel,
                station: ticket.station,
                serverName: ticket.serverName,
                itemSummary,
              };

        const key = normalizeTableKey(ticket.tableLabel);
        const foodUpUntil = { ...get().foodUpUntil };
        if (kind === "ticket_bumped") {
          foodUpUntil[key] = Date.now() + FOOD_UP_MS;
        } else {
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
      name: "zest-notify-v1",
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
