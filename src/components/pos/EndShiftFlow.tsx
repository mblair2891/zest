import { useState } from "react";
import { usePosStore } from "@/lib/pos/store";
import { parseCashHandling, cashRoleFromSession } from "@/lib/pos/cash-handling";
import { currentCashSink, useCashSessionStore } from "@/lib/pos/cash-session";
import { shouldCountCashOnCloseout } from "@/lib/pos/closeout";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { pinIsManager, punchOutAfterCloseout } from "@/lib/pos/station-clock";
import { isBlindPhase } from "@/lib/pos/till-closeout";
import { useTillCloseoutStore } from "@/lib/pos/till-closeout-store";
import { Button } from "@/components/ui/button";
import { CloseoutView } from "./CloseoutView";
import { PinKeypad } from "./PinKeypad";
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
  const [punchHold, setPunchHold] = useState<{ error: string; force: boolean } | null>(null);

  const punchThenDone = () => {
    const id = usePosStore.getState().currentEmployeeId;
    if (id) useCashSessionStore.getState().releasePossession(id);
    if (!id) {
      onDone();
      return;
    }
    if (useTillCloseoutStore.getState().clockOutBlockedFor(id)) {
      setPunchHold({
        error: "Over/short is above house tolerance. A manager must accept the till close before clock-out.",
        force: false,
      });
      return;
    }
    const res = punchOutAfterCloseout(id);
    if (!res.ok && res.forceRequired) {
      setPunchHold({ error: res.error ?? "Manager PIN to clock out", force: true });
      return;
    }
    if (!res.ok) {
      setPunchHold({ error: res.error ?? "Could not clock out", force: false });
      return;
    }
    onDone();
  };

  if (punchHold) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-bg px-6" data-closeout-punch>
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-lg font-semibold">Clock out</h2>
          <p className="text-sm text-danger" role="alert">
            {punchHold.error}
          </p>
          {punchHold.force ? (
            <PinKeypad
              title="Manager PIN"
              onComplete={(pin) => {
                const id = usePosStore.getState().currentEmployeeId;
                if (!id || !pinIsManager(pin)) {
                  setPunchHold({ error: "Manager PIN required", force: true });
                  return;
                }
                const res = punchOutAfterCloseout(id, { force: true });
                if (!res.ok) {
                  setPunchHold({ error: res.error ?? "Could not clock out", force: Boolean(res.forceRequired) });
                  return;
                }
                onDone();
              }}
            />
          ) : (
            <Button type="button" variant="outline" className="h-12 w-full" onClick={onDone}>
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "till" && counting) {
    return (
      <TillCloseoutView
        onDone={onDone}
        onFinished={wantsTips ? undefined : punchThenDone}
        onContinueTips={
          wantsTips
            ? () => setPhase("tips")
            : undefined
        }
      />
    );
  }

  return <CloseoutView onDone={onDone} onComplete={punchThenDone} skipCashCount />;
}
