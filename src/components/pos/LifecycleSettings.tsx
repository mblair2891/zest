import { GoLivePanel } from "./GoLiveDialog";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { saveLifecycleFn } from "@/lib/lifecycle/api";
import { LIFECYCLE_LABEL, type LocationLifecycle } from "@/lib/lifecycle/types";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { isProspectDemo } from "@/lib/demo/session";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Badge } from "@/components/ui/badge";

export function LifecycleSettings() {
  const status = useLifecycleStore((s) => s.status);
  const track = useLifecycleStore((s) => s.trackInventoryInTraining);
  const setTrack = useLifecycleStore((s) => s.setTrackInventory);
  const operatorStatus = useLifecycleStore((s) => s.operatorStatus);
  const setOperatorStatus = useLifecycleStore((s) => s.setOperatorStatus);
  const goLiveNow = useLifecycleStore((s) => s.goLiveNow);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const write = emp?.role === "owner" || emp?.role === "manager";

  const persist = (patch: {
    trainingTrackInventory?: boolean;
    operatorLifecycle?: Record<string, string>;
    lifecycleStatus?: string;
  }) => {
    if (isProspectDemo() || !orgId || !locId) return;
    void saveLifecycleFn({
      data: { orgId, locationId: locId, ...patch },
    }).catch(() => undefined);
  };

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-border bg-surface p-4" data-demo="lifecycle">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Training & go live</h3>
        <Badge variant={status === "live" ? "success" : "warn"}>
          {LIFECYCLE_LABEL[status]}
        </Badge>
        <GuideLearnLink topicId="location-training" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        After onboard, the house is in Training: full POS, Quantum Payments sandbox,
        practice settlement. Go live when the floor is ready.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={track}
          disabled={!write || status === "live"}
          onChange={(e) => {
            setTrack(e.target.checked);
            persist({ trainingTrackInventory: e.target.checked });
          }}
        />
        <span>
          Track inventory during training
          <span className="mt-0.5 block text-xs text-muted-foreground">
            On: practice sales move on-hand from recipes. Off: on-hand stays put until live.
          </span>
        </span>
      </label>
      {vendors.length > 0 && write && (
        <div>
          <p className="mb-1 text-xs font-medium">Operator status</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Host can be live while a new tenant stays in training.
          </p>
          <ul className="space-y-1">
            {vendors.map((v) => {
              const st = (operatorStatus[v.id] ?? (status === "live" ? "live" : "training")) as LocationLifecycle;
              return (
                <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{v.name}</span>
                  <select
                    className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
                    value={st}
                    disabled={emp?.role !== "owner"}
                    onChange={(e) => {
                      const next = e.target.value as LocationLifecycle;
                      if (next === "live" && emp?.role === "owner") {
                        goLiveNow({ confirm: "GO LIVE NOW", choices: {
                          orders: "keep",
                          payments: "keep",
                          waitlist: "keep",
                          punches: "keep",
                          gift_balances: "keep",
                          inventory_usage: "keep",
                        }, operatorId: v.id });
                      } else {
                        setOperatorStatus(v.id, next);
                      }
                      persist({
                        operatorLifecycle: {
                          ...useLifecycleStore.getState().operatorStatus,
                          [v.id]: next,
                        },
                      });
                    }}
                  >
                    <option value="training">Training</option>
                    <option value="live">Live</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {emp?.role === "owner" && <GoLivePanel />}
    </section>
  );
}
