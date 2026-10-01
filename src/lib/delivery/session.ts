import { create } from "zustand";

type OutboxRow = { at: number; mode: string; payload: Record<string, unknown> | null; log: string };

type DeliverySession = {
  banner: string | null;
  outbox: OutboxRow[];
  setBanner: (banner: string | null) => void;
  pushOutbox: (row: OutboxRow) => void;
};

export const useDeliverySession = create<DeliverySession>((set) => ({
  banner: null,
  outbox: [],
  setBanner: (banner) => set({ banner }),
  pushOutbox: (row) => set((state) => ({ outbox: [row, ...state.outbox].slice(0, 40), banner: state.banner })),
}));
