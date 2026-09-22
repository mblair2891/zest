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
import { toast } from "sonner";
import { usePosStore } from "@/lib/pos/store";
import { findStaffByPin } from "@/lib/pos/pin";
import {
  employeeCanStationService,
  pinUnlocksStationService,
  STATION_RELOAD_HOLD_MS,
} from "@/lib/pos/station-kiosk";
import {
  exitStationKiosk,
  hasNativeKioskBridge,
  KIOSK_UNPIN_HINT,
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
  const [reloadOpen, setReloadOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(emp);
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

  const leaveLock = async () => {
    const result = await exitStationKiosk();
    if (!result.unpinned) toast(KIOSK_UNPIN_HINT);
  };

  const needPin = (action: "reload" | "exit") => {
    if (action === "exit") {
      if (signedIn) {
        usePosStore.getState().logout();
        return;
      }
      setPin("");
      setError(null);
      setExitOpen(true);
      return;
    }
    if (unpaired || privileged) {
      runReload();
      return;
    }
    setPin("");
    setError(null);
    setReloadOpen(true);
  };

  const pinOk = () => {
    const st = usePosStore.getState();
    return pinUnlocksStationService({
      pin,
      locationId: st.tenantLocationId || st.activeEntityId || "loc",
      employees: st.employees,
      managerPin: st.settings.managerPin,
      stationServicePinHash: st.settings.stationServicePinHash,
    });
  };

  const rejectPin = () => {
    const st = usePosStore.getState();
    const loc = st.tenantLocationId || st.activeEntityId || "loc";
    const who = findStaffByPin(st.employees, pin, loc, null);
    if (who && !employeeCanStationService(who.role)) {
      toast("Staff PINs cannot exit");
    } else {
      toast("Invalid PIN");
    }
    setError("Manager or station PIN");
  };

  const submitExit = () => {
    if (!pinOk()) {
      rejectPin();
      return;
    }
    setExitOpen(false);
    setPin("");
    void leaveLock();
  };

  const submitReload = () => {
    if (!pinOk()) {
      toast("Invalid PIN");
      setError("Manager or station PIN");
      return;
    }
    setReloadOpen(false);
    setPin("");
    runReload();
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
        <button
          type="button"
          className="pointer-events-auto rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70"
          data-exit-kiosk
          onClick={() => needPin("exit")}
        >
          Exit kiosk
        </button>
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

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent data-exit-kiosk-dialog>
          <DialogHeader>
            <DialogTitle>Manager / station PIN</DialogTitle>
            <DialogDescription>
              Manager, owner, or the Devices service PIN. Staff PINs cannot exit.
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitExit();
            }}
            placeholder="PIN"
            className="text-center text-lg tracking-[0.4em]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitExit}>Exit kiosk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reloadOpen} onOpenChange={setReloadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reload station</DialogTitle>
            <DialogDescription>
              Manager, owner, or the Devices service PIN. Staff PINs cannot reload.
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitReload();
            }}
            placeholder="PIN"
            className="text-center text-lg tracking-[0.4em]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReloadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReload}>Reload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
