import { useLifecycleStore, locationIsTraining, operatorIsTraining } from "@/lib/lifecycle/store";
import { LIFECYCLE_LABEL } from "@/lib/lifecycle/types";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export function TrainingBanner() {
  const status = useLifecycleStore((s) => s.status);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const locTraining = locationIsTraining(status);
  const opTraining = operatorIsTraining(emp?.operatorId);
  if (!locTraining && !opTraining) return null;

  const tenant =
    !locTraining && emp?.operatorId && emp.operatorId !== HOST_SCOPE && opTraining;

  return (
    <div
      className="shrink-0 border-b border-warn/40 bg-warn/15 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-warn"
      role="status"
    >
      {tenant
        ? "Training — this operator is in practice mode (sandbox cards)"
        : `TRAINING — practice mode · ${LIFECYCLE_LABEL[status]} · Quantum Payments sandbox`}
    </div>
  );
}
