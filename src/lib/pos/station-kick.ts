import { clearTenantPosContext } from "@/lib/saas/pos-context";
import { ejectDeletedStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";

/** Drop pair + snapshot and send this WebView to the pair-code screen. */
export function kickStationToPair(): void {
  ejectDeletedStationPair();
  try {
    clearTenantPosContext();
  } catch {
    /* */
  }
  try {
    usePosStore.getState().logout();
  } catch {
    /* */
  }
  if (typeof window !== "undefined") {
    window.location.replace("/station");
  }
}
