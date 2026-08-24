import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type GateMode = "login" | "clock_in" | "clock_out";

export function DemoEnterGate({ type }: { type: VenueEntityId }) {
  const entry = demoEntry(type);
  const employees = usePosStore((s) => s.employees);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const [mode, setMode] = useState<GateMode>("login");
  const [staffId, setStaffId] = useState<string>(employees[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const staff = useMemo(
    () => employees.filter((e) => e.active && e.role !== "kiosk"),
    [employees],
  );

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

  const onPin = (pin: string) => {
    setErr(null);
    setMsg(null);
    if (!isDemoStaffPin(pin) && pin !== DEMO_STAFF_PIN) {
      setErr(`Demo PIN is ${DEMO_STAFF_PIN}`);
      return;
    }
    if (mode === "login") {
      completeLogin();
      return;
    }
    const emp = staff.find((e) => e.id === staffId) ?? staff[0];
    if (!emp) {
      setErr("No staff on this demo house");
      return;
    }
    const shouldIn = mode === "clock_in";
    if (shouldIn === !!emp.clockedIn) {
      setMsg(
        `${emp.name} is already ${emp.clockedIn ? "clocked in" : "clocked out"}`,
      );
      return;
    }
    clockToggle(emp.id);
    setMsg(`${emp.name} ${shouldIn ? "clocked in" : "clocked out"}`);
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
          Staff PIN is <strong>{DEMO_STAFF_PIN}</strong> for every demo role.
          Login opens Owner / Manager. Clock in and clock out are separate
          from the session.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-border p-1">
          {(
            [
              ["login", "Login"],
              ["clock_in", "Clock in"],
              ["clock_out", "Clock out"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setErr(null);
                setMsg(null);
              }}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-semibold",
                mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode !== "login" && (
          <label className="mt-4 block text-xs text-muted-foreground">
            Staff
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
        )}

        <div className="mt-5">
          <PinKeypad
            title={mode === "login" ? "Enter PIN to start" : "Confirm with PIN"}
            hint={`Universal demo PIN ${DEMO_STAFF_PIN}`}
            error={err}
            onClearError={() => setErr(null)}
            onComplete={onPin}
          />
        </div>
        {msg && (
          <p className="mt-3 text-center text-sm text-success" role="status">
            {msg}
          </p>
        )}

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
