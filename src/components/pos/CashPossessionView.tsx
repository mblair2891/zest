import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { isManagerCash, parseCashHandling } from "@/lib/pos/cash-handling";
import { staffCustody, takeDrawerLabel } from "@/lib/pos/cash-custody";
import { useCashSessionStore } from "@/lib/pos/cash-session";
import { findStaffByPin } from "@/lib/pos/pin";
import { formatCurrency } from "@/lib/utils";

export function CashPossessionView({
  mode,
  onDone,
}: {
  mode: "take" | "hand_off";
  onDone: () => void;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const cfg = parseCashHandling(settings.cashHandling);
  const possession = useCashSessionStore((s) => (emp ? s.possessions[emp.id] : undefined));
  const [drawerId, setDrawerId] = useState(cfg.drawers[0]?.id ?? "");
  const [declared, setDeclared] = useState("");
  const [witnessPin, setWitnessPin] = useState("");
  const [toId, setToId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!emp) return null;
  const custody = staffCustody({
    role: emp.role,
    roleDefaults: cfg.custodyByRole,
    employeeOverride: cfg.custodyByEmployeeId[emp.id] ?? null,
  });
  if (custody === "none") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        This PIN is not assigned cash.
      </div>
    );
  }

  const accept = () => {
    setErr(null);
    const cents = Math.max(0, Math.round(parseFloat(declared || "0") * 100) || 0);
    let witnessId: string | null = null;
    if (cfg.managerWitnessOnOpen) {
      const w = findStaffByPin(employees, witnessPin, usePosStore.getState().tenantLocationId || "");
      if (!w || !isManagerCash(w.role)) {
        setErr("Manager witness PIN required.");
        return;
      }
      witnessId = w.id;
    }
    const res = useCashSessionStore.getState().acceptPossession(
      {
        employeeId: emp.id,
        kind: custody === "personal_bank" ? "personal_bank" : "house_drawer",
        drawerId: custody === "personal_bank" ? null : drawerId || null,
        declaredOpeningCents: cents,
        acceptedAt: Date.now(),
        witnessId,
      },
      cfg.houseDrawerMode,
    );
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onDone();
  };

  const handOff = () => {
    setErr(null);
    const to = employees.find((e) => e.id === toId);
    if (!to) {
      setErr("Pick who takes over.");
      return;
    }
    const mine = useCashSessionStore.getState().possessionOf(emp.id);
    if (!mine) {
      setErr("You are not in possession.");
      return;
    }
    const cents = cfg.handoffAcceptPriorCount
      ? mine.declaredOpeningCents
      : Math.max(0, Math.round(parseFloat(declared || "0") * 100) || 0);
    useCashSessionStore.getState().releasePossession(emp.id);
    const res = useCashSessionStore.getState().acceptPossession(
      {
        employeeId: to.id,
        kind: mine.kind,
        drawerId: mine.drawerId,
        declaredOpeningCents: cents,
        acceptedAt: Date.now(),
        handedFromId: emp.id,
      },
      cfg.houseDrawerMode,
    );
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onDone();
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-5">
      <p className="text-lg font-semibold">
        {mode === "hand_off" ? "Hand off" : takeDrawerLabel(custody)}
      </p>
      <p className="text-sm text-muted-foreground">
        {mode === "hand_off"
          ? "A counts out. B takes possession. Expected stays hidden (blind)."
          : "Declare opening cash. You do not see expected. You cannot tender cash until you accept."}
      </p>
      {possession && mode === "take" && (
        <p className="text-sm">
          In possession since {new Date(possession.acceptedAt).toLocaleTimeString()} · declared{" "}
          {formatCurrency(possession.declaredOpeningCents)}
        </p>
      )}
      {custody === "house_drawer" && mode === "take" && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Drawer</span>
          <select
            className="h-12 w-full rounded-lg border border-border bg-bg px-3 text-base"
            value={drawerId}
            onChange={(e) => setDrawerId(e.target.value)}
          >
            {cfg.drawers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode === "hand_off" && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Hand to</span>
          <select
            className="h-12 w-full rounded-lg border border-border bg-bg px-3 text-base"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            <option value="">Select</option>
            {employees
              .filter((e) => e.active && e.id !== emp.id && e.role !== "kitchen")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {!(mode === "hand_off" && cfg.handoffAcceptPriorCount) && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            Declared opening cash (blind — no expected)
          </span>
          <Input
            className="h-12 text-lg"
            inputMode="decimal"
            value={declared}
            onChange={(e) => setDeclared(e.target.value)}
            placeholder="0.00"
          />
        </label>
      )}
      {cfg.managerWitnessOnOpen && mode === "take" && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Manager witness PIN</span>
          <Input
            className="h-12 text-lg tracking-widest"
            inputMode="numeric"
            maxLength={4}
            value={witnessPin}
            onChange={(e) => setWitnessPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button className="station-touch h-14 text-lg" onClick={mode === "hand_off" ? handOff : accept}>
        {mode === "hand_off" ? "Hand off" : "Accept possession"}
      </Button>
      {possession && mode === "take" && (
        <Button
          variant="outline"
          className="station-touch h-12"
          onClick={() => {
            useCashSessionStore.getState().releasePossession(emp.id);
            onDone();
          }}
        >
          Release (no closeout)
        </Button>
      )}
    </div>
  );
}
