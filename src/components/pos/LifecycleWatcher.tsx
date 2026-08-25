import { useEffect } from "react";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { saveLifecycleFn } from "@/lib/lifecycle/api";
import { isProspectDemo } from "@/lib/demo/session";

export function LifecycleWatcher() {
  const fire = useLifecycleStore((s) => s.fireScheduleIfDue);
  const status = useLifecycleStore((s) => s.status);
  const locId = usePosStore((s) => s.tenantLocationId);
  const orgId = useSaasStore((s) => s.org.id);

  useEffect(() => {
    const tick = () => {
      const did = fire();
      if (did && !isProspectDemo() && orgId && locId) {
        void saveLifecycleFn({
          data: { orgId, locationId: locId, lifecycleStatus: "live", goLiveAt: null },
        }).catch(() => undefined);
      }
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => window.clearInterval(id);
  }, [fire, orgId, locId, status]);

  return null;
}
