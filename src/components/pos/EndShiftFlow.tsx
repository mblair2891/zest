import { useState } from "react";
import { usePosStore } from "@/lib/pos/store";
import { parseCashHandling, cashRoleFromSession } from "@/lib/pos/cash-handling";
import { currentCashSink } from "@/lib/pos/cash-session";
import { shouldCountCashOnCloseout } from "@/lib/pos/closeout";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { isBlindPhase } from "@/lib/pos/till-closeout";
import { useTillCloseoutStore } from "@/lib/pos/till-closeout-store";
import { CloseoutView } from "./CloseoutView";
import { TillCloseoutView } from "./TillCloseoutView";

/**
 * End of shift: blind till count first, then server sales & tips.
 * Cashiers who only close a drawer can stop after the result.
 */
export function EndShiftFlow({ onDone }: { onDone: () => void }) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const settings = usePosStore((s) => s.settings);
  const cfg = parseCashHandling(settings.cashHandling);
  const cashOn = parsePaymentMethods(settings.paymentMethods).cash;
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const sink = currentCashSink({
    cfg,
    emp: emp ?? null,
    deviceRole: cashRoleFromSession(kind),
    deviceId: usePosStore.getState().activeDeviceId,
  });
  const counting = emp
    ? shouldCountCashOnCloseout({ sink, emp, cfg, cashEnabled: cashOn })
    : false;
  const tillRec = useTillCloseoutStore((s) =>
    emp ? s.records.find((r) => r.employeeId === emp.id && r.status !== "voided") : undefined,
  );
  const tillDone = Boolean(tillRec && !isBlindPhase(tillRec.status) && tillRec.countedCents != null);
  const wantsTips =
    emp?.role === "server" || emp?.role === "bartender" || emp?.role === "host" || emp?.role === "manager";

  const [phase, setPhase] = useState<"till" | "tips">(counting && !tillDone ? "till" : counting ? "till" : "tips");

  if (phase === "till" && counting) {
    return (
      <TillCloseoutView
        onDone={onDone}
        onContinueTips={
          wantsTips
            ? () => setPhase("tips")
            : undefined
        }
      />
    );
  }

  return <CloseoutView onDone={onDone} skipCashCount />;
}
