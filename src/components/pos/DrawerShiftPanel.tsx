import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import {
  DRAWER_SHIFT_MODE_LABEL,
  applyDrawerShiftToSink,
  type DrawerShiftMode,
} from "@/lib/pos/drawer-shift";
import { cashRoleFromSession, isManagerCash, parseCashHandling } from "@/lib/pos/cash-handling";
import {
  bankExpected,
  currentCashSink,
  drawerExpected,
  useCashSessionStore,
} from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";

function dollarsToCents(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

export function DrawerShiftPanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const cfg = parseCashHandling(settings.cashHandling);
  const manager = isManagerCash(emp?.role);
  const owners = useCashSessionStore((s) => s.owners);
  const transfers = useCashSessionStore((s) => s.ownershipTransfers);
  const drawers = useCashSessionStore((s) => s.drawers);
  const banks = useCashSessionStore((s) => s.banks);

  const sink = currentCashSink({
    cfg,
    emp: emp ?? null,
    deviceRole: cashRoleFromSession(kind),
    deviceId: activeDeviceId,
  });
  const shifted = applyDrawerShiftToSink({
    policy: cfg.drawerShift,
    deviceId: activeDeviceId,
    sectionId: null,
    sinkType: sink.type,
  });
  const mode: DrawerShiftMode = shifted.mode;
  const drawer = sink.type === "drawer" ? sink.drawer : cfg.drawers[0];
  const ownerRecordKey = mode === "personal" && emp ? `bank:${emp.id}` : drawer?.id ?? "";
  const owner = owners?.[ownerRecordKey];
  const ownerOpen = Boolean(owner && !owner.closedAt);
  const ownerName = ownerOpen
    ? (employees.find((e) => e.id === owner!.employeeId)?.name ?? owner!.employeeName)
    : "";
  const pending = (transfers ?? []).find(
    (t) => t.status === "offered" && (t.drawerId === drawer?.id || (emp && t.toId === emp.id)),
  );
  const incomingForMe = pending && emp && pending.toId === emp.id ? pending : undefined;

  const [count, setCount] = useState("");
  const [incomingId, setIncomingId] = useState("");
  const [confirmPrevious, setConfirmPrevious] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinFor, setPinFor] = useState<"transfer" | "variance" | null>(null);

  const staff = useMemo(
    () => employees.filter((e) => e.active && e.id !== owner?.employeeId),
    [employees, owner?.employeeId],
  );

  const expected = (() => {
    if (mode === "personal" && emp) {
      const bank = banks[emp.id];
      return bank ? bankExpected(bank) : cfg.drawerShift.personalBankStartCents ?? cfg.serverBankStartingCents;
    }
    if (!drawer) return 0;
    const ses = drawers[drawer.id];
    return ses
      ? drawerExpected(ses)
      : drawer.startingBankCents;
  })();

  const runClaim = () => {
    if (!emp || !drawer) return;
    setError(null);
    setResult(null);
    const res = useCashSessionStore.getState().claimDrawer({
      mode,
      employeeId: emp.id,
      employeeName: emp.name,
      drawerId: mode === "personal" ? `bank:${emp.id}` : drawer.id,
      countedCents: dollarsToCents(count),
      policy: cfg.drawerShift,
      houseMode: cfg.houseDrawerMode,
    });
    if (!res.ok) setError(res.error);
    else {
      setCount("");
      setResult(mode === "personal" ? "Bank open. No drawer kick." : "Drawer claimed.");
    }
  };

  const runTransfer = (managerPinOk: boolean) => {
    if (!emp || !drawer || mode === "personal" || mode === "none") return;
    setError(null);
    setResult(null);
    const person = employees.find((e) => e.id === incomingId);
    const res = useCashSessionStore.getState().beginOwnershipTransfer({
      drawerId: drawer.id,
      actorId: emp.id,
      actorName: emp.name,
      isManager: manager,
      managerPinOk,
      incomingId,
      incomingName: person?.name ?? "Staff",
      outgoingCountCents: dollarsToCents(count),
      policy: cfg.drawerShift,
      expectedCents: expected,
    });
    if (!res.ok) {
      if (res.error === "A manager PIN is required to transfer this drawer.") {
        setPinFor("transfer");
        setPinOpen(true);
        return;
      }
      setError(res.error);
      return;
    }
    const variance = res.transfer.outgoingVarianceCents;
    setCount("");
    setResult(
      variance == null
        ? "Transfer offered. The drawer stays open."
        : `Counted ${formatCurrency(res.transfer.outgoingCountCents ?? 0)}. Expected ${formatCurrency(res.transfer.expectedCents)}. Variance ${formatCurrency(variance)} on ${res.transfer.fromName}. The drawer stays open.`,
    );
  };

  const runAccept = () => {
    if (!emp || !incomingForMe) return;
    setError(null);
    setResult(null);
    const res = useCashSessionStore.getState().acceptOwnershipTransfer({
      transferId: incomingForMe.id,
      actorId: emp.id,
      actorName: emp.name,
      confirmPrevious,
      incomingCountCents: dollarsToCents(count),
      houseMode: cfg.houseDrawerMode,
    });
    if (!res.ok) setError(res.error);
    else {
      setCount("");
      setResult(`You own this drawer. Starting count ${formatCurrency(res.startCents)}. The drawer stays open.`);
    }
  };

  const runClose = (managerApproved: boolean) => {
    if (!emp) return;
    setError(null);
    setResult(null);
    const key = mode === "personal" ? `bank:${emp.id}` : drawer?.id;
    if (!key) return;
    const res = useCashSessionStore.getState().closeOwnedDrawer({
      drawerId: key,
      actorId: emp.id,
      actorName: emp.name,
      countedCents: dollarsToCents(count),
      expectedCents: expected,
      policy: cfg.drawerShift,
      managerApproved,
      personal: mode === "personal",
    });
    if (!res.ok) {
      if (res.needsManager) {
        setPinFor("variance");
        setPinOpen(true);
        return;
      }
      setError(res.error);
      return;
    }
    setCount("");
    setResult(
      `Closed. Expected ${formatCurrency(expected)}. Variance ${formatCurrency(res.varianceCents)}${res.flagged ? " — flagged." : "."}`,
    );
  };

  const runForce = () => {
    if (!emp || !drawer) return;
    setError(null);
    setResult(null);
    const person = employees.find((e) => e.id === incomingId);
    const res = useCashSessionStore.getState().forceReassignDrawer({
      drawerId: drawer.id,
      actorId: emp.id,
      incomingId,
      incomingName: person?.name ?? "Staff",
      isManager: manager,
      houseMode: cfg.houseDrawerMode,
    });
    if (!res.ok) setError(res.error);
    else setResult("Ownership moved. This is a manager action. No count is recorded.");
  };

  const canTransfer =
    cfg.drawerShift.allowTransfer &&
    ownerOpen &&
    emp &&
    (emp.id === owner?.employeeId || manager) &&
    mode !== "none" &&
    mode !== "personal";
  const canClose = ownerOpen && emp && emp.id === owner?.employeeId;
  const fixedPersonal = mode === "personal" && cfg.drawerShift.personalBankStartCents != null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3" data-drawer-shift>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Drawer ownership</h3>
        <p className="text-xs text-muted-foreground">{DRAWER_SHIFT_MODE_LABEL[mode]}</p>
      </div>
      <p className="text-sm" data-drawer-owner>
        Owner: {ownerOpen ? ownerName : "No owner"}
      </p>
      {mode === "none" && (
        <p className="mt-2 text-sm text-muted-foreground">This station does not handle cash.</p>
      )}
      {mode === "personal" && (
        <p className="mt-1 text-xs text-muted-foreground">No drawer kick. This is a personal bank.</p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {result && <p className="mt-2 text-sm">{result}</p>}

      {mode !== "none" && !ownerOpen && !incomingForMe && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!fixedPersonal && (
            <label className="text-xs text-muted-foreground">
              Blind count
              <Input
                className="mt-1 w-32"
                inputMode="decimal"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="0.00"
                aria-label="Blind open count"
              />
            </label>
          )}
          <Button type="button" data-drawer-claim onClick={runClaim}>
            {mode === "personal" ? "Open bank" : "Claim drawer"}
          </Button>
        </div>
      )}

      {incomingForMe && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Accept transfer from {incomingForMe.fromName}. The drawer stays open.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmPrevious}
              onChange={(e) => setConfirmPrevious(e.target.checked)}
            />
            Confirm the previous count
          </label>
          {!confirmPrevious && (
            <label className="block text-xs text-muted-foreground">
              Your blind count
              <Input
                className="mt-1 w-32"
                inputMode="decimal"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="0.00"
                aria-label="Incoming blind count"
              />
            </label>
          )}
          <Button type="button" data-drawer-accept onClick={runAccept}>
            Accept transfer
          </Button>
        </div>
      )}

      {canTransfer && !incomingForMe && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            Incoming employee
            <select
              className="mt-1 h-9 rounded-lg border border-border bg-bg px-2 text-sm"
              value={incomingId}
              onChange={(e) => setIncomingId(e.target.value)}
              aria-label="Incoming employee"
            >
              <option value="">Select</option>
              {staff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          {cfg.drawerShift.requireCountOnTransfer && (
            <label className="text-xs text-muted-foreground">
              Blind count
              <Input
                className="mt-1 w-32"
                inputMode="decimal"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="0.00"
                aria-label="Outgoing blind count"
              />
            </label>
          )}
          <Button type="button" data-drawer-transfer onClick={() => runTransfer(false)}>
            Transfer drawer
          </Button>
        </div>
      )}

      {canClose && !incomingForMe && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            Blind close count
            <Input
              className="mt-1 w-32"
              inputMode="decimal"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="0.00"
              aria-label="Blind close count"
            />
          </label>
          <Button type="button" variant="secondary" data-drawer-close onClick={() => runClose(false)}>
            {mode === "personal" ? "Close bank" : "Close drawer"}
          </Button>
        </div>
      )}

      {manager && mode !== "none" && mode !== "personal" && drawer && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            This is a manager action. No count is recorded.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              New owner
              <select
                className="mt-1 h-9 rounded-lg border border-border bg-bg px-2 text-sm"
                value={incomingId}
                onChange={(e) => setIncomingId(e.target.value)}
                aria-label="Force reassign employee"
              >
                <option value="">Select</option>
                {staff.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="secondary" data-drawer-force onClick={runForce}>
              Force reassign
            </Button>
          </div>
        </div>
      )}

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title={pinFor === "variance" ? "Approve variance" : "Manager PIN"}
        description={
          pinFor === "variance"
            ? "A manager must approve this variance."
            : "A manager PIN is required to transfer this drawer."
        }
        onVerified={() => {
          setPinOpen(false);
          if (pinFor === "variance") runClose(true);
          else runTransfer(true);
        }}
      />
    </section>
  );
}
