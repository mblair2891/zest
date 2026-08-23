import { useEffect } from "react";
import { usePosStore } from "@/lib/pos/store";
import { isProspectDemo } from "./session";

/** Other demo windows (KDS / kiosk) pick up floor sends via persist. */
export function useDemoLiveSync(): void {
  useEffect(() => {
    if (!isProspectDemo()) return;
    const persist = usePosStore.persist;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.includes("summex-demo-persist")) return;
      void persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    const t = window.setInterval(() => {
      void persist.rehydrate();
    }, 2500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(t);
    };
  }, []);
}
