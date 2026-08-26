import { usePosStore } from "@/lib/pos/store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { listGiftCardsFn } from "./api";
import type { GiftCard, GiftTransfer } from "@/lib/pos/types";

export function applyGiftSnapshot(cards: GiftCard[], transfers: GiftTransfer[]): void {
  const s = usePosStore.getState();
  if (!s.tenantLocationId) return;
  usePosStore.setState({
    giftCards: cards,
    giftTransfers: transfers,
  });
}

export async function hydrateGift(locationId: string): Promise<void> {
  if (!locationId) return;
  if (!useNetworkStore.getState().wanOnline()) return;
  try {
    const res = await listGiftCardsFn({ data: { locationId } });
    applyGiftSnapshot(res.cards, res.transfers);
  } catch {
    /* keep cache */
  }
}
