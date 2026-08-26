import { useEffect } from "react";
import { registerOfflineServiceWorker } from "@/lib/offline/register-sw";

/** Registers the offline-first service worker on the client only. */
export function OfflineSwRegistrar() {
  useEffect(() => {
    registerOfflineServiceWorker();
  }, []);
  return null;
}
