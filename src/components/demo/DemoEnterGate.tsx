import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { demoEntry } from "@/lib/demo/catalog";
import { enterDemoOperator } from "@/lib/demo/device-session";
import { pickEmployeeForRole, loginDemoEmployee } from "@/lib/demo/device-session";
import { usePosStore } from "@/lib/pos/store";
import type { VenueEntityId } from "@/lib/pos/types";

export function DemoEnterGate({ type }: { type: VenueEntityId }) {
  const entry = demoEntry(type);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const enter = () => {
    enterDemoOperator();
    const emps = usePosStore.getState().employees;
    const owner = pickEmployeeForRole(emps, "owner") ?? emps[0];
    if (owner) loginDemoEmployee(owner);
  };

  const submitCreds = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.trim().toLowerCase() === "demo" && pass === "demo") {
      enter();
      return;
    }
    setErr("Use demo / demo, or Continue as demo operator.");
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 pt-[var(--grok-banner-h,0px)]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <SummexBrandBlock className="mb-5" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Prospect demo
        </p>
        <h1 className="mt-2 font-display text-2xl font-medium">
          {entry?.hostName ?? "Demo house"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One demo login. After you enter, switch access level, kiosk, or KDS.
          This session cannot open live tenants.
        </p>
        <Button type="button" className="mt-6 w-full" onClick={enter}>
          Continue as demo operator
        </Button>
        <form className="mt-6 space-y-3" onSubmit={submitCreds}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Or username / password
          </p>
          <Input
            placeholder="Username"
            value={user}
            autoComplete="username"
            onChange={(e) => setUser(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={pass}
            autoComplete="current-password"
            onChange={(e) => setPass(e.target.value)}
          />
          {err && (
            <p className="text-sm text-danger" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" variant="outline" className="w-full">
            Enter demo
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/demo" className="underline-offset-2 hover:underline">
            All demos
          </Link>
        </p>
      </div>
    </div>
  );
}
