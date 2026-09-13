import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import {
  employeeCanStationService,
  pinUnlocksStationService,
  STATION_RELOAD_HOLD_MS,
} from "@/lib/pos/station-kiosk";
import {
  exitStationKiosk,
  hasNativeKioskBridge,
  reloadStationWebView,
} from "@/lib/native-kiosk";
import { isNativeApp } from "@/lib/native-shell";

/**
 * Discreet station-shell controls. Long-press 2s reloads the WebView.
 * Exit kiosk is manager / owner / Devices service PIN only.
 */
export function StationKioskControls() {
  const native = isNativeApp() || hasNativeKioskBridge();
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const locId = usePosStore((s) => s.tenantLocationId);
  const privileged = employeeCanStationService(emp?.role);
  const unpaired = !locId;
  const [pinOpen, setPinOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hold.current) clearTimeout(hold.current);
    };
  }, []);

  if (!native) return null;

  const runReload = () => {
    reloadStationWebView();
  };

  const runExit = () => {
    exitStationKiosk();
  };

  const needPin = (action: "reload" | "exit") => {
    if (unpaired && action === "reload") {
      runReload();
      return;
    }
    if (privileged) {
      if (action === "reload") runReload();
      else setExitOpen(true);
      return;
    }
    setPin("");
    setError(null);
    setPinOpen(true);
  };

  const submitPin = (action: "reload" | "exit") => {
    const st = usePosStore.getState();
    const ok = pinUnlocksStationService({
      pin,
      locationId: st.tenantLocationId || st.activeEntityId || "loc",
      employees: st.employees,
      managerPin: st.settings.managerPin,
      stationServicePinHash: st.settings.stationServicePinHash,
    });
    if (!ok) {
      setError("Manager, owner, or station service PIN only.");
      return;
    }
    setPinOpen(false);
    setPin("");
    if (action === "exit") setExitOpen(true);
    else runReload();
  };

  const startHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = setTimeout(() => {
      hold.current = null;
      needPin("reload");
    }, STATION_RELOAD_HOLD_MS);
  };

  const endHold = () => {
    if (hold.current) {
      clearTimeout(hold.current);
      hold.current = null;
    }
  };

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex items-end justify-between px-3 pb-3"
        data-demo="station-kiosk-controls"
      >
        {privileged ? (
          <button
            type="button"
            className="pointer-events-auto rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70"
            onClick={() => needPin("exit")}
          >
            Exit kiosk
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label="Reload station website"
          className="pointer-events-auto h-11 w-11 rounded-full"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onPointerLeave={endHold}
        >
          <span className="mx-auto block h-2 w-2 rounded-full bg-muted-foreground/25" />
        </button>
      </div>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Station service</DialogTitle>
            <DialogDescription>
              Manager, owner, or the Devices service PIN. Staff PINs cannot reload or exit
              lock-task.
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPin("reload");
            }}
            placeholder="PIN"
            className="text-center text-lg tracking-[0.4em]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPinOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => submitPin("exit")}>
              Exit kiosk
            </Button>
            <Button onClick={() => submitPin("reload")}>Reload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit kiosk?</DialogTitle>
            <DialogDescription>
              This stops lock-task and shows the Android home screen. Website updates only need
              Reload — do not unpin. APK updates: unpin, then reinstall.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              Stay
            </Button>
            <Button
              onClick={() => {
                setExitOpen(false);
                runExit();
              }}
            >
              Exit kiosk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
