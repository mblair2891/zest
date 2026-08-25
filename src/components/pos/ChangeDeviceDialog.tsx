import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { SESSION_MODES, type SessionModeId } from "@/lib/lifecycle/types";
import { applySessionModeView } from "./DeviceModeView";
import { usePosStore } from "@/lib/pos/store";
import { viewForDeviceFunction, type DeviceFunction } from "@/lib/pos/location-devices";

export function ChangeDeviceButton() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const [open, setOpen] = useState(false);
  if (emp?.role !== "owner" && emp?.role !== "manager") return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MonitorSmartphone className="h-3.5 w-3.5" />
        Change device
      </Button>
      <ChangeDeviceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ChangeDeviceDialog({
  open,
  onOpenChange,
  pane,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pane?: "a" | "b" | "session";
}) {
  const mode = useLifecycleStore((s) => s.sessionMode);
  const paneA = useLifecycleStore((s) => s.paneA);
  const paneB = useLifecycleStore((s) => s.paneB);
  const setSessionMode = useLifecycleStore((s) => s.setSessionMode);
  const setPane = useLifecycleStore((s) => s.setPane);
  const setSplit = useLifecycleStore((s) => s.setSplit);
  const split = useLifecycleStore((s) => s.splitEnabled);
  const setView = usePosStore((s) => s.setView);
  const devices = usePosStore((s) => s.locationDevices);
  const setActiveDeviceId = usePosStore((s) => s.setActiveDeviceId);
  const current = pane === "a" ? paneA : pane === "b" ? paneB : mode;

  const pick = (id: SessionModeId) => {
    if (pane === "a" || pane === "b") setPane(pane, id);
    else {
      setSessionMode(id);
      applySessionModeView(id, (v) => setView(v));
      const fn = id as DeviceFunction;
      const match = devices.find((d) => d.assignment.function === fn);
      if (match) setActiveDeviceId(match.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="w-[min(100vw-1.25rem,28rem)]">
        <DialogHeader>
          <DialogTitle>
            {pane === "a" ? "Left pane" : pane === "b" ? "Right pane" : "Change device"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          This browser session switches layout. PIN users keep their own permissions.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {SESSION_MODES.map((m) => (
            <li key={m.id}>
              <Button
                variant={current === m.id ? "default" : "outline"}
                className="w-full justify-start"
                size="sm"
                onClick={() => pick(m.id)}
              >
                {m.label}
              </Button>
            </li>
          ))}
        </ul>
        {pane == null && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={split}
              onChange={(e) => setSplit(e.target.checked)}
            />
            Split screen (two independent panes)
          </label>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SplitScreenToggle() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const split = useLifecycleStore((s) => s.splitEnabled);
  const setSplit = useLifecycleStore((s) => s.setSplit);
  if (emp?.role !== "owner" && emp?.role !== "manager") return null;
  return (
    <Button
      size="sm"
      variant={split ? "default" : "outline"}
      onClick={() => setSplit(!split)}
    >
      Split screen
    </Button>
  );
}

export { viewForDeviceFunction };
