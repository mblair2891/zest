import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { demoEntry } from "@/lib/demo/catalog";
import { DEMO_STAFF_PIN, isDemoStaffPin } from "@/lib/demo/pin";
import {
  enterDemoOperator,
  loginDemoEmployee,
  pickEmployeeForRole,
  useDemoDeviceStore,
} from "@/lib/demo/device-session";
import { PinKeypad } from "@/components/pos/PinKeypad";
import { usePosStore } from "@/lib/pos/store";
import type { VenueEntityId } from "@/lib/pos/types";

export function DemoEnterGate({ type }: { type: VenueEntityId }) {
  const entry = demoEntry(type);
  const employees = usePosStore((s) => s.employees);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const [staffId, setStaffId] = useState<string>(employees[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const staff = useMemo(
    () => employees.filter((e) => e.active && e.role !== "kiosk"),
    [employees],
  );

  const badPin = () => {
    setMsg(null);
    setErr("Invalid PIN");
    setShake((n) => n + 1);
  };

  const completeLogin = () => {
    enterDemoOperator();
    const owner =
      pickEmployeeForRole(employees, "owner") ??
      pickEmployeeForRole(employees, "manager") ??
      employees[0];
    if (owner) {
      loginDemoEmployee(owner, "pin");
      usePosStore.getState().setView("hq");
      useDemoDeviceStore.getState().setStation("owner");
      useDemoDeviceStore.getState().setDisplayName("Owner / Manager");
      if (!owner.clockedIn) clockToggle(owner.id);
    }
  };

  const onEnter = (pin: string) => {
    setErr(null);
    setMsg(null);
    if (pin.length !== 4 || (!isDemoStaffPin(pin) && pin !== DEMO_STAFF_PIN)) {
      badPin();
      return;
    }
    completeLogin();
  };

  const onClockIn = (pin: string) => {
    setErr(null);
    setMsg(null);
    if (pin.length !== 4 || (!isDemoStaffPin(pin) && pin !== DEMO_STAFF_PIN)) {
      badPin();
      return;
    }
    const emp = staff.find((e) => e.id === staffId) ?? staff[0];
    if (!emp) {
      setErr("No staff on this demo house");
      return;
    }
    if (emp.clockedIn) {
      setMsg(`${emp.name} is already clocked in`);
      return;
    }
    clockToggle(emp.id);
    setMsg(`${emp.name} clocked in`);
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 pt-[var(--grok-banner-h,0px)]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6" data-demo="demo-pin-gate">
        <SummexBrandBlock className="mb-5" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Demo sites · PIN
        </p>
        <h1 className="mt-2 font-display text-2xl font-medium">
          {entry?.hostName ?? "Demo house"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Staff PIN is <strong>{DEMO_STAFF_PIN}</strong>. Enter opens Owner / Manager.
          Clock in only punches.
        </p>

        <div className="mt-5">
          <PinKeypad
            hint={`Universal demo PIN ${DEMO_STAFF_PIN}`}
            error={err}
            shakeToken={shake}
            onClearError={() => setErr(null)}
            onComplete={() => {}}
            station={{ onEnter, onClockIn }}
          />
        </div>
        {msg && (
          <p className="mt-3 text-center text-sm text-success" role="status">
            {msg}
          </p>
        )}

        <label className="mt-4 block text-xs text-muted-foreground">
          Clock in as
          <select
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title || e.name} · {e.role}
                {e.clockedIn ? " · in" : " · out"}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <Link
            to="/kiosk"
            className="underline-offset-2 hover:underline"
            onClick={() => {
              enterDemoOperator();
              useDemoDeviceStore.getState().setDevice("kiosk");
              useDemoDeviceStore.getState().setStation("kiosk");
            }}
          >
            Open guest kiosk
          </Link>
          <Link to="/demo" className="underline-offset-2 hover:underline">
            All demo sites
          </Link>
          <Link to="/" className="underline-offset-2 hover:underline">
            Marketing home
          </Link>
        </div>
      </div>
    </div>
  );
}
