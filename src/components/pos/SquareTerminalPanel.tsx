import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createSquareDeviceCodeFn,
  refreshSquareDeviceCodeFn,
  squareTestPingFn,
} from "@/lib/payments/api";
import type { LocationDevice } from "@/lib/pos/location-devices";
import { usePosStore } from "@/lib/pos/store";

/** Devices → Card terminals. Pairs one Square Terminal and can ping $1.00. */
export function SquareTerminalPanel({
  locationId,
  devices,
  onPaired,
}: {
  locationId: string;
  devices: LocationDevice[];
  onPaired: () => void;
}) {
  const rail = usePosStore((s) => s.settings.cardProcessor);
  const terminals = devices.filter(
    (device) =>
      device.status !== "inactive" &&
      (device.type === "terminal" || device.stationClass === "terminal"),
  );
  const [picked, setPicked] = useState(terminals[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const row = terminals.find((device) => device.id === picked) ?? terminals[0];

  useEffect(() => {
    if (!row || row.squarePairStatus === "paired" || !row.squareCodeId) return;
    let stop = false;
    const tick = () => {
      void refreshSquareDeviceCodeFn({ data: { locationId, deviceRowId: row.id } })
        .then((res) => {
          if (stop || !res.ok) return;
          if (res.code) setCode(res.code);
          if (res.pairStatus === "paired") onPaired();
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [locationId, onPaired, row]);

  if (rail !== "square") return null;

  const createCode = () => {
    if (!row) return;
    setBusy(true);
    setMessage(null);
    void createSquareDeviceCodeFn({ data: { locationId, deviceRowId: row.id } })
      .then((res) => {
        if (!res.ok) {
          setMessage(res.error || "Could not create a device code.");
          return;
        }
        setCode(res.code || null);
        setMessage("enter this on the Terminal.");
        onPaired();
      })
      .catch(() => setMessage("Could not create a device code."))
      .finally(() => setBusy(false));
  };

  const ping = () => {
    if (!row) return;
    const ok = window.confirm("Show a $1.00 auth on the Square Terminal and cancel it?");
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    void squareTestPingFn({
      data: { locationId, deviceRowId: row.id, managerConfirm: true },
    })
      .then((res) => {
        setMessage(res.ok ? "Test canceled. Nothing was marked paid." : res.error || "Test failed.");
      })
      .catch(() => setMessage("Test failed."))
      .finally(() => setBusy(false));
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" data-square-terminals="">
      <p className="text-sm font-medium">Card terminals</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Create a Square device code, then enter this on the Terminal. The paired device id is stored on this row.
      </p>
      {terminals.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Add a terminal, then pair it here.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-muted-foreground">
            Terminal
            <select
              className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
              value={row?.id ?? ""}
              onChange={(e) => {
                setPicked(e.target.value);
                setCode(null);
              }}
            >
              {terminals.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                  {device.squarePairStatus === "paired" ? " · paired" : ""}
                </option>
              ))}
            </select>
          </label>
          {row?.squarePairStatus === "paired" && row.squareDeviceId ? (
            <p className="text-xs text-muted-foreground">Paired · {row.squareDeviceId}</p>
          ) : (
            <p className="text-sm font-medium" data-square-device-code="">
              {code || row?.squareDeviceCode || "No code yet"}
              {(code || row?.squareDeviceCode) ? " — enter this on the Terminal." : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" disabled={busy || !row} onClick={createCode}>
              Create device code
            </Button>
            <Button size="sm" type="button" variant="outline" disabled={busy || !row?.squareDeviceId} onClick={ping}>
              Test ping $1.00
            </Button>
          </div>
        </div>
      )}
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
