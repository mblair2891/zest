import { useEffect } from "react";
import { leftoverMarketingPlatformHref } from "@/lib/platform/hosts";

/** Apex leftover console URLs → app.summex.app. No-op on preview/local. */
export function HostSplitGuard() {
  useEffect(() => {
    const href = leftoverMarketingPlatformHref();
    if (href) window.location.replace(href);
  }, []);
  return null;
}
